'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_LABELS: Record<string, string> = {
  attendance: 'Will you be able to attend?',
  guest_count: 'How many guests will you bring?',
  guest_names: "Your guest's name(s)",
  dietary_accessibility: 'Any dietary or accessibility needs we should know about?',
  open_text: 'What would make this event especially valuable to you?',
  short_text: 'Your answer',
  yes_no: 'Yes or no',
};

export async function addQuestionAction(formId: string, questionType: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('form_questions')
    .select('sort_order')
    .eq('form_id', formId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('form_questions').insert({
    tenant_id: appUser.tenant_id,
    form_id: formId,
    question_type: questionType,
    label: DEFAULT_LABELS[questionType] ?? 'New question',
    is_required: questionType === 'attendance',
    sort_order: nextOrder,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events`, 'layout');
  return { ok: true };
}

export async function updateQuestionAction(
  questionId: string,
  fields: { label?: string; help_text?: string | null; is_required?: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('form_questions').update(fields).eq('id', questionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteQuestionAction(questionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('form_questions').delete().eq('id', questionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderQuestionsAction(orderedIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  await Promise.all(orderedIds.map((id, index) => supabase.from('form_questions').update({ sort_order: index }).eq('id', id)));
  return { ok: true };
}

export async function updateFormMetaAction(
  formId: string,
  fields: { intro_text?: string; confirmation_text?: string; theme?: Record<string, unknown> }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('forms').update(fields).eq('id', formId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function publishFormAction(formId: string, publish: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('forms')
    .update({ is_published: publish, published_at: publish ? new Date().toISOString() : null })
    .eq('id', formId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
