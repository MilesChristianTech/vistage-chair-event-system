import Link from 'next/link';
import { Download } from 'lucide-react';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import ContactRow from './contact-row';
import DeleteAllButton from './delete-all-button';

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

  const [{ data: relationshipTypes }, { data: customFields }, { data: people }, { count: totalCount }] = await Promise.all([
    supabase.from('relationship_types').select('id, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
    supabase.from('custom_field_definitions').select('id, field_key, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
    // search_people (Part: "search by anything") matches name, company,
    // title, email, relationship type label, the summary note, and any
    // custom field value in one place - shared with the add-invitees search.
    supabase
      .rpc('search_people', {
        p_tenant_id: appUser.tenant_id,
        p_query: q || null,
        p_status: statusFilter,
        p_relationship_type_id: typeFilter || null,
      })
      .limit(200),
    // Unfiltered total, since "Delete all" always acts on the whole
    // database regardless of whatever search/filter is active right now.
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('tenant_id', appUser.tenant_id),
  ]);

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
            <DeleteAllButton totalCount={totalCount ?? 0} />
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
            <p className="text-navy-400 text-xs px-4 pt-2.5">Click any value below to edit it directly.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-navy-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="pl-4 pr-1 py-2.5" />
                    <th className="text-left px-2 py-2.5 font-medium">First Name</th>
                    <th className="text-left px-2 py-2.5 font-medium">Last Name</th>
                    <th className="text-left px-2 py-2.5 font-medium">Company</th>
                    <th className="text-left px-2 py-2.5 font-medium">Title</th>
                    <th className="text-left px-2 py-2.5 font-medium">Email</th>
                    {(customFields ?? []).map((f) => (
                      <th key={f.id} className="text-left px-2 py-2.5 font-medium">
                        {f.label}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {people.map((p) => (
                    <ContactRow
                      key={p.id}
                      person={{ ...p, custom_fields: p.custom_fields as Record<string, string> | null }}
                      customFields={customFields ?? []}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AppPageBody>
    </>
  );
}
