import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser, getTenantSettings, getMailboxConnection } from '@/lib/tenant';
import MailboxCard from './mailbox-card';
import HostProfileForm from './host-profile-form';
import BrandingForm from './branding-form';
import ChangePasswordForm from './change-password-form';
import AdvancedSettingsForm from './advanced-settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { ms_connected?: string; ms_error?: string };
}) {
  const { appUser } = await requireCurrentUser();
  const [settings, mailbox] = await Promise.all([getTenantSettings(appUser.tenant_id), getMailboxConnection(appUser.tenant_id)]);

  return (
    <>
      <AppPageHeader title="Settings" description="Connections, branding, and your account." />
      <AppPageBody>
        <div className="max-w-2xl space-y-6">
          {searchParams.ms_connected ? (
            <div className="rounded border border-success/30 bg-success-bg text-success text-sm px-4 py-3">
              Your Microsoft account is connected.
            </div>
          ) : null}
          {searchParams.ms_error ? (
            <div className="rounded border border-danger/30 bg-danger-bg text-danger text-sm px-4 py-3">
              {searchParams.ms_error === 'not_configured'
                ? "Microsoft sign-in isn't set up yet — this is a one-time step for the operator (see the Owner Setup Checklist)."
                : "Couldn't connect your Microsoft account. Please try again."}
            </div>
          ) : null}

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
            <h3>Branding</h3>
            <p className="text-navy-500 text-sm mb-4">
              Applied to your RSVP forms by default — the Host's events feel like theirs.
            </p>
            <BrandingForm initial={settings?.branding as { logoUrl?: string; headerImageUrl?: string; accentColor?: string; primaryColor?: string } | null} />
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
