import { createClient } from '@/lib/supabase/server';
import MarketingLanding from './marketing-landing';

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <MarketingLanding isSignedIn={Boolean(user)} />;
}
