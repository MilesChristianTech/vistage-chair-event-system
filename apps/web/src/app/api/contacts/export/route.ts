import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';
import { toCsv } from '@/lib/csv';

const CONTACT_PREFERENCE_LABELS: Record<string, string> = {
  email_ok: 'Email is fine',
  phone_only: 'Phone only',
  do_not_contact: 'Do not contact',
};

/**
 * Exports the Host's contacts as a CSV file, honoring whatever
 * search/type/status filter is active on the Contacts page — "export what
 * I'm looking at," not a separate hidden dataset. Authenticated via the
 * normal session-scoped client (RLS applies), same as every other page.
 */
export async function GET(request: NextRequest) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  const typeFilter = request.nextUrl.searchParams.get('type') || '';
  const statusFilter = request.nextUrl.searchParams.get('status') || 'active';

  const { data: relationshipTypes } = await supabase
    .from('relationship_types')
    .select('id, label')
    .eq('tenant_id', appUser.tenant_id);
  const typeLabel = new Map((relationshipTypes ?? []).map((t) => [t.id, t.label]));

  let query = supabase
    .from('people')
    .select(
      'first_name, last_name, preferred_name, email, company, title, relationship_type_id, contact_preference, is_active, summary_note'
    )
    .order('last_name', { ascending: true });

  if (statusFilter === 'active') query = query.eq('is_active', true);
  if (statusFilter === 'inactive') query = query.eq('is_active', false);
  if (typeFilter) query = query.eq('relationship_type_id', typeFilter);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: people, error } = await query.limit(10_000);
  if (error) {
    return NextResponse.json({ error: 'Could not export contacts right now.' }, { status: 500 });
  }

  const csv = toCsv(
    ['First Name', 'Last Name', 'Preferred Name', 'Email', 'Company', 'Title', 'Relationship Type', 'Contact Preference', 'Status', 'Notes'],
    (people ?? []).map((p) => [
      p.first_name,
      p.last_name,
      p.preferred_name,
      p.email,
      p.company,
      p.title,
      p.relationship_type_id ? (typeLabel.get(p.relationship_type_id) ?? '') : '',
      CONTACT_PREFERENCE_LABELS[p.contact_preference] ?? p.contact_preference,
      p.is_active ? 'Active' : 'Inactive',
      p.summary_note,
    ])
  );

  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
