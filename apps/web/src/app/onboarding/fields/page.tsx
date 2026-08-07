import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import OnboardingFieldsClient from './onboarding-fields-client';

export const dynamic = 'force-dynamic';

export default async function OnboardingFieldsPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  return <OnboardingFieldsClient initialFields={customFields ?? []} />;
}
