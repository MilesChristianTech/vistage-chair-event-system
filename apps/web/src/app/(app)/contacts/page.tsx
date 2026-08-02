import Link from 'next/link';
import { Download } from 'lucide-react';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import Avatar from '@/components/avatar';
import QuickNoteButton from './quick-note-button';

export const dynamic = 'force-dynamic';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; status?: string };
}) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const q = searchParams?.q?.trim() || '';
  const typeFilter = searchParams?.type || '';
  const statusFilter = searchParams?.status || 'active';

  const { data: relationshipTypes } = await supabase
    .from('relationship_types')
    .select('id, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  // search_people (Part: "search by anything") matches name, company,
  // title, email, relationship type label, the summary note, and any
  // custom field value in one place - shared with the add-invitees search.
  const { data: people } = await supabase
    .rpc('search_people', {
      p_tenant_id: appUser.tenant_id,
      p_query: q || null,
      p_status: statusFilter,
      p_relationship_type_id: typeFilter || null,
    })
    .limit(200);
  const typeLabel = new Map((relationshipTypes ?? []).map((t) => [t.id, t.label]));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (typeFilter) exportParams.set('type', typeFilter);
  if (statusFilter) exportParams.set('status', statusFilter);
  const exportHref = `/api/contacts/export${exportParams.toString() ? `?${exportParams}` : ''}`;

  return (
    <>
      <AppPageHeader
        title="Contacts"
        description="The people in your world - reused across every event."
        actions={
          <>
            <a href={exportHref} className="btn-secondary">
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Export CSV
            </a>
            <Link href="/contacts/import" className="btn-secondary">
              Import contacts
            </Link>
            <Link href="/contacts/new" className="btn-primary">
              + Add person
            </Link>
          </>
        }
      />
      <AppPageBody>
        <form className="flex flex-wrap items-center gap-3 mb-5" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, company, title, type, notes, or any custom field"
            className="input max-w-sm"
          />
          <select name="type" defaultValue={typeFilter} className="input max-w-[220px]">
            <option value="">All relationship types</option>
            {(relationshipTypes ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={statusFilter} className="input max-w-[160px]">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
        </form>

        {!people || people.length === 0 ? (
          <div className="card p-10 text-center">
            <h2 className="text-navy-900">{q || typeFilter ? 'No matches' : 'No contacts yet'}</h2>
            <p className="text-navy-500 text-sm mt-2 mb-5">
              {q || typeFilter
                ? 'Try a different search or clear your filters.'
                : 'Import a spreadsheet to get your address book in fast, or add people one at a time.'}
            </p>
            {!q && !typeFilter ? (
              <Link href="/contacts/import" className="btn-primary">
                Import contacts
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-navy-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Company / Title</th>
                  <th className="text-left px-4 py-2.5 font-medium">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Contact pref.</th>
                  <th className="text-left px-4 py-2.5 font-medium">Quick note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {people.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className="animate-fade-up hover:bg-navy-50 transition-colors duration-150"
                  >
                    <td className="px-4 py-2.5">
                      <Link href={`/contacts/${p.id}`} className="flex items-center gap-2.5">
                        <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                        <span className="font-medium text-navy-900">
                          {p.first_name} {p.last_name}
                        </span>
                      </Link>
                      {p.preferred_name ? <span className="text-navy-400 text-xs"> ({p.preferred_name})</span> : null}
                      {!p.is_active ? <span className="badge-neutral ml-2">Inactive</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600">
                      {p.company || <span className="text-navy-300">-</span>}
                      {p.title ? <span className="text-navy-400"> · {p.title}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600">
                      {p.email || <span className="text-danger text-xs">No email on file</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.relationship_type_id ? (
                        <span className="badge-neutral">{typeLabel.get(p.relationship_type_id) ?? '-'}</span>
                      ) : (
                        <span className="text-navy-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ContactPrefBadge pref={p.contact_preference} />
                    </td>
                    <td className="px-4 py-2.5">
                      <QuickNoteButton personId={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppPageBody>
    </>
  );
}

function ContactPrefBadge({ pref }: { pref: string }) {
  if (pref === 'do_not_contact') return <span className="badge-danger">Do not contact</span>;
  if (pref === 'phone_only') return <span className="badge-warn">Phone only</span>;
  return <span className="badge-success">Email ok</span>;
}
