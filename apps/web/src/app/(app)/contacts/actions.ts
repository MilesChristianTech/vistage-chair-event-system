'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';
import type { MappedPersonRow, ColumnTarget } from '@/lib/import';
import { PERSON_FIELD_LABELS, dedupeMapping } from '@/lib/import';
import { suggestColumnMapping } from '@/lib/coach';
import { AnthropicNotConfiguredError } from '@/lib/anthropic';
import type { Database, Json } from '@/lib/database.types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function slugifyFieldKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
}

const CUSTOM_FIELD_PREFIX = 'custom_field__';

function customFieldsFromFormData(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(CUSTOM_FIELD_PREFIX)) {
      values[key.slice(CUSTOM_FIELD_PREFIX.length)] = String(value).trim();
    }
  }
  return values;
}

export interface CustomFieldDefinition {
  id: string;
  field_key: string;
  label: string;
}

// Part request: "unlimited import columns" / a basic Excel-CRM classifier
// system - a Host can define their own field on the fly (from the contact
// form or the import wizard) rather than being limited to the fixed
// columns. Reuses an existing definition with the same key if the label
// normalizes to one already in use.
export async function createCustomFieldDefinitionAction(label: string): Promise<ActionResult & { field?: CustomFieldDefinition }> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { ok: false, error: 'Give the field a name.' };

  const fieldKey = slugifyFieldKey(trimmedLabel);

  const { data: existing } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('tenant_id', appUser.tenant_id)
    .eq('field_key', fieldKey)
    .maybeSingle();

  if (existing) return { ok: true, field: existing };

  const { data: created, error } = await supabase
    .from('custom_field_definitions')
    .insert({ tenant_id: appUser.tenant_id, field_key: fieldKey, label: trimmedLabel })
    .select('id, field_key, label')
    .single();

  if (error || !created) return { ok: false, error: error?.message ?? 'Could not create that field.' };
  revalidatePath('/contacts');
  return { ok: true, field: created };
}

export async function renameCustomFieldDefinitionAction(id: string, label: string): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { ok: false, error: 'Give the field a name.' };

  // field_key deliberately never changes on rename - it's what every
  // existing person's custom_fields jsonb is keyed by, so changing it would
  // silently orphan every value already stored under the old key.
  const { error } = await supabase.from('custom_field_definitions').update({ label: trimmedLabel }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/contacts');
  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteCustomFieldDefinitionAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/contacts');
  revalidatePath('/settings');
  return { ok: true };
}

export async function markContactFieldsOnboardedAction(): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_settings')
    .update({ contact_fields_onboarded: true })
    .eq('tenant_id', appUser.tenant_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Part request: click-to-edit-in-place on the contacts list, for the fixed
// fields (custom field values go through updatePersonCustomFieldAction
// below, since those merge into a jsonb column instead of a plain update).
export async function updatePersonFieldAction(
  personId: string,
  field: 'first_name' | 'last_name' | 'company' | 'title' | 'email',
  value: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = value.trim();

  if ((field === 'first_name' || field === 'last_name') && !trimmed) {
    return { ok: false, error: 'This field can’t be empty.' };
  }

  const patch: Partial<Record<typeof field, string | null>> = { [field]: trimmed || null };
  const { error } = await supabase
    .from('people')
    .update(patch as Database['public']['Tables']['people']['Update'])
    .eq('id', personId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/contacts');
  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}

export async function updatePersonCustomFieldAction(personId: string, fieldKey: string, value: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: person, error: fetchError } = await supabase
    .from('people')
    .select('custom_fields')
    .eq('id', personId)
    .single();
  if (fetchError || !person) return { ok: false, error: fetchError?.message ?? 'Could not find that contact.' };

  const trimmed = value.trim();
  const existing = (person.custom_fields as Record<string, string>) ?? {};
  const next = { ...existing };
  if (trimmed) next[fieldKey] = trimmed;
  else delete next[fieldKey];

  const { error } = await supabase
    .from('people')
    .update({ custom_fields: next as unknown as Json })
    .eq('id', personId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/contacts');
  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}

export interface SmartMappingResult {
  mapping: Record<number, ColumnTarget>;
  available: boolean;
  reason?: 'not_configured' | 'error';
}

/** The smart-import checking step (Part request: an AI checker that reviews
 * every column and sorts it into the right field before the Host ever sees
 * the mapping screen). Never throws - if the Anthropic key isn't
 * configured, or the model call fails for any reason, `available: false` is
 * returned with an honest reason so the wizard can say so plainly, rather
 * than silently pretending nothing happened. */
export async function suggestColumnMappingAction(headers: string[], sampleRows: string[][]): Promise<SmartMappingResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('field_key, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  const targetFields = [
    ...Object.entries(PERSON_FIELD_LABELS)
      .filter(([key]) => key !== 'ignore')
      .map(([key, label]) => ({ key, label })),
    ...(customFields ?? []).map((f) => ({ key: `custom:${f.field_key}`, label: f.label })),
  ];

  try {
    const result = await suggestColumnMapping({ headers, sampleRows, targetFields });
    const validKeys = new Set(targetFields.map((f) => f.key));
    const mapping: Record<number, ColumnTarget> = {};
    for (const m of result.mappings) {
      if (validKeys.has(m.target)) {
        mapping[m.columnIndex] = m.target as ColumnTarget;
      }
    }
    // The prompt already asks the model not to double-assign a field, but
    // this is the actual guarantee - see dedupeMapping's doc comment for why
    // a duplicate is worse than it looks (silent data loss, not a visible
    // error).
    return { mapping: dedupeMapping(mapping), available: true };
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) return { mapping: {}, available: false, reason: 'not_configured' };
    console.error('suggestColumnMappingAction failed:', err);
    return { mapping: {}, available: false, reason: 'error' };
  }
}

// Part 4.4 / 6.1: editing a person is always free, immediate, and has no
// side effects - it never triggers a send, never touches history.
export async function createPersonAction(formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  if (!firstName || !lastName) {
    return { ok: false, error: 'First and last name are required.' };
  }

  const { error } = await supabase.from('people').insert({
    tenant_id: appUser.tenant_id,
    first_name: firstName,
    last_name: lastName,
    preferred_name: String(formData.get('preferred_name') || '').trim() || null,
    email: String(formData.get('email') || '').trim() || null,
    company: String(formData.get('company') || '').trim() || null,
    title: String(formData.get('title') || '').trim() || null,
    relationship_type_id: String(formData.get('relationship_type_id') || '') || null,
    contact_preference: (String(formData.get('contact_preference') || 'email_ok') as
      | 'email_ok'
      | 'phone_only'
      | 'do_not_contact'),
    summary_note: String(formData.get('summary_note') || '').trim() || null,
    custom_fields: customFieldsFromFormData(formData) as unknown as Json,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/contacts');
  return { ok: true };
}

export async function updatePersonAction(personId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  if (!firstName || !lastName) {
    return { ok: false, error: 'First and last name are required.' };
  }

  const { error } = await supabase
    .from('people')
    .update({
      first_name: firstName,
      last_name: lastName,
      preferred_name: String(formData.get('preferred_name') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      company: String(formData.get('company') || '').trim() || null,
      title: String(formData.get('title') || '').trim() || null,
      relationship_type_id: String(formData.get('relationship_type_id') || '') || null,
      contact_preference: (String(formData.get('contact_preference') || 'email_ok') as
        | 'email_ok'
        | 'phone_only'
        | 'do_not_contact'),
      summary_note: String(formData.get('summary_note') || '').trim() || null,
      custom_fields: customFieldsFromFormData(formData) as unknown as Json,
    })
    .eq('id', personId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}

// Part 3.2 / 4.3: mark inactive rather than delete, so historical events
// keep their integrity. Hard delete remains possible but is a separate,
// explicitly gated action (see deletePersonAction below).
// Thin wrappers matching useFormState's (prevState, formData) signature -
// bind the id with .bind(null, id) to get a compatible action reference.
export async function createPersonFormAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await createPersonAction(formData);
  if (result.ok) redirect('/contacts');
  return result;
}

export async function updatePersonFormAction(
  personId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return updatePersonAction(personId, formData);
}

export async function setPersonActiveAction(personId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('people').update({ is_active: isActive }).eq('id', personId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/contacts');
  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}

export async function deletePersonAction(personId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId);

  if (count && count > 0) {
    return {
      ok: false,
      error: `This person is part of ${count} event ${count === 1 ? 'invitation' : 'invitations'}. Mark them inactive instead to keep your event history intact, or remove them from those events first if you really want to delete.`,
    };
  }

  const { error } = await supabase.from('people').delete().eq('id', personId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/contacts');
  return { ok: true };
}

export async function addPersonNoteAction(personId: string, body: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  if (!body.trim()) return { ok: false, error: 'Note cannot be empty.' };

  const { error } = await supabase.from('notes').insert({
    tenant_id: appUser.tenant_id,
    person_id: personId,
    body: body.trim(),
    created_by: appUser.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}

export async function deletePersonNoteAction(noteId: string, personId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/contacts/${personId}`);
  revalidatePath('/contacts');
  return { ok: true };
}

export async function addPersonNoteFormAction(
  personId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const result = await addPersonNoteAction(personId, String(formData.get('body') || ''));
  return result;
}

export async function mergePeopleAction(keepId: string, mergeAwayId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Re-point invitations and notes from the duplicate onto the kept record,
  // skipping any invitation that would collide with one the kept record
  // already has for the same event (3.10: never silently create duplicate
  // invitations).
  const { data: dupInvitations } = await supabase
    .from('invitations')
    .select('id, event_id')
    .eq('person_id', mergeAwayId);

  const { data: keepInvitations } = await supabase.from('invitations').select('event_id').eq('person_id', keepId);
  const keepEventIds = new Set((keepInvitations ?? []).map((i) => i.event_id));

  for (const inv of dupInvitations ?? []) {
    if (keepEventIds.has(inv.event_id)) continue; // kept record already has this event
    await supabase.from('invitations').update({ person_id: keepId }).eq('id', inv.id);
  }

  await supabase.from('notes').update({ person_id: keepId }).eq('person_id', mergeAwayId);
  const { error } = await supabase.from('people').delete().eq('id', mergeAwayId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${keepId}`);
  return { ok: true };
}

export interface DuplicateCheckResult {
  normalizedEmail: string;
  existingPersonId: string;
  existingName: string;
}

export async function checkDuplicateEmailsAction(emails: string[]): Promise<DuplicateCheckResult[]> {
  const supabase = await createClient();
  const normalized = Array.from(new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean)));
  if (normalized.length === 0) return [];

  const { data } = await supabase
    .from('people')
    .select('id, first_name, last_name, email_normalized')
    .in('email_normalized', normalized);

  return (data ?? []).map((p) => ({
    normalizedEmail: p.email_normalized!,
    existingPersonId: p.id,
    existingName: `${p.first_name} ${p.last_name}`,
  }));
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  flagged: number;
}

export async function commitImportAction(params: {
  rows: MappedPersonRow[];
  dedupeChoice: 'update' | 'skip' | 'keep_both';
}): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { rows, dedupeChoice } = params;

  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  const duplicates = await checkDuplicateEmailsAction(emails);
  const dupByEmail = new Map(duplicates.map((d) => [d.normalizedEmail, d]));

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let flagged = 0;

  for (const row of rows) {
    if (!row.first_name && !row.last_name) {
      skipped++;
      continue;
    }

    const normalizedEmail = row.email?.toLowerCase().trim();
    const dup = normalizedEmail ? dupByEmail.get(normalizedEmail) : undefined;

    let relationshipTypeId: string | null = null;
    if (row.relationship_type_label) {
      const { data: existingType } = await supabase
        .from('relationship_types')
        .select('id')
        .eq('tenant_id', appUser.tenant_id)
        .ilike('label', row.relationship_type_label)
        .maybeSingle();

      if (existingType) {
        relationshipTypeId = existingType.id;
      } else {
        const { data: newType } = await supabase
          .from('relationship_types')
          .insert({ tenant_id: appUser.tenant_id, label: row.relationship_type_label, is_system: false })
          .select('id')
          .single();
        relationshipTypeId = newType?.id ?? null;
      }
    }

    const payload = {
      tenant_id: appUser.tenant_id,
      first_name: row.first_name || '(no first name)',
      last_name: row.last_name || '(no last name)',
      preferred_name: row.preferred_name,
      email: row.email,
      company: row.company,
      title: row.title,
      relationship_type_id: relationshipTypeId,
      summary_note: row.summary_note,
      custom_fields: row.custom_fields as unknown as Json,
    };

    if (dup && dedupeChoice === 'skip') {
      skipped++;
      continue;
    }

    if (dup && dedupeChoice === 'update') {
      // Merge rather than overwrite custom_fields - this import row only
      // carries whatever columns were mapped this time, and shouldn't wipe
      // out other custom field values already on the existing record.
      let updatePayload = payload;
      if (Object.keys(row.custom_fields).length > 0) {
        const { data: existingPerson } = await supabase
          .from('people')
          .select('custom_fields')
          .eq('id', dup.existingPersonId)
          .single();
        updatePayload = {
          ...payload,
          custom_fields: { ...((existingPerson?.custom_fields as Record<string, string>) ?? {}), ...row.custom_fields } as unknown as Json,
        };
      }
      const { error } = await supabase.from('people').update(updatePayload).eq('id', dup.existingPersonId);
      if (error) flagged++;
      else updated++;
      continue;
    }

    // 'keep_both', or no duplicate at all
    const { error } = await supabase.from('people').insert(payload);
    if (error) {
      flagged++;
    } else if (!row.email_valid) {
      flagged++;
      added++;
    } else {
      added++;
    }
  }

  revalidatePath('/contacts');
  return { ok: true, summary: { added, updated, skipped, flagged } };
}
