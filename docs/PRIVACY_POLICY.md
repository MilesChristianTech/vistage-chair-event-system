# Privacy Policy (Placeholder)

> **This is a placeholder, not a legal document.** As with the Terms of Service, have a qualified attorney review and finalize real privacy documentation before onboarding paying Hosts beyond the single pilot (Part 11.4). This text is written to be honest about what the system in this repository actually does, so treat any change to the code's behavior as a reason to update this document too.

**Last updated:** placeholder — update this date when a real policy is adopted.

## What we store

For each Host: contact records you provide or import (name, email, company, title, relationship notes), events you create, message drafts, RSVP form responses, and engagement signals (approximate email-open and link-click indicators — see the note on accuracy below). For each invitee who responds to a form: whatever they submit (name, email, RSVP answer, and any optional fields the Host has added to that event's form).

## What we don't do

We do not sell your data. We do not share one Host's data with another Host. We do not use your contacts or event data for our own marketing or for training any third-party model beyond what's needed to generate your own drafts (see below). Isolation between Hosts is enforced at the database level, not just in application code (see `docs/DATA_MODEL.md` for the technical detail, if you want it).

## Sending email on your behalf

If you connect a Microsoft account, we store an encrypted authorization token that lets our server send email through your mailbox as part of events you create and approve — including while you're not present, which is what allows a large send to complete over several hours without you keeping a browser open. This token is encrypted at rest and is never exposed to any browser.

## The writing assistant

When you use the Invitation Coach, the event details and draft text you're working on are sent to Anthropic's API to generate or refine a draft. Your private notes about a person are **never** included in this unless you explicitly choose to supply them for a specific message (Part 5.4/5.5 of the build spec). We do not send your full contact list to any AI service.

## Engagement signals are approximate

Email open and link-click tracking is inherently imprecise — privacy features in modern mail clients and corporate mail scanners both create false positives. We show these to you as soft signals, never as guarantees, and you should not treat them as certain.

## Data retention and deletion

Contact records can be marked inactive (retained, hidden from active views) or deleted outright at your request; deleting a person who is part of event history is a deliberate, confirmed action. Raw form submissions are preserved even if a Host later corrects how a response was matched, so historical accuracy is maintained. [Placeholder — specify your actual backup retention window and deletion SLA.]

## Your invitees' rights

If you are an invitee (not a Host) and want your information corrected or removed, contact the Host who invited you — they control that data. [Placeholder — add a direct contact path if you want to handle these requests centrally.]

## Contact

[Operator contact information]
