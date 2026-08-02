import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import ImportWizard from './import-wizard';

export default async function ImportContactsPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: customFieldDefinitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  return (
    <>
      <AppPageHeader title="Import contacts" description="Drop in a spreadsheet - no template required." />
      <AppPageBody>
        <ImportWizard customFieldDefinitions={customFieldDefinitions ?? []} />
      </AppPageBody>
    </>
  );
}
