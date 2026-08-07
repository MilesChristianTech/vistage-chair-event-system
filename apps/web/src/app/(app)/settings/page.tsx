import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser, getTenantSettings, getMailboxConnection } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import FieldsManager from '@/components/fields-manager';
import MailboxCard from './mailbox-card';
import HostProfileForm from './host-profile-form';
import BrandingForm from './branding-form';
import ChangePasswordForm from './change-password-form';
import AdvancedSettingsForm from './advanced-settings-form';
import VoiceSamplesForm from './voice-samples-form';
import MailboxOAuthToast from './mailbox-oauth-toast';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const [settings, mailbox, { data: customFields }] = await Promise.all([
    getTenantSettings(appUser.tenant_id),
    getMailboxConnection(appUser.tenant_id),
    supabase.from('custom_field_definitions').select('id, field_key, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
  ]);

  return (
    <>
      <AppPageHeader title="Settings" description="Connections, branding, and your account." />
      <AppPageBody>
        <MailboxOAuthToast />
        <div className="max-w-2xl space-y-6">
          <section className="card p-5">
            <h3>Email connection</h3>
            <p className="text-navy-500 text-sm mb-4">
              Invitations send through your own Outlook mailbox, so recipients see a genuine personal email from you.
            </p>
            <MailboxCard mailbox={mailbox} />
          </section>

          <section className="card p-5">
            <h3>Your name & signature</h3>
            <p className="text-navy-500 text-sm mb-4">Used in greetings and message sign-offs across every event.</p>
            <HostProfileForm initial={settings} />
          </section>

          <section className="card p-5">
            <h3>Coach voice samples</h3>
            <VoiceSamplesForm initial={settings?.voice_samples ?? []} />
          </section>

          <section className="card p-5">
            <h3>Contact fields</h3>
            <p className="text-navy-500 text-sm mb-4">
              What matters to you about a contact, beyond the basics - shown as columns on your Contacts list and
              offered automatically when you import a spreadsheet.
            </p>
            <FieldsManager initialFields={customFields ?? []} />
          </section>

          <section className="card p-5">
            <h3>Branding</h3>
            <p className="text-navy-500 text-sm mb-4">
              Applied to your RSVP forms by default - the Host’s events feel like theirs.
            </p>
            <BrandingForm initial={settings?.branding as { logoUrl?: string; accentColor?: string; primaryColor?: string } | null} />
          </section>

          <details className="card p-5">
            <summary className="cursor-pointer text-navy-800 font-medium">Advanced</summary>
            <div className="mt-4">
              <AdvancedSettingsForm initial={settings} />
            </div>
          </details>

          <section className="card p-5">
            <h3>Change password</h3>
            <ChangePasswordForm />
          </section>
        </div>
      </AppPageBody>
    </>
  );
}
