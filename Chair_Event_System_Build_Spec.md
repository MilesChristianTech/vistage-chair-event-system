# CHAIR EVENT SYSTEM — MASTER BUILD SPECIFICATION

**A single-surface, professionally hosted application for executive-event invitation, RSVP, and relationship management.**

Version 1.0 · Build brief for Claude Code · Prepared for Miles Herr

---

## HOW TO USE THIS DOCUMENT

This is the authoritative specification for building the Chair Event System as a standalone, cloud-hosted web application. It replaces an earlier Microsoft 365 approach entirely — there is no Excel, no Microsoft Forms, and no Power Automate in this product. Everything those tools did is now handled inside one app, better.

This document specifies **what to build and why** — the business logic, product behavior, data relationships, safety rules, and user experience. It deliberately does **not** dictate implementation code. Claude Code should make sound engineering decisions within the constraints defined here, and return to this document as the source of truth whenever a question of intent arises.

**The governing rule:** when a detail is unspecified, choose the option that best serves the primary user — a commercially sophisticated but low-technology-confidence event host — and that keeps the product calm, reliable, and impossible to accidentally break. Do not pause for routine clarification. Build a complete, polished, testable product and clearly document any point that genuinely requires a human decision, an API key, or an external connection.

**Anything requiring the owner's manual action** (API keys, domain verification, OAuth app registration, host configuration, billing setup) must be collected into a single clearly labeled "Owner Setup Checklist" deliverable so nothing is buried.

---

## PART 1 — PRODUCT VISION AND FIRST PRINCIPLES

### 1.1 What this product is

The Chair Event System is a single web application that lets one person — referred to throughout as **the Host** — run the entire lifecycle of a high-value executive event without touching any other software. The Host maintains a contact list, creates an event, chooses who to invite, drafts a personal invitation with the help of an embedded writing assistant, builds and hosts a custom RSVP form, sends the invitation individually to every invitee through the Host's own email account, watches responses and engagement arrive in real time, and manages follow-up — all in one place, with one coherent, elegant interface.

The product exists to make a personal, high-touch, relationship-driven outreach process feel effortless at scale. The Host is not a marketer running a campaign; the Host is a respected convener personally inviting peers to something worthwhile. Every design decision serves that framing.

### 1.2 The person we are building for

The primary user is an experienced executive coach, connector, and relationship-builder — often 55 or older — who is commercially sophisticated and socially fluent but not technically confident. They are excellent at judgment, credibility, and personal outreach, and anxious about "breaking" software. They will use this app intermittently: intensely around an event, then not at all for weeks. When they return, they must feel immediately oriented, never lost.

Design implications that flow from this and apply everywhere:

- The interface must feel **familiar**, not novel. It should quietly echo the professional software environment this user already knows (the Microsoft 365 world), rather than presenting an avant-garde aesthetic they have to learn. Familiarity is safety for this user.
- Nothing may be a dead end. Every screen has an obvious way forward and an obvious way back.
- Nothing consequential may happen by accident, yet nothing may be mysteriously locked.
- Instructions and labels are plain-language, task-based, and reassuring without being patronizing.
- The user must never wonder "why is that still there," "why can't I change this," or "what is this doing behind my back."

### 1.3 The recipient we are respecting

The end recipient of every invitation is a CEO, president, founder, owner, or senior executive — time-poor, interruption-rich, protective of their calendar, and skeptical of sales-flavored events. The product's communications must earn attention honestly: establish personal relevance quickly, state genuine value clearly, make responding frictionless, and never resort to hype, false urgency, manufactured scarcity, or manipulation. Respecting the recipient is both an ethical commitment and the reason the Host's events convert well.

### 1.4 First principles (the product's constitution)

These principles govern every feature and every judgment call. When two requirements seem to conflict, resolve toward these.

1. **One surface.** The Host never switches tools, never wonders where something "lives," never manages infrastructure. Contacts, events, drafting, forms, sending, and tracking are all inside this one app.

2. **Calm by default, editable on intent.** Screens look clean and uncluttered at rest. Anything the Host can see, they can change — but the controls appear when reached for, not cluttering the surface when idle. The app feels serene but nothing is actually locked.

3. **Personal at scale.** The Host writes an invitation once, and every recipient receives something that feels individually written and sent. The entire value proposition collapses if the Host is forced back into manual copy-paste personalization. The app carries the burden of making one message feel like many.

4. **Nothing breaks by accident; anything is possible on purpose.** Editing data is always free and reversible. Actions with real-world consequences (sending, publishing, deleting mid-event) are gated behind calm, plain-language confirmations that state the consequence. The app understands what depends on what, and surfaces a dependency only when an edit would actually cause a problem.

5. **Durable over fragile.** Long-running work (especially sending) survives closed laptops, dead batteries, dropped connections, server restarts, and code deploys. The Host can walk away and trust the work continues.

6. **Honest signals.** Engagement data (opens, clicks, form views) is shown as soft, probabilistic signal, never as surveillance-grade certainty, with a plain clarifying note wherever it appears.

7. **The Host is always the final authority.** Anything the app decides or suggests — a duplicate match, a recommended next action, a generated draft — is always overridable. Human judgment wins.

8. **Data stays the customer's.** Each Host's data is theirs, isolated from every other Host's, never used for the operator's marketing, never shared. This is enforced technically and stated plainly in policy.

9. **Built for one, architected for many.** The pilot serves a single Host, but the data model and infrastructure are multi-tenant from day one so additional Hosts can be added later without a rebuild.

### 1.5 What "outstanding" means (the acceptance test for the whole product)

The Host should be able to open the app weeks after last using it, immediately see what needs their attention, confidently send something that looks better than they could have made by hand, watch it reach real inboxes rather than spam folders, and feel that the technology supports their relationships rather than getting between them and the people they're inviting. If the product achieves that feeling, it succeeds.

---

## PART 2 — SYSTEM ARCHITECTURE

### 2.1 The shape of the system

The product is composed of four cooperating pieces. Claude Code should treat this separation as fixed, because it is what makes durability and multi-tenancy work.

1. **The application** — the interface the Host uses, plus the server logic behind it. This is where every screen, every workflow, and every ordinary request-response interaction lives. Recommended: a Next.js (React + TypeScript) application. This is the piece hosted on a serverless-style platform (Vercel is the recommended host).

2. **The database** — the single source of truth for all data: contacts, events, invitations, drafts, form definitions, responses, engagement signals, and — critically — the exact status of every individual email in every send. Recommended: **Supabase** (managed PostgreSQL), which also provides authentication, row-level security for tenant isolation, and file storage for whitelabel images. The owner is already fluent in Supabase; use it.

3. **The send worker** — a small, always-on background process whose entire job is to work through the queue of scheduled emails on time, send each through the correct Host's mailbox, and record the result. This must run on a host that keeps long-lived processes alive (Railway is the recommended host; the owner is already fluent in it). This piece is separate from the application precisely because sends can span hours or days and must not depend on any user's browser or the serverless request lifecycle.

4. **External services the system connects to** — Microsoft Graph (for connecting each Host's Outlook/Microsoft 365 mailbox and sending on their behalf), and the Anthropic API (for the invitation writing assistant and the anti-spam message-variation generator).

### 2.2 Why the send worker is separate — and what it guarantees

This is the single most important architectural decision in the product, so it is stated in full.

Sending a large executive invitation list is not instant. To stay comfortably within a personal mailbox's limits and to read as a human sending individual notes rather than a machine blasting, sends are deliberately paced (see Part 7). A 500-recipient event therefore takes from roughly an hour to, at the Host's choice, a day or two. Over that span it is not merely likely but expected that the Host's computer will be closed, asleep, or offline.

Therefore sending cannot live in the Host's browser or in a short-lived serverless function. It must be a server-side process that runs regardless of whether any human is present. The design that makes this bulletproof:

- The **database holds the complete, authoritative state** of every send: for each recipient, whether their email is queued, sent, failed, or cancelled, and exactly when it is due to go out.
- The **worker holds nothing important in its own memory.** It repeatedly asks the database "which email is due next, and is it time yet?", sends that one, and immediately writes the result back before moving on.
- Because the worker's memory is disposable, **any interruption is harmless.** If the worker crashes, is restarted by the host, or is replaced by a code deploy mid-send, it resumes from the database at the exact next unsent recipient. No recipient is ever sent to twice, and none is skipped.
- The **Host's browser is only a window** onto this process. Closing it, losing connection, or shutting the laptop has zero effect on sending. When the Host reopens the app, it simply reads current progress from the database and displays it.

The Host must be told, clearly and once, at the moment of sending, that they can close the app and the sending will continue — and equally that this is safe. But the system must never actually depend on them keeping it open.

### 2.3 Multi-tenancy (built now, populated later)

Every piece of data in the system is tagged with the Host it belongs to (its tenant). Data isolation is enforced at the database level (row-level security), so it is structurally impossible for one Host's queries to ever return another Host's data — this is not merely an application-layer check that a bug could bypass, but a guarantee enforced by the database itself.

For the pilot, exactly one Host exists. But the schema, the authentication, the isolation, and the send queue are all built as if there will be many. Adding a second Host later is an onboarding task, not an engineering project. Specifically: the send worker operates on a single shared queue of individual emails across all tenants (see Part 7.6), so multiple Hosts sending simultaneously interleave naturally and never block one another — and because each Host sends through their own mailbox, they never compete for a shared sending resource.

### 2.4 What must be true about running costs and operation

The operator runs this as a small SaaS, solo. The architecture must therefore keep fixed monthly infrastructure cost low (a persistent worker plus a managed database plus app hosting should total a low fixed amount at pilot scale) and keep operational burden minimal. Favor managed services over self-administered infrastructure everywhere. Every recurring operational task the operator would otherwise have to perform by hand is a defect to be designed out.

### 2.5 Access, accounts, and the sign-in experience

This product is a **web application**, not a native app — each Host reaches it at a web address, signs in through the browser, and uses it from anywhere. It is **not** a public, self-service product in Version 1. There is no public marketing site, no pricing page, no self-serve signup, and no way for a stranger to create an account. Access is closed by default and granted only by the operator.

**The sign-in landing (minimal, branded).** The app's front door is a single, clean, branded sign-in screen — the product name and a calm, professional sign-in form in the product's design language (Part 10), and nothing else. No marketing copy, no feature list, no pricing, no "create account" option. It should look finished and trustworthy enough that a Host could see it without embarrassment, but it exists only to let an authorized person in. Anyone who reaches the URL without credentials sees only this sign-in screen and can go no further.

**Operator-provisioned accounts only.** Accounts are created by the operator directly on the backend (in the database / auth layer) — the operator sets each Host's username (email) and password by hand. There is no in-app signup, no public invite flow, and no self-registration in V1. A person can only sign in if the operator has already created their account. This keeps the pilot completely closed and private, and matches the "onboard one Host by hand" scope.

**Fully blocked to everyone else.** Every part of the app beyond the sign-in screen requires a valid, operator-provisioned session. Unauthenticated visitors can reach nothing but the sign-in screen. There must be no publicly reachable data, no open API surface that returns tenant data without authentication, and no bypass. Combined with the database-level tenant isolation (2.3), this means an unauthorized visitor sees a locked front door and nothing behind it.

**A demo account for the operator.** The operator has a dedicated **demo account** (its own username and password, provisioned the same way) that signs into a self-contained demo tenant pre-populated with realistic but entirely fictional sample data — sample contacts, a sample event, a sample invitation and form, and sample responses — so the operator can sign in and show the full product to a prospective Host without touching any real Host's data. Requirements for the demo account:

- It is a normal tenant like any other, fully isolated from every real Host's data by the same row-level rules. It simply happens to contain sample data.
- Its data is clearly fictional (obviously fake names, `@example.com`-style addresses) so it can never be confused with real people.
- **Sending is safe in demo.** The demo account must never send real email to anyone. Either the mailbox connection is absent (so the pre-flight check simply blocks real sends and explains why), or sends in the demo tenant are simulated/sandboxed so the operator can demonstrate the full send experience — pacing, progress view, variants — without a single real message going out. Choose whichever is simpler to build reliably, but a real email must never leave the demo account.
- The demo tenant should be easy for the operator to reset to its clean sample state, so every demo starts fresh.

**Session and security basics.** Sessions are secure and time-limited; passwords are stored using proper hashing (never in plaintext, never recoverable); sign-in is protected against brute-force attempts with sensible rate limiting; and a Host can sign out. Password reset in V1 can be operator-handled (the operator sets a new password on the backend) rather than a public self-serve reset flow, keeping the surface closed — though a simple authenticated "change my password" control in Settings is welcome.

**Later, not now.** Self-serve signup, a public marketing/landing site, billing and subscription management, and an operator admin console for creating Hosts through a UI are all deliberately deferred (Part 13). V1's closed, hand-provisioned model is correct for the pilot and must not be expanded into a public product without deliberate later work.


---

## PART 3 — THE DATA MODEL (BUSINESS MEANING)

This section describes the entities the system tracks and how they relate, in business terms. Claude Code should design the actual schema, keys, indexes, and constraints, but must preserve these relationships and rules. Every entity below belongs to exactly one tenant (Host).

### 3.1 The core entities and how they relate

There are four primary objects, and the whole product is organized around them:

- **People** — the Host's relationships. The CRM.
- **Events** — the gatherings the Host is organizing.
- **Invitations** — the link between a Person and an Event. One per person per event. This is where a specific individual's status *for a specific event* lives.
- **Responses & Signals** — what came back: form submissions and engagement signals, attached to invitations.

Around these sit supporting objects: **Messages/Drafts** (the invitation content and its variants), **Forms** (the hosted RSVP form definitions), **Notes** (contextual annotations that can attach to people, events, or invitations), and **Send Jobs** (the record of a bulk send in progress or completed).

### 3.2 People (the CRM)

A Person represents one human in the Host's world — a member, prospect, past guest, referral partner, speaker, spouse, or other relationship. Business rules and required behavior:

- A Person exists independently of any event. People accumulate over time and are reused across events.
- Core identity fields: first name, last name, an optional preferred/greeting name, email, company, title, and a relationship type (member, prospect, alumnus, referral partner, speaker, guest, spouse, other — this list must be editable by the Host, not hardcoded as immutable).
- Email is the primary way a person is matched to their form responses, so it matters, but a Person may exist without an email (e.g., a phone-only contact) — the app simply cannot email that person until one is added, and should indicate that gently rather than treating it as an error.
- A normalized form of the email (lowercased, trimmed) is maintained internally for reliable matching. The Host never sees or manages this; it is plumbing.
- **Notes are first-class and contextual** (see 3.7). A Person carries their own notes and, more importantly, an interaction timeline.
- A Person has an **interaction timeline**: a chronological record of every event they were invited to, how they responded, whether they attended, and every note ever attached to them. This timeline is the relationship memory that makes high-quality hosting possible and is one of the most valuable things in the app. It must be easy to read at a glance and assembled automatically from the person's history — the Host should never have to build it manually.
- A Person can be marked inactive rather than deleted, so historical events retain their integrity. Deletion is possible but is a gated, consequence-stated action, especially if the person is part of any event's history.
- Contact preference / consent is tracked (email is fine / phone only / do not contact), and the app must honor it — never queue an email to someone marked do-not-contact, and warn if the Host tries.
- A "last updated" timestamp is maintained for hygiene.

### 3.3 Events

An Event represents one gathering. Business rules:

- An Event carries everything needed to describe and run it: an internal name and a public-facing title (which may differ), a type (executive roundtable, speaker dinner, member/guest event, social or spouse event, workshop, other — editable list), its purpose, its intended audience, its value proposition, speaker/facilitator details, precise date/time with time zone, venue with address and parking or a virtual link, capacity, and an RSVP deadline.
- An Event has a lifecycle status: draft, inviting, closed (deadline passed or Host closed it), completed (event happened), or cancelled. Status drives what the app shows and suggests.
- An Event owns exactly one RSVP form (see 3.6) and one invitation message with its variants (see 3.5). These are born attached to the event; the Host never manages them as free-floating objects.
- Capacity is used to compute remaining seats, drive waitlist behavior, and warn on overage — but never to auto-decline anyone or send anything deceptive.
- Editing an event's core facts (like the date) should ripple helpfully to everywhere those facts are *displayed* (the form, the dashboard, future/unsent emails), because that is obviously what the Host intends. It must NOT retroactively alter emails already sent (see Part 6 on the edit/consequence model).

### 3.4 Invitations (Person × Event)

An Invitation is the heart of per-person, per-event state. Exactly one exists for each person invited to each event; the same person can have many invitations across many events, each independent.

An Invitation tracks:

- Which Person and which Event it links.
- An audience segment label the Host can use to group invitees (e.g., priority, member, prospect, guest, referral) — useful for follow-up targeting.
- An optional per-person personalization note — the "handwritten touch" line the Host may add for this individual for this event (see Part 5.4). Optional by design; most invitations won't have one.
- Invite status: planned, ready to send, sent, held (Host chose to hold this one back), bounced, withdrawn.
- The RSVP status: no response, yes, no, maybe, waitlisted, cancelled.
- Response date, guest count and guest names, and any dietary or accessibility needs collected.
- Attendance status after the event: unknown, attended, no-show, cancelled.
- Which reminders and final-details messages have been sent to this person, and when.
- A calculated, plain-language **next action** recommendation (e.g., "priority invitee, no response — consider a personal nudge").
- A **Host override** field: whenever the Host manually sets a status or next action, that manual value takes precedence over any calculated value and is never silently overwritten. If a calculation would contradict a Host override, the override wins and the app may gently flag the conflict rather than resolving it itself.

### 3.5 Messages, drafts, and variants

Each Event has one invitation message, authored once by the Host with the writing assistant. But for deliverability at volume, the system may generate multiple **variants** of that message — semantically identical, differently worded (see Part 7.5). Business rules:

- The Host authors and owns the canonical message. Variants are derived from it.
- The Host can view every variant, edit any of them, and regenerate them. Variants are never hidden — the Host can always see exactly what versions exist and what each says.
- Merge fields (greeting name, event details, form link, host signature, etc.) resolve per-recipient at send time. A missing preferred name falls back gracefully to first name; the app must never send a blank or malformed greeting.
- The system also holds the other message types an event needs: reminder, priority follow-up, RSVP confirmation, final-details/logistics, waitlist, cancellation/change, post-event thank-you, and post-event follow-up for no-shows or those who declined (without guilt). These are generated and edited through the same assistant-driven flow.
- Every message the assistant produces is marked as a draft requiring the Host's explicit approval before anything sends. Nothing is ever sent automatically or without human approval.

### 3.6 Forms (hosted RSVP)

Each Event has one RSVP form, hosted by the app at a public link, built by the Host without technical knowledge. Business rules:

- The form is built by drag-and-drop / checkbox selection of common question types, with reusable **templates** as starting points. The Host assembles it visually; no configuration files, no separate tool.
- Standard question set (all editable/removable): the core attendance question (worded affirmatively — "Yes, I plan to attend" / "I cannot attend" / "I'm not certain yet," never "Accept/Decline"), an optional guest question with guest name(s), optional dietary/accessibility needs (with a short reason shown for why it's asked), and an optional open question ("What would make this event especially valuable to you?").
- Identity capture (name, email) is included so responses match back to the right invitation, unless identity is reliably carried by the invitation link itself (see below).
- The form is **whitelabelable**: header image, background, accent color, the Host's logo, and a custom confirmation/thank-you screen. By default the form inherits the Host's overall styling so it looks cohesive with zero effort; the Host can override per-event for a special look. Form and invitation email should feel like one continuous branded experience.
- Each invitation link should carry a hidden event identifier (and, where feasible, the invitee identity) so responses match automatically without asking a busy executive to type an event code. Where identity can't be safely pre-filled, collect email explicitly.
- The form must be fast (completable in under 60 seconds), excellent on a phone, and respectful — collect only what's needed to run the event, no sensitive free-text fishing.
- Responses flow straight back into the same place the Host is already working; there is no separate results inbox to check.

### 3.7 Notes (contextual, everywhere they belong)

Notes are deliberately not one big field. They attach at the level where they make sense, and the app must offer them in intuitive, expected places — never scattered randomly:

- **On a Person:** durable relationship context ("prefers early-morning events," "met at Q1 breakfast," "values operational candor").
- **On a Person for a specific Event (i.e., on the Invitation):** event-specific context ("said last year the timing didn't work," "wants to bring their COO this time").
- **On an Event:** organizer notes about the gathering itself.

Notes are timestamped and feed the interaction timeline. Private relationship notes are never automatically inserted into any AI prompt or any outgoing message; they are the Host's private memory unless the Host deliberately chooses to use a note's content in a specific message.

### 3.8 Send Jobs

A Send Job records one bulk send: which event, which message and variants, which recipients, the chosen pacing, the schedule, and the live per-recipient status that the worker reads and updates. It is the durable backbone of Part 7. Its detailed behavior is specified there.

### 3.9 Engagement signals

Attached to invitations, the system records soft engagement signals: whether/when the invitation email appears to have been opened, whether the form link was clicked, and whether a form was started but not submitted. These are explicitly probabilistic (see Part 8). They inform the dashboard and next-action logic but are always presented honestly as signals, not certainties.

### 3.10 Data integrity rules that must hold everywhere

- Flag duplicate people (same normalized email) but never auto-delete; let the Host decide to merge, update, or keep.
- Prevent the same person from being invited to the same event twice unintentionally; if the Host does it, flag it rather than silently creating a duplicate invitation.
- Keep the raw, original form submissions preserved and untouched; do any normalization/matching in a separate layer so the source data is never corrupted.
- Maintain an exceptions view for responses that couldn't be automatically matched to an invitation, with a clear one-click way for the Host to match them.
- Always allow manual entry of a response the Host received by email, phone, or in person, and never let that manual entry corrupt the raw form data.
- Surface "needs attention" conditions plainly: missing email, malformed email, missing event details, over capacity, duplicate invitation, response conflict, or a broken email connection.
- Never overwrite a Host's manual override without an explicit, plain-language warning.


---

## PART 4 — THE CRM AND CONTACT IMPORT

### 4.1 The job the CRM does

The CRM is where the Host keeps the people they might invite. It must feel like a calm, legible address book with memory, not a database. Its two jobs: let the Host get their existing contacts in effortlessly, and let the Host maintain rich relationship context over time.

### 4.2 The import experience (this must be excellent)

Getting contacts in is the first thing a new Host does, and a clumsy import poisons the whole first impression. The required flow, with a back arrow available at every step:

1. **Drop a file.** The Host drops or selects a spreadsheet export (CSV or Excel). No template to conform to; the app adapts to their file, not the other way around.

2. **Automatic column guessing.** The app reads the columns and makes its best guess at what each one is ("this looks like Company," "this looks like Email"). It presents these guesses for review — it does not silently commit them.

3. **Editable column mapping.** The Host sees a clear grid: each column from their file, with a dropdown letting them confirm or change what it maps to (First Name, Last Name, Preferred Name, Email, Company, Title, Relationship Type, Notes, or Ignore this column). They can remap anything, rename, or skip columns entirely. This step is where the Host has full control before anything is real.

4. **Preview the result.** Before committing, the Host sees the first several rows exactly as they will land in the CRM, so there are no surprises.

5. **Gentle deduplication.** If some incoming people already exist (matched on normalized email), the app says so plainly — "3 of these already exist" — and offers a calm choice: update the existing records, skip the duplicates, or keep both. Never silently create duplicates; never silently overwrite.

6. **Commit.** Only now does the import happen. Emails are validated, malformed ones are flagged (not discarded — the Host may want to fix them), and valid records land. The Host gets a plain summary: how many added, how many updated, how many flagged for attention.

Back navigation must work throughout — the Host can step back from preview to mapping, from mapping to file selection, without losing their place or their file.

### 4.3 Ongoing CRM use

- **Add a person manually** with the same fields, through a simple form, at any time.
- **Edit any field on any person** at any time, freely — editing a person never triggers anything (no emails, no side effects); it just updates the record.
- **Attach notes** in the contextual places defined in 3.7, at any time, from intuitive locations (the person's profile, or inline when looking at them in an event).
- **See the interaction timeline** on each person's profile: every event, response, attendance, and note, in chronological order, assembled automatically.
- **Search and filter** the contact list quickly by name, company, relationship type, or tag.
- **Mark inactive** to retire a contact without destroying history.
- **Merge** two records the Host confirms are the same person, preserving both histories into one.

### 4.4 A subtle but important safety point

Because a Person's data (like their email) can feed into future sends, but editing is supposed to be free and safe, the resolution is: editing a person's data only affects **future, not-yet-sent** communications. It can never reach back and alter or re-trigger anything already sent. So the Host can fix a typo in someone's email at any time without fear — worst case, it corrects a future send; it can never cause an accidental resend or alter history. This is the concrete application of the edit/consequence model (Part 6) to the CRM.

---

## PART 5 — EVENT CREATION AND THE INVITATION COACH

### 5.1 The event creation flow

Creating an event is a guided, linear-but-flexible path that mirrors how the Host actually thinks: what's the event, who do I want there, what do I say to them, how do they reply. The four movements — **set up the event, choose invitees, craft the invitation, build the form** — should feel like one continuous act of organizing, not four separate tools. The Host can move forward and back freely, save and return later, and nothing is locked in until they choose to send.

1. **Set up the event.** The Host fills in the event's facts (Part 3.3). Strong defaults and clear required-vs-optional distinction. The app should make it obvious what's still needed before the event can be invited out.

2. **Choose invitees.** The Host selects people from their CRM — by searching, filtering by relationship type or tag, or picking individually. Selecting a person creates an invitation record for this event. The app prevents accidental double-invites and shows a running count against capacity. The Host can add or remove invitees at any time before sending, and can add more later even after an initial send (a later send only goes to the newly added, never re-sending to those already invited — see Part 7).

3. **Craft the invitation** — see 5.2–5.4.

4. **Build the form** — see Part 3.6; the form-building UX is drag-and-drop with templates and whitelabel theming.

### 5.2 The Invitation Coach — what it is

The Invitation Coach is an embedded writing assistant that helps the Host produce an excellent invitation. It is emphatically **not** a generic chat box bolted into a corner. It is woven into the compose experience and is aware of context at all times: it knows the event's facts, the current state of the draft, the audience being invited, and — where available — the Host's own voice from prior sends. So it opens not with a blank prompt but with a genuinely useful first draft grounded in this specific event, and the Host steers from there.

### 5.3 How the Coach behaves

- **It drafts first.** On entering the compose step, the Coach offers a complete first-draft invitation built from the event facts, following the message-quality standards in Part 9. The Host is never staring at a blank page.
- **Edit in place, in context.** The draft and the assistant are one surface. The Host can type directly into the email to edit it by hand, OR ask the assistant to change it ("make this warmer," "shorter," "more direct," "mention the succession-planning angle"). Both paths stay in sync — a hand edit is reflected in what the assistant sees; an assistant edit is reflected in the editable draft. When the Host highlights a passage and asks for a change, the assistant knows which passage.
- **It knows the event.** The Host never re-explains the event to the assistant; it already has the facts. It should proactively use them (speaker, date, value proposition) and should ask for or flag anything genuinely missing rather than inventing it.
- **The "make it more compelling without making it sound like marketing" move.** A signature capability: the Host can hand the Coach a rough draft (or the current one) and ask it to diagnose the weaknesses in relevance, value, and clarity, then return a stronger version plus a short plain explanation of the few most consequential improvements. This should feel genuinely valuable — like a skilled communications advisor, not a text generator.
- **It produces the full suite.** Beyond the initial invitation, the Coach generates the reminder, priority follow-up, confirmation, final-details, waitlist, cancellation, thank-you, and post-event messages, plus the form's intro and confirmation wording — all in the Host's voice, all editable, all draft-stamped.

### 5.4 The handwritten pass (personal touch before send)

This feature is both the emotional core of the product and, at volume, a deliverability asset (Part 7.5). After the invitation is written, before sending, the Host gets a fast optional review pass over the invitee list where they can drop a single personal sentence onto any individual who warrants it ("Bill — this is exactly the succession conversation we discussed in the spring"). Requirements:

- It is **fast and optional.** The Host can add a touch to five people out of five hundred and skip the rest, or skip entirely. The product must never force per-person customization — that would recreate the manual copy-paste burden the app exists to eliminate.
- Where a personal line is added, it appears naturally in that person's email; where none is added, the email reads perfectly well without it.
- The assistant can help write these touches too, drawing on the person's notes and timeline — but only when the Host asks, and never auto-inserting private notes without the Host's deliberate choice.

### 5.5 Coach guardrails (non-negotiable)

- Never invent facts: no fabricated speaker credentials, attendee names, social proof, capacity, urgency, or personal history. When something is missing, show a visible placeholder or state the assumption; never silently make it up.
- Never use a person's private notes or CRM context in a message unless the Host deliberately supplies and approves it for that specific message.
- Never produce manipulative, deceptive, exclusionary, discriminatory, or coercive copy.
- Never imply official endorsement by any organization or use protected brand assets without approval.
- Never send anything automatically. Every generated item is a draft requiring explicit Host approval.
- Preserve the Host's authentic voice; avoid cliché AI phrasing and tics.
- When writing to a senior executive, respect their intelligence and time — don't over-explain basics.


---

## PART 6 — THE EDIT / CONSEQUENCE MODEL (DUMMY-PROOF EDITABILITY)

This part governs the tension at the heart of the product: **everything must be editable, yet the Host must be unable to accidentally break things.** It applies everywhere and Claude Code should treat it as a cross-cutting rule, not a single feature.

### 6.1 The governing distinction: editing data vs. triggering consequences

The resolution to "total editability + total safety" is to separate two different kinds of action:

- **Editing data** — changing a field, a note, a draft, a form question, a setting. This is *always* free, immediate, and reversible, because editing by itself does nothing to anyone. There are no confirmations on ordinary edits; that would make the app feel timid and annoying.
- **Triggering a consequence** — sending, resending, publishing a form, launching a bulk send, deleting a person who is part of a live event. These reach into the real world and touch other people. These, and only these, are gated.

The rule stated simply: **the Host can never accidentally cause an irreversible or outward-facing action, but can always intentionally do anything.** The app's job is to make the intentional path obvious and the accidental path impossible.

### 6.2 How consequences are gated

- Every consequential action is preceded by a **calm, plain-language confirmation that states the actual consequence**, not a scary technical warning. Example: "This will send your invitation to 342 people who haven't responded yet. They'll each get it over about the next 3 hours. Ready?" — with a clear confirm and a clear cancel.
- The confirmation always states the **who, how many, and roughly when.** The Host should never be surprised by the scope of what they just triggered.
- Consequential actions are never the default click. They require a deliberate, distinct action.

### 6.3 Dependency awareness (the app knows what affects what)

The app understands the relationships between things and surfaces a consequence **only when an edit would actually cause a problem** — not as constant nagging. Key cases:

- **Editing a form question after responses exist.** If the Host changes or removes a question that people have already answered, the app notices and says so plainly: "200 people already answered this question. Changing it now means their answers won't line up. Would you like to add a new question instead?" It doesn't forbid the change; it makes the consequence visible and offers the safer path.
- **Editing event facts that are displayed in multiple places.** Fixing the date, venue, or time should ripple automatically to everywhere those facts are *shown* — the form, the dashboard, and any not-yet-sent emails — because that is unambiguously what the Host wants. This kind of edit should just work, silently and correctly, with no confirmation needed.
- **Editing content that has already gone out.** An email that has already been sent is history and cannot be un-sent or silently rewritten — pretending otherwise would be a lie to the recipient. So already-sent content is not retroactively editable. But this is never a dead end: the app offers the front-door path — "That invitation already went out. Want to send a correction or an update to those recipients?" So the Host always has a way to act; they just can't rewrite the past.

### 6.4 The two kinds of edit ripple

The app must distinguish:

- **Edits that should cascade forward** (fix the date → update it everywhere it's displayed and in all future sends). These happen automatically because they're obviously intended.
- **Edits that must not rewrite history** (don't alter an email someone already received; don't change a response someone already gave). These are preserved as-is; the Host acts on them by sending something new, not by editing the past.

Getting this distinction right per-field is real design work. The default when uncertain: an edit affects the future freely, and never reaches back to alter what has already happened to a real person.

### 6.5 Never a mysterious lock

If something genuinely cannot be changed in place (because it's already happened), the app must always explain why in one plain sentence and offer the forward path. The Host must never encounter a greyed-out control with no explanation. "You can't edit this" is forbidden; "That already went out — here's how to send an update" is required.

### 6.6 Reversibility and undo

Wherever practical, ordinary edits are undoable and destructive actions are recoverable (soft-delete with a grace period rather than instant hard-delete). The Host should feel they can explore and change their mind without fear. A Host who trusts they can't break anything will use the app confidently; a Host who fears breakage will freeze.

---

## PART 7 — THE SENDING ENGINE

This is the most operationally critical system in the product. It must be durable, human-feeling, deliverability-conscious, and completely trustworthy. Read Part 2.2 first.

### 7.1 Sending through the Host's own mailbox

All invitation email is sent through the **Host's own Microsoft/Outlook mailbox** via Microsoft Graph, not through a third-party bulk sender. This is a deliberate deliverability decision: the email genuinely originates from the Host's real address, lands in their real Sent folder, and inherits their real, warm sender reputation. To an executive recipient it is, for all technical purposes, a personal email from the Host.

Consequences to honor:

- The connection is authorized once by the Host via a standard "Connect your Microsoft account" sign-in (Part 11). The app holds a refresh token so the **server can send on the Host's behalf even when the Host is not present** — this is what allows multi-hour and multi-day sends to continue while the Host's computer is closed. The Host must be told plainly, at connection time and in the privacy policy, that the app can send email from their account as part of their events. This is exactly what they want, but it is a real permission and must be transparent.
- The app respects the mailbox's real sending limits. A personal Microsoft 365 mailbox has per-minute and per-day recipient caps; the pacing below stays comfortably beneath them. The system must also detect and handle the case where Microsoft throttles or restricts the account, pausing gracefully and informing the Host rather than failing silently or losing the job.

### 7.2 Pacing (human-feeling, spam-avoiding)

Sends are paced, never blasted. Requirements:

- The default gap between individual sends is **randomized, not fixed** — a human working through their outbox does not send one email exactly every N seconds. A randomized interval (on the order of several seconds up to a minute or more, depending on volume and the Host's chosen pace) reads as organic and keeps the send well under rate limits.
- The default pace is well beneath the mailbox's per-minute ceiling, with comfortable margin. Never pace right at the limit.
- At the Host's option, very large sends can be spread over many hours or across one to two days for maximum deliverability safety.

### 7.3 Volume-aware recommendations at send time

At the moment of sending, the Host chooses the pace, and the app **recommends based on the recipient count** so the Host sees and understands the tradeoff:

- Small send (e.g., a few dozen): "Send over about an hour (recommended)."
- Large send (e.g., 400–500): "Spread over 2 days (recommended for best inbox delivery), over 1 day (faster), or over a few hours (fastest, slightly higher spam risk)."

The recommendation is shown, the tradeoff is stated in plain language, and the choice is the Host's. The app should make the safe choice the obvious default for large volumes.

### 7.4 The reality of high volume, stated honestly

The Host has indicated some events reach 400–500 recipients. At that scale, even one-at-a-time sending begins to *look like* bulk email to spam filters, because the emails are similar. Two design responses follow, and both must be built:

1. **Pacing and spreading** (7.2–7.3) keep the send from looking like a burst.
2. **Message variation** (7.5) keeps the send from looking like one identical message photocopied hundreds of times.

The Host should be gently informed, for very large sends, that a fully identical mass send is inherently higher-risk, and that the app's variation feature is protecting their deliverability. This is framed as the app taking care of them, not as a burden on them.

### 7.5 Message variation (the anti-spam "de-spam" feature)

To keep large sends out of spam without asking the Host to hand-write hundreds of emails, the system automatically generates several **semantically identical, differently worded variants** of the invitation, and distributes them across the send.

Required behavior:

- **Triggered by volume.** For sends above a modest threshold (the Host has suggested around 60; treat this as a sensible default trigger, and make the exact number a setting the operator can tune, because there is no fixed public "identical email" spam threshold — spam detection is reputation-and-signal based, not a simple count, so the correct engineering posture is to keep the identical-count low and non-consecutive rather than to ride up to a magic number). Below the threshold, a single version is fine.
- **AI-generated variants.** The invitation-writing assistant produces a handful of variants (a sensible default of roughly 5–8) that preserve meaning, tone, facts, and the Host's voice, varying wording — including the subject line and opening sentence, where filters key in most — while keeping every factual detail and the call-to-action identical and correct.
- **Interleave, do not bucket.** Distribute variants by rotating/randomizing across recipients so that **no two consecutive sends are identical**, rather than sending large contiguous blocks of one version. Interleaving is meaningfully safer than "first 60 get v1, next 60 get v2," because contiguous blocks recreate the very burst pattern filters watch for. With even 5–8 variants interleaved across 500 recipients, no single version is sent more than roughly 60–100 times and never back-to-back — which sidesteps the identical-volume problem regardless of where the invisible threshold actually sits.
- **Visible, never hidden.** The Host can see every variant, read each one, and edit or regenerate any of them before sending. This satisfies the "nothing happens behind your back" principle. The Host is told, in plain terms, that this variation exists to help their invitations reach the inbox.
- **Personalization compounds it.** Any handwritten touches (5.4) and the per-recipient greeting further differentiate the emails on top of the variants, strengthening deliverability. The variation feature and the personal-touch feature reinforce each other.
- **Never at the cost of quality or honesty.** Every variant must be a genuinely good invitation and factually identical in substance. Variation is in wording, never in meaning, offer, or facts.

### 7.6 The durable send job (how a send actually runs)

When the Host confirms a send, the system creates a **Send Job** and enqueues one entry per recipient. From that point:

- Each recipient entry carries its target person, the chosen variant, the fully resolved personalized content, its scheduled send time (spaced per the pacing), and its status (queued / sent / failed / cancelled).
- The **send worker** (Part 2) continuously pulls the next due entry across the shared multi-tenant queue, sends it through the correct Host's mailbox, and immediately records the outcome before moving on.
- **Resumption is automatic and exactly-once.** Because status is written to the database the instant each send is confirmed, any interruption — worker crash, host restart, code deploy, the Host closing their laptop — resumes at the next queued entry with no double-sends and no skips.
- **Multiple simultaneous Hosts interleave naturally.** The shared queue means several Hosts' sends progress in parallel; because each sends through their own mailbox, they never compete for a shared sending resource. A single worker comfortably handles many interleaved sends (the work per email is tiny; the pacing gaps are just waiting). If volume ever demands it, additional workers can split the queue without any redesign.
- **Failures are handled, not lost.** A failed send (transient error, temporary throttle) is retried a sensible number of times with backoff; a permanently failing address (hard bounce, invalid) is marked and surfaced to the Host as a "needs attention" item, never silently dropped.
- **Bounces feed back.** Hard bounces update the invitation and flag the person's email for the Host's attention.

### 7.7 The send experience for the Host

- **Pre-flight check before sending.** Before a send can start, the app verifies: the email connection is live (and prompts a gentle reconnect if the token is near expiry or invalid, *before* the send rather than mid-send), the message and variants are approved, the form link is valid, required event facts are present, and the recipient count and pacing are confirmed. A missing essential blocks the send with a plain explanation of what to fix.
- **A calm, live progress view.** Once sending, the Host sees an honest live status: "142 of 480 sent · next at 2:14 PM · on track to finish around 5:30 PM." It updates in real time but is restful, not frantic.
- **"You can close this safely."** The progress view clearly tells the Host they may close the app, shut the laptop, and walk away — the sending continues on the server and they can check back anytime. This message must be prominent enough that the Host trusts it, because the instinct to "stay and watch" is exactly what we're relieving them of.
- **Pause, resume, cancel.** The Host can pause a send, resume it, or cancel the remainder. Cancelling stops future sends but obviously cannot recall those already delivered — and the app says exactly that.
- **Add-on sends.** If the Host adds new invitees after a send, starting another send targets only the new people; it never re-sends to anyone already sent to. The app states this plainly when the Host initiates it.


---

## PART 8 — TRACKING, ENGAGEMENT SIGNALS, AND THE DASHBOARD

### 8.1 What the Host needs to see

The Host doesn't want analytics; they want to know four things at a glance: **who's coming, who's a maybe, who should I personally nudge, and am I at capacity.** Everything on the dashboard rolls up to those questions and to a clear next action. The dashboard is live — it reflects reality as responses and signals arrive — and it is calm and readable, never a wall of gauges.

### 8.2 The metrics that matter

- **Invited** — how many invitations have been sent for this event.
- **Responded / response rate** — responses over valid invitations sent.
- **Yes / positive RSVP rate** — the primary result metric.
- **Expected headcount** — yes-responders plus their confirmed guests.
- **Capacity status** — expected headcount against capacity, showing remaining seats or overage.
- **No response** — count, with a one-click filtered list to act on.
- **Priority non-responders** — high-priority invitees who haven't responded, so the Host knows exactly who is worth a personal touch.
- **Maybe** — people needing a deliberate follow-up.
- **Attendance yield** — after the event, actual attendees over valid invitations sent.
- **Exceptions** — duplicates, unmatched responses, missing data, bounces, conflicts.
- **Next actions** — a short, ordered, plain-language list ("Nudge 8 priority non-responders," "Send final details to 34 confirmed guests," "2 responses need matching").
- **Cross-event learning** — once multiple completed events exist, gentle comparison of conversion across events, framed as directional learning, never as guaranteed performance.

### 8.3 Engagement signals — shown honestly

The app shows soft engagement signals: whether an invitation appears to have been opened, whether the form link was clicked, whether a form was started but not finished. These are genuinely useful for spotting who's engaged versus who's gone quiet. But they are **probabilistic, not certain**, and must be presented that way:

- Email open tracking is unreliable by nature — privacy features (like Apple Mail Privacy Protection) inflate opens, and corporate mail systems can pre-fetch links and register false opens or clicks. The app must never present these as hard facts.
- Wherever engagement signals appear, a **brief, plain clarifying line** accompanies them — e.g., a short note at the bottom of the page explaining that these are approximate signals, not guarantees, and shouldn't be treated as certainty. This honesty is part of the product's respect for both the Host and the recipient, and it protects the Host from making bad decisions on false precision.
- Signals inform next-action suggestions softly ("opened but hasn't responded — might be worth a nudge") but never drive an automated action.

### 8.4 Turning signals and status into next actions

The real output of all this data is a prioritized, human next-action list. The app continuously reconciles invitations, responses, guests, capacity, signals, and the Host's overrides into a small ordered set of recommended next steps, each phrased plainly and each leading directly to the relevant filtered list of people. The Host is never asked to go hunting; the app brings the right subset to them. Every suggestion is a suggestion — the Host may act, defer, or dismiss it.

---

## PART 9 — COMMUNICATION QUALITY AND ETHICAL PERSUASION STANDARD

All Host-facing and recipient-facing communication must meet this standard. The Coach enforces it in what it generates; the app enforces it in what it will send.

### 9.1 The goal

Improve results **ethically** — make genuine value easier to recognize, reduce uncertainty and friction, and strengthen the recipient's sense that the invitation is personally relevant. Never manipulate, exaggerate, or manufacture exclusivity. The purpose is to help a worthwhile invitation be recognized as worthwhile by a busy person, not to trick anyone into anything.

### 9.2 Message architecture (what a strong invitation contains)

- **Subject line** — specific, credible, concise (typically ~35–55 characters); leads with topic, peer relevance, or the trusted host, not the word "Invitation."
- **Personal opening** — uses the greeting name and, where appropriate, one authentic reason the Host thought of this recipient.
- **Value proposition** — answers "why spend the time?" with the decision, challenge, insight, or peer exchange the executive will gain.
- **Social context** — honestly describes the caliber or type of peers attending; no name-dropping without permission.
- **The experience** — helps them picture attending: intimate discussion, practical takeaways, candid peer dialogue, no pitch.
- **Logistics block** — date, time, location/parking or virtual link, RSVP deadline, in a consistent scannable block.
- **One call to action** — a single, obvious RSVP link with clear action wording.
- **Warm close** — low-pressure, personal, with an easy way to ask questions.

### 9.3 Ethical persuasion principles

- **Personal relevance** — connect to a real leadership issue; never fabricate the connection.
- **Specificity** — concrete speakers, questions, takeaways, and format beat generic claims.
- **Identity congruence** — invite the recipient as a respected peer, not a sales target.
- **Credible social proof** — mention peer caliber or event history only when true.
- **Reciprocity** — lead with genuine value, not obligation.
- **Restrained loss aversion** — it's fine to note the value of a unique discussion; never use fear or shame.
- **Truthful scarcity only** — real capacity or deadlines may be stated; never fake urgency.
- **Commitment/consistency** — after a yes, provide confirmations and useful pre-event engagement that support follow-through.
- **Friction reduction** — one CTA, mobile-friendly RSVP, concise details, predictable confirmation.
- **Autonomy** — make declining easy and respectful; this protects trust and improves data quality.

### 9.4 Quality bar for any invitation

- **Relevance:** the first ~75 words make clear why this recipient should care.
- **Clarity:** a reader can grasp what, why, who, when, where, and how to RSVP in under 20 seconds.
- **Credibility:** no unsupported claims, artificial superlatives, or vague prestige language.
- **Warmth:** sounds like the Host, not a marketing department or a generic AI.
- **Brevity:** an initial invitation is typically ~175–300 words unless the event needs more.
- **Scannability:** short paragraphs, restrained emphasis, a consistent logistics block.
- **One CTA.**
- **Compliance:** accurate, respectful, no hidden-tracking claims, no unauthorized brand assets.

### 9.5 RSVP wording standard

Affirmative, human language throughout. "Yes, I plan to attend," not "Accept." "I cannot attend," not "Decline." No dark patterns, no pre-selected answers, no guilt, no fake scarcity, no language that makes saying "no" difficult.

---

## PART 10 — DESIGN AND EXPERIENCE STANDARD

### 10.1 The aesthetic target

Elegant, restrained, calm, and — deliberately — **familiar.** The interface should feel like the most refined, well-made version of the professional software this user already trusts (the Microsoft 365 world), not like a design-forward startup product they have to decode. Premium comes from restraint, whitespace, typographic hierarchy, and polish — not from novelty. Familiarity is a feature, because it makes a low-confidence user feel safe and instantly oriented.

### 10.2 What to deliberately avoid (the "not generic" requirement)

The default look that AI-assisted builds fall into is explicitly unwanted. Avoid: the ubiquitous geometric sans (e.g., Inter) as the whole identity, purple-to-blue gradients, an over-reliance on a single icon set used decoratively ("icon soup"), uniformly heavy rounded corners on everything, neon accent colors, and busy dashboards of gauges. The product must not look like it was generated from a template. Restraint and familiarity are how we avoid that, not by chasing avant-garde novelty (which would alienate this user) — the target is timeless and professional, not trendy.

### 10.3 Concrete design language

- **Typography:** a refined, professional, Microsoft-familiar type feeling (the kind of clean, legible faces this user associates with Office documents) rather than the generic startup sans. Clear hierarchy, generous sizing (client-facing text comfortably readable; nothing cramped), sentence case, ample line spacing.
- **Palette:** a restrained, executive palette anchored in deep navy and professional blue with a single warm gold accent used sparingly, plentiful white and soft neutrals, and clear, non-decorative status colors (a calm green for confirmed/complete, a restrained red reserved strictly for errors — never decorative). Roughly: mostly white/neutral, a confident minority of navy/blue, and a thin line of gold/status accent. This palette is provisional and must be overridable per-tenant later, but it is the right starting point and is appropriate for this user.
- **Layout:** generous whitespace, calm density, clear visual grouping, obvious primary actions, a consistent and predictable navigation. The Host should understand where they are and where to start within seconds of opening any screen.
- **Motion:** subtle and purposeful — gentle transitions that aid orientation, never flashy.
- **Icons:** used sparingly and meaningfully, never as decoration and never as a substitute for a clear text label. This user relies on words.
- **Accessibility:** high contrast, readable type, keyboard-navigable tables and forms, clear labels, and never meaning conveyed by color alone (always pair color with a label or icon). This directly serves the primary user and is non-negotiable.

### 10.4 Interface behavior standards

- **A minimal, branded sign-in front door.** The app opens, for an unauthenticated visitor, to a single clean branded sign-in screen and nothing else (Part 2.5) — no marketing, no signup. After sign-in, the Host lands on orientation, not raw data.
- **Open to orientation, not raw data.** Once signed in, the app opens to a clear home/dashboard that tells the Host what matters and where to go, never to a bare table.
- **A visible, obvious primary path.** The core journey — maintain contacts, create an event, invite, send, manage responses — is always discoverable. A first-time Host understands where to start within seconds.
- **Consistent, predictable navigation.** The same things live in the same places. Settings is where controls live and the Host expects to find them.
- **Plain-language everything.** Labels, buttons, empty states, errors, and confirmations are all in warm, plain language. Empty states teach ("No events yet — create your first one") rather than sitting blank.
- **Every failure state yields a visible, plain next action.** No dead ends, no silent failures, no cryptic errors. Every problem tells the Host what happened and what to do.
- **Whitelabel/branding controls** for the Host live in Settings and flow through to forms and (where appropriate) email styling, so the Host's events feel like theirs.

### 10.5 The frontend-design skill

When building the interface, consult the frontend-design skill for execution guidance on typography, restraint, and avoiding templated defaults — but always subordinate it to the familiarity-over-novelty and accessibility requirements above, which are specific to this user and override any generic design guidance.


---

## PART 11 — EXTERNAL CONNECTIONS AND OWNER SETUP

Some things only the owner (or the Host) can do, because they require credentials, approvals, or account-level access. Every one of these must be collected into a single, clearly labeled **Owner Setup Checklist** deliverable, written in plain steps, so nothing is buried in code or comments. The app should also detect, at runtime, when a required connection is missing or broken and guide the relevant person to fix it rather than failing opaquely.

### 11.1 The Microsoft / Outlook connection (per Host)

- **What it is:** each Host connects their Microsoft 365 mailbox so the app can send invitations on their behalf, including in the background while they're away.
- **Owner's one-time work:** register an application with Microsoft to obtain the credentials the app needs to offer "Connect your Microsoft account," and configure the appropriate send-on-behalf permissions and redirect settings. This is a one-time setup the owner performs; the checklist must spell out exactly what to create and where to put the resulting values.
- **Host's experience:** a single "Connect your Microsoft account" button in Settings triggers the standard Microsoft sign-in, the Host approves once, and Settings then shows a clear green "Connected as [address]" state. The app stores the refresh token securely so the server can send while the Host is away.
- **Ongoing:** the app monitors connection health and prompts a gentle reconnect *before* a send if the connection is near expiry or broken — never mid-send, never silently.

### 11.2 The Anthropic API (for the Coach and variation)

- **What it is:** the invitation-writing assistant and the message-variation generator call the Anthropic API.
- **Owner's work:** provide an Anthropic API key, configured securely on the server (never exposed to the browser, never committed to code). The checklist states exactly where this goes.
- **Cost note for the operator:** these calls have a usage cost; the operator should be aware this is part of the per-Host running cost the retainer covers.

### 11.3 Hosting and infrastructure (owner)

The checklist must walk the owner through:

- **The application** on the recommended app host (Vercel), connected to the code repository.
- **The database** on Supabase, with authentication, row-level security (for tenant isolation), and storage (for whitelabel images) configured. The owner is fluent here.
- **The send worker** on the recommended persistent-worker host (Railway), running the always-on sending process, with the environment values it needs to reach the database and send mail. The owner is fluent here.
- **Domain and email considerations** relevant to deliverability (e.g., ensuring the Host's own domain email authentication is healthy, since sends originate from the Host's real mailbox), documented in plain terms.
- **Provisioning Host accounts by hand** (Part 2.5): exactly how the operator creates a Host's account — setting their username (email) and password directly in the auth/database layer — since there is no in-app signup in V1. The checklist must give the precise steps.
- **Creating and resetting the demo account** (Part 2.5): how to provision the operator's demo login, load its fictional sample data, and reset it to a clean state before a demo. The checklist must confirm the demo account cannot send real email.
- **All secrets and keys** stored as secure environment configuration, never in code.

### 11.4 Legal and policy (owner, before scaling)

- A **Terms of Service** and **Privacy Policy** are required, presented to and accepted by each Host at sign-in. These must honestly state: what data the app stores, that the app can send email from the Host's connected account as part of their events, that the operator does not share or sell the Host's data or use it for the operator's own marketing, that each Host's data is isolated, and a reasonable limitation of the operator's liability for the Host's own misuse or data leakage.
- **This is not legal advice and the build cannot be the owner's legal cover.** The checklist must clearly flag that before onboarding paying Hosts at any scale, the owner should have real Terms of Service and a Privacy Policy reviewed by a qualified professional. For the single-Host pilot the stakes are lower, but the placeholder policies and the acceptance step should exist from day one so the pattern is in place.

### 11.5 Runtime detection of missing connections

The app must never fail cryptically because a connection is absent. If the mailbox isn't connected, the AI key is missing, or the worker can't reach the database, the app detects it and shows a plain-language explanation and the fix (or, if it's an owner-level issue, a clear message that the operator has been alerted / needs to act). Graceful degradation over opaque failure, always.

---

## PART 12 — DURABILITY, RELIABILITY, AND NON-FUNCTIONAL REQUIREMENTS

- **Durability of sends:** as specified in Part 7 — server-side, database-backed, exactly-once, resumes through any interruption. This is the highest-priority reliability requirement in the product.
- **No dependence on the Host's device.** Nothing important depends on the Host's browser being open or their computer being on, other than the Host initiating actions.
- **Performance at realistic scale:** the app should stay responsive for a Host with thousands of contacts, dozens of events, and tens of thousands of invitation records across their history, and for send jobs of several hundred recipients.
- **Tenant isolation:** enforced at the database level; structurally impossible for one Host to see another's data.
- **Security:** secrets in secure environment configuration only; least-privilege access; tokens stored securely; nothing sensitive exposed to the browser or committed to the repository.
- **Privacy:** collect only what's needed; honor contact preferences and consent; never repurpose Host data for the operator's marketing.
- **Recoverability:** soft-delete with grace periods for destructive actions; the raw form-response data preserved untouched; clear paths to correct mistakes.
- **Observability for the operator:** enough logging and visible job status that the solo operator can see what's happening and diagnose a problem without heroics — especially for sends (what's queued, sent, failed, and why).
- **Graceful degradation:** if an optional piece is unavailable (e.g., the AI service is briefly down), the core workflow still functions — the Host can still write manually, still send, still manage responses. No single external dependency may take down the core loop of invite → send → track.
- **Maintainability:** the codebase and its configuration should be clear enough for the solo operator to maintain and for a future developer to extend, with the data model and key decisions documented.

---

## PART 13 — WHAT IS EXPLICITLY OUT OF SCOPE FOR VERSION 1

To keep the pilot focused and shippable, the following are deliberately excluded from V1 (several are natural later additions once the core is proven):

- Multi-Host onboarding UI and self-service signup/billing. The architecture is multi-tenant, but V1 onboards one Host (the pilot) by hand, with accounts provisioned directly on the backend (Part 2.5). There is no public signup, no marketing/landing site, no pricing page, no billing/subscription management, and no operator admin UI for creating Hosts — all later work. Access is closed to everyone except operator-provisioned accounts.
- Full CRM/opportunity-management depth, sales pipelines, or replacing any existing enterprise system.
- SMS, marketing-automation drip sequences, paid advertising, or any channel other than the Host's own email.
- Third-party contact scraping or automated data acquisition (e.g., pulling from LinkedIn).
- Any autonomous or unattended AI sending. Every send is Host-approved. This is permanent, not a V1 limitation.
- Calendar/.ics generation, deep calendar integration, and automated no-show reduction workflows (good Phase 2 candidates).
- A branded public portal for invitees beyond the hosted RSVP form.
- Guaranteed compatibility with every conceivable email provider. V1 targets the Host's Microsoft/Outlook mailbox as the supported path; a generic-provider path is later work.

Anything excluded here should, where relevant, be built *around* rather than *against* — i.e., don't foreclose these futures with short-sighted decisions, but don't build them now.

---

## PART 14 — BUILD SEQUENCE AND DELIVERABLES

Claude Code should build in an order that produces a testable core early and layers polish and edge-handling on top. A suggested sequence:

1. **Foundation:** the data model and tenant isolation, authentication with the minimal branded sign-in screen and operator-provisioned accounts (Part 2.5, closed to the public, with the demo account), and the basic app shell with the navigation and design language established (so nothing is built in the generic default look and later re-skinned).
2. **CRM:** people, notes, the interaction timeline, and the excellent import experience (Part 4). This is testable on its own and is the Host's entry point.
3. **Events + invitations:** event creation, invitee selection, the invitation/event data relationships.
4. **The Coach:** the embedded, context-aware writing assistant and the full message suite (Part 5).
5. **Forms:** the drag-and-drop hosted RSVP form with templates and whitelabel theming (Part 3.6), and the public response capture with automatic matching and the exceptions path.
6. **The sending engine:** the durable send job, the worker, pacing, volume-aware recommendations, message variation, the handwritten pass, and the live progress experience (Part 7). This is the hardest and most critical system; it depends on the pieces above.
7. **Tracking and dashboard:** engagement signals with honest framing, the live metrics, and the next-action engine (Part 8).
8. **The edit/consequence model** woven throughout (Part 6) — verified across every screen as a cross-cutting pass, not a bolt-on.
9. **Connection health, graceful degradation, and the runtime detection** of missing connections (Part 11.5).
10. **Polish, accessibility pass, empty states, and the owner setup materials.**

### 14.1 Required non-code deliverables

Alongside the application, produce:

- **The Owner Setup Checklist** (Part 11) — every manual step, key, connection, and approval the owner must perform, in plain sequence, with exactly where each value goes.
- **A Host Quick-Start** — a short, large-type, task-based guide for the Host (the low-tech user), covering the core loop: import contacts, make an event, write the invitation, send it, watch responses. Reassuring, not patronizing.
- **A plain-language description of the data model and key architectural decisions**, so the solo operator (and any future developer) can maintain and extend the system.
- **Placeholder Terms of Service and Privacy Policy** honestly reflecting Parts 11.4 and 12, flagged clearly as requiring professional review before scaling.
- **A test checklist** covering the scenarios in Part 15.

---

## PART 15 — ACCEPTANCE CRITERIA AND KEY TEST SCENARIOS

The product is acceptable for pilot when all of the following pass:

**Core loop**
- A Host can import a messy real-world contact file, review and remap columns with a working back arrow at each step, resolve duplicates gently, and land clean contacts — with malformed emails flagged, not lost.
- A Host can create an event, select invitees without accidental double-invites, and see a live count against capacity.
- A Host can produce a strong invitation with the context-aware Coach, edit it by hand and by asking, and generate the full message suite — all draft-stamped, nothing auto-sent.
- A Host can build and whitelabel a hosted RSVP form by drag-and-drop, publish it, and receive responses that automatically match back to the right invitations, with unmatched ones landing in a clear exceptions view.

**Sending (the critical path)**
- A Host can send to a large list (test at 400–500) through their own connected mailbox, paced and human-feeling, with volume-aware pacing recommendations shown.
- For a large send, the system generates visible message variants and interleaves them so no two consecutive sends are identical; the Host can view and edit every variant.
- The handwritten-pass lets the Host add optional personal touches quickly and skip the rest.
- **Durability test:** killing the worker (or simulating a crash / redeploy) mid-send resumes at the exact next recipient with zero double-sends and zero skips. Closing the Host's browser mid-send has no effect on completion.
- The pre-flight check catches a missing/expired mail connection *before* sending and prompts reconnection.
- Two simulated Hosts sending simultaneously interleave without blocking each other.
- Bounces and permanent failures are surfaced to the Host, not silently dropped.

**Editability and safety**
- Editing any data field is free, immediate, and causes no side effects.
- Every consequential action (send, publish, delete-mid-event) is gated behind a plain-language confirmation stating who/how many/when.
- Editing an event's date ripples to the form, dashboard, and unsent emails automatically; it does not alter already-sent emails.
- Editing a form question after responses exist warns plainly and offers the safer path.
- Nothing is a mysterious locked control; already-happened things explain why and offer a forward path.

**Tracking and honesty**
- The dashboard answers "who's coming / who to nudge / capacity" at a glance and produces a plain-language next-action list that leads to the right filtered people.
- Engagement signals appear with a clear plain-language note that they're approximate, never presented as certainty.

**Design and orientation**
- The app opens to orientation, not raw data; a first-time Host finds where to start within seconds.
- The interface reads as elegant, restrained, and familiar — free of the generic templated look (no icon soup, no purple gradients, no cramped dashboards), and meets the accessibility requirements (contrast, readable type, keyboard navigation, never color-only meaning).

**Connections and resilience**
- Missing or broken connections (mailbox, AI, database) produce plain-language guidance, never cryptic failures.
- The core invite→send→track loop still functions if the AI service is briefly unavailable.

**Data and tenancy**
- One tenant's data is structurally invisible to another, enforced at the database level.
- Raw form responses are preserved untouched; normalization/matching happens in a separate layer.
- Host overrides are never silently overwritten by calculations.

**Access and accounts**
- An unauthenticated visitor to any URL sees only the minimal branded sign-in screen and can reach no data, no other page, and no open API returning tenant data.
- There is no public signup, marketing page, or self-registration; accounts exist only when the operator provisions them on the backend.
- An operator-provisioned Host can sign in with the credentials the operator set, and sign out; passwords are stored hashed and sign-in is rate-limited against brute force.
- The operator's demo account signs into an isolated demo tenant of clearly fictional sample data, lets the operator demonstrate the full product including the send experience, and never sends a single real email; the demo tenant can be reset to its clean state.

---

## PART 16 — THE GOVERNING REMINDER

Build the complete, polished, pilot-ready product described here — not a mockup, not a concept, not a reduced demo. Make sound engineering decisions without pausing for routine clarification, using visible placeholders and a clearly documented assumption wherever a genuinely client-specific fact or an owner credential is required. Prioritize, in this order: the Host's trust and ease, reliability and durability (especially of sending), data integrity and safety, honest communication, and a calm, familiar, elegant experience. Every automated thing is visible and adjustable; every consequential thing is gated and reversible where possible; nothing is a dead end; and the Host is always the final authority. When in doubt, return to Part 1.4 — the product's constitution — and choose the path those principles point to.

*End of specification.*
