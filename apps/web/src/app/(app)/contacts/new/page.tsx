import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import PersonForm from '../person-form';
import { createPersonFormAction } from '../actions';

export default async function NewContactPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: relationshipTypes } = await supabase
    .from('relationship_types')
    .select('id, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  return (
    <>
      <AppPageHeader title="Add a person" description="They'll be available to invite to any event, right away." />
      <AppPageBody>
        <PersonForm action={createPersonFormAction} relationshipTypes={relationshipTypes ?? []} submitLabel="Add person" />
      </AppPageBody>
    </>
  );
}
