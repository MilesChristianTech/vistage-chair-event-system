# Test Checklist

Maps directly to Part 15 of the build spec. Check these off against a real deployment (real Supabase project, real worker running, a test Microsoft mailbox connected) before considering the pilot launch-ready. Where a step names a file, that's where the behavior is implemented if something doesn't match.

## Core loop

- [ ] Drop a messy real-world CSV/Excel export at **Contacts → Import contacts**; confirm column guesses are reasonable, remapping works, back arrow works at every step without losing the file. (`contacts/import/import-wizard.tsx`)
- [ ] Import a file with a few rows sharing an email with existing contacts; confirm the "N already exist" dedupe prompt appears with update/skip/keep-both choices.
- [ ] Import a file with one malformed email; confirm the person is still added and flagged, not dropped.
- [ ] Create an event, add invitees from Contacts, confirm a running count appears against capacity, and confirm adding the same person twice is prevented/flagged. (`events/[id]/invitees`)
- [ ] In Compose, confirm the Coach produces a complete first draft grounded in the event's actual facts (not a generic template) with no fabricated details. (`events/[id]/compose`, `lib/coach.ts`)
- [ ] Edit the draft by hand, then ask the Coach to change it ("make this shorter"); confirm both paths update the same draft.
- [ ] Click "Make it more compelling"; confirm it returns a stronger draft plus a plain-language list of what changed.
- [ ] Approve the invitation, then click "Generate full message suite"; confirm reminder/confirmation/final-details/etc. are all produced and are each individually a draft requiring approval.
- [ ] Build a form with drag-and-drop question reordering, publish it, submit a real response via the public link; confirm it appears on the event dashboard without a separate "results inbox."
- [ ] Submit a response with an email that doesn't match any invitation; confirm it lands in **Responses → Needs matching** and can be matched with one click.

## Sending (the critical path)

- [ ] Seed or create a test event with 400+ invitees (the demo seed script gives you a smaller sample - for real volume testing, import a large test list). Start a send; confirm the pacing recommendation shown matches the volume (spread over 1–2 days recommended at this size). (`lib/pacing.ts`, `events/[id]/send`)
- [ ] Confirm message variants are generated above the configured threshold (default 60) and that consecutive `send_job_recipients` rows never share the same `message_variant_id` (query the table directly, or verify visually in Compose → Variants). (`lib/variant-distribution.ts`)
- [ ] Add a personal touch to 2–3 invitees and skip the rest; confirm the resulting emails include it only where added.
- [ ] **Durability test:** start a send of at least 20 recipients with a fast pace, then stop the worker process (Ctrl+C locally, or redeploy/restart on Railway) mid-send. Restart it. Confirm every recipient is eventually sent exactly once - check `send_job_recipients` for any row stuck in `sending` for more than 10 minutes (should self-heal via `reap_stuck_send_recipients`), and confirm no duplicate sends land in your test inbox.
- [ ] Close the browser entirely during an active send; confirm progress continues and is correctly reflected when you reopen the Send tab later.
- [ ] Disconnect the mailbox (Settings → Disconnect) mid-way through building a send; confirm the pre-flight check blocks the send with a plain explanation, not a cryptic error.
- [ ] Run two sends for two different tenants at the same time (real Host + demo tenant, or two provisioned test Hosts); confirm both progress without blocking each other.
- [ ] Send to an address that hard-bounces (or simulate a permanent Graph error); confirm it's marked `bounced` and surfaced, not silently dropped.

## Editability and safety

- [ ] Edit any person, event field, note, or draft; confirm it saves immediately with no confirmation dialog and no side effect.
- [ ] Attempt to send, publish a form, or delete a person who's part of an event; confirm each shows a plain-language confirmation stating who/how many/when before proceeding, and that cancelling truly does nothing.
- [ ] Edit an event's date after some emails are already scheduled/sent for it; confirm the form, dashboard, and any *unsent* emails reflect the new date, while already-sent emails are untouched.
- [ ] Edit a form question after responses exist; confirm the warning about existing answers appears.
- [ ] Confirm there is no dead-end "can't edit this" control anywhere without an explanation and a forward path (e.g., sent messages explain you can send a follow-up instead).

## Tracking and honesty

- [ ] Confirm the event dashboard's next-actions list leads directly to a correctly filtered list of the relevant people for each suggestion.
- [ ] Confirm engagement signals (if/when wired to real open/click tracking beyond form submission) always show the honest "approximate, not certain" note wherever displayed. (`components/engagement-note.tsx`)

## Design and orientation

- [ ] Sign in as a brand-new test Host; confirm you land on an oriented Home screen, not a blank table, and that the primary path (Contacts → Events → Compose → Form → Send) is obvious within seconds.
- [ ] Visually confirm the interface reads as calm and Microsoft/Office-familiar - no purple gradients, no icon soup, generous whitespace - and that status is never conveyed by color alone (check badges/dots always carry a text label too).
- [ ] Tab through a form and a table using only the keyboard; confirm focus order is sane and nothing is a mouse-only trap.

## Connections and resilience

- [ ] Temporarily unset `ANTHROPIC_API_KEY` in a local/staging environment; confirm the Coach fails with a plain explanation and the rest of the app (manual drafting, sending, tracking) still works.
- [ ] Temporarily point the worker at a bad database URL; confirm it logs a clear error rather than crash-looping silently, and that the web app still functions for everything except actually completing a send.

## Data and tenancy

- [ ] With two provisioned tenants, confirm (via the UI, signed in as each) that neither can see the other's contacts, events, or sends.
- [ ] Confirm a form's raw `form_responses.raw_answers` never changes even after the Host "fixes" a response's matching or a question's wording later.
- [ ] Manually set a Host override on an invitation's next-action/status, then trigger whatever would normally recalculate it; confirm the override is preserved and any conflict is flagged rather than silently overwritten. (`invitations.host_override_status`, `invitations.next_action_overridden_by_host`)

## Access and accounts

- [ ] From a fully signed-out browser (private/incognito), attempt to hit `/dashboard`, `/contacts`, and any `/api/*` route directly (not `/api/public/**`); confirm every one redirects to sign-in or is rejected, and no tenant data is returned.
- [ ] Confirm there is no visible signup link or public registration path anywhere on the sign-in screen.
- [ ] Sign in with the pilot Host's credentials, then sign out; confirm the session is fully cleared (revisit a protected page and get redirected).
- [ ] Attempt several rapid failed sign-ins; confirm Supabase Auth's rate limiting engages (a "too many attempts" style response) rather than allowing unlimited guesses.
- [ ] Sign in to the demo account; confirm its data is obviously fictional, confirm a send from it never reaches a real inbox (`send_jobs.is_simulated = true` for every job created in that tenant), and confirm `npm run reset:demo` restores it to a clean state.
