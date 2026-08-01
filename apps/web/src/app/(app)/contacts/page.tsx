import Link from 'next/link';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import Avatar from '@/components/avatar';

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

  let query = supabase
    .from('people')
    .select('id, first_name, last_name, preferred_name, email, company, title, contact_preference, is_active, relationship_type_id')
    .order('last_name', { ascending: true });

  if (statusFilter === 'active') query = query.eq('is_active', true);
  if (statusFilter === 'inactive') query = query.eq('is_active', false);
  if (typeFilter) query = query.eq('relationship_type_id', typeFilter);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: people } = await query.limit(200);
  const typeLabel = new Map((relationshipTypes ?? []).map((t) => [t.id, t.label]));

  return (
    <>
      <AppPageHeader
        title="Contacts"
        description="The people in your world — reused across every event."
        actions={
          <>
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
            placeholder="Search by name, company, or email"
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
                      <Link href={`/contacts/${p.id}`} className="flex items-center gap-2.5 no-underline group">
                        <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                        <span className="font-medium text-navy-900 group-hover:underline">
                          {p.first_name} {p.last_name}
                        </span>
                      </Link>
                      {p.preferred_name ? <span className="text-navy-400 text-xs"> ({p.preferred_name})</span> : null}
                      {!p.is_active ? <span className="badge-neutral ml-2">Inactive</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600">
                      {p.company || <span className="text-navy-300">—</span>}
                      {p.title ? <span className="text-navy-400"> · {p.title}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600">
                      {p.email || <span className="text-danger text-xs">No email on file</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.relationship_type_id ? (
                        <span className="badge-neutral">{typeLabel.get(p.relationship_type_id) ?? '—'}</span>
                      ) : (
                        <span className="text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ContactPrefBadge pref={p.contact_preference} />
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
