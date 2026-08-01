import { LegalPage, LegalSection } from '@/components/legal-page';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection title="What this service is">
        The Chair Event System (“the Service”) is a tool provided by the operator (“we,” “us”) that helps you (“the
        Host,” “you”) manage contacts, create events, draft invitations, collect RSVPs, and send email through your
        own connected email account.
      </LegalSection>
      <LegalSection title="Your account">
        Access is by invitation only. We create your account directly; there is no public sign-up. You’re
        responsible for keeping your password confidential and for anything done under your account.
      </LegalSection>
      <LegalSection title="Your data">
        Your contacts, events, drafts, and responses belong to you. We do not sell it, share it with other Hosts, or
        use it for our own marketing. It is technically isolated from every other Host’s data — see our Privacy
        Policy for detail.
      </LegalSection>
      <LegalSection title="Sending email on your behalf">
        When you connect your Microsoft account, you are authorizing the Service to send email from your mailbox —
        including while you are not actively using the Service — strictly as part of the events you create and
        explicitly approve. We never send anything without your prior review and approval of the message content.
      </LegalSection>
      <LegalSection title="Acceptable use">
        You agree to use the Service to send genuine, honest invitations to people you have a legitimate reason to
        contact, and not to use it for unsolicited bulk email, deceptive content, or any purpose that would violate
        applicable law.
      </LegalSection>
      <LegalSection title="Availability and liability">
        The Service is provided “as is.” We work to keep sending durable and reliable, but we do not guarantee
        uninterrupted availability, and we are not liable for indirect or consequential damages arising from your use
        of the Service, to the maximum extent permitted by law.
      </LegalSection>
      <LegalSection title="Termination">
        Either party may end the arrangement at any time. On termination, we will provide a reasonable window to
        export your data before deletion.
      </LegalSection>
      <LegalSection title="Changes">
        We’ll notify you of material changes to these terms before they take effect.
      </LegalSection>
      <LegalSection title="Contact">hello@chaireventsystem.com</LegalSection>
    </LegalPage>
  );
}
