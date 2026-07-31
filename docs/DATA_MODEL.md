# Data Model & Architecture Notes

Plain-language companion to `supabase/migrations/*.sql`, for the solo operator and whoever maintains this next. Read the build spec (`Chair_Event_System_Build_Spec.md`) first for *why*; this document is about *how it's actually wired*.

## The four pieces (Part 2.1)

1. **`apps/web`** — Next.js 14 (App Router). Every screen the Host uses, plus the ordinary request/response logic (Server Actions, a handful of Route Handlers for public/OAuth surfaces). Deploy target: Vercel.
2. **`supabase/migrations`** — the single source of truth schema, run directly in the Supabase SQL editor (there's no ORM migration tool in the loop — just plain, readable SQL, in order).
3. **`apps/worker`** — a small, always-on Node process whose only job is polling `send_job_recipients` and sending mail. Deploy target: Railway. This is the piece that makes sending durable (see below).
4. **External services** — Supabase (Postgres + Auth + RLS), Anthropic (the Coach), Microsoft Graph (sending mail).

## Tenancy and isolation

Every business table has a `tenant_id`. Row-level security (`0004_rls_policies.sql`) enforces `tenant_id = current_tenant_id()` on every one of them — `current_tenant_id()` is a `SECURITY DEFINER` SQL function that looks up the calling `auth.uid()` in `app_users`. This means a bug in application code (a missing `.eq('tenant_id', ...)` somewhere) **cannot** leak another tenant's rows — the database itself refuses the row, not just the query the app happened to write.

The **service-role client** (`lib/supabase/service.ts` in the web app, `src/supabase.ts` in the worker) intentionally bypasses RLS. It's used in exactly three places, on purpose:
- Public RSVP form routes (`app/api/public/**`) — an anonymous invitee has no `auth.uid()`, so there's no tenant session to scope to. These routes apply their own narrow checks instead (is this form published? does this token match?).
- The send worker, which by design needs to see the *shared* queue across every tenant at once (Part 7.6).
- The one-off operator scripts (`apps/web/scripts/*.ts`).

The service-role key never reaches the browser. If you ever see it in a `NEXT_PUBLIC_*` variable, that's a bug — stop and fix it before deploying.

## The sending engine, concretely

This is the part worth understanding deeply before touching it.

- `send_jobs` is one row per bulk send (event + message + pacing choice).
- `send_job_recipients` is the actual queue: one row per (recipient × send), each with its own frozen, already-merge-field-resolved `resolved_subject` / `resolved_body`, a `scheduled_at`, and a `status`.
- The worker's entire loop (`apps/worker/src/index.ts`) is: call `claim_due_send_recipients(limit)` (a Postgres function using `SELECT ... FOR UPDATE SKIP LOCKED`), which atomically flips up to `limit` due rows from `queued` to `sending` and returns them — then, for each one, send it and write the result back (`sent` / `failed` / back to `queued` with a new `scheduled_at` for throttling/backoff).
- Because the claim is a single atomic transaction, **two worker processes can run at once without ever double-sending the same recipient** — this is what "additional workers can split the queue without redesign" (Part 7.6) actually means in code.
- If the worker crashes between claiming a row and resolving it, that row sits in `sending` with a `claimed_at` timestamp. `reap_stuck_send_recipients()` (called periodically by the worker itself) returns anything stuck for more than 10 minutes back to `queued`. This is the mechanism behind "killing the worker mid-send resumes with zero double-sends and zero skips" — with one honest caveat: if Microsoft Graph accepted the send but the worker crashed in the split second before writing `sent` back, the reaper will cause a resend. This is an *at-least-once* queue, not *exactly-once* in the mathematically strict sense, because Graph's `sendMail` has no client-supplied idempotency key to de-duplicate against. In practice this window is milliseconds wide and this is the same tradeoff virtually every email-sending system makes.

## Merge fields and message variants

- `messages` holds the canonical, Host-approved content per (event, message_type).
- `message_variants` holds AI-generated rewordings of the *invitation* message specifically, used only when a send is above `tenant_settings.variant_threshold` recipients.
- At send-job creation time (`events/[id]/send/actions.ts`), variants are distributed across recipients with `lib/variant-distribution.ts` (shuffle + round-robin, never two identical in a row) and merge fields are resolved immediately with `lib/merge-fields.ts` — this is why editing the canonical message *after* a send has started never touches what's already queued (Part 6.4): the queued rows already have their own frozen copy.

## Forms and response matching

- `forms` / `form_questions` are the Host-authored, drag-and-drop-ordered question set.
- `form_responses` is **append-only** — nothing in the app ever updates `raw_answers` after the fact. Matching a response to the right person (`match_status`, `resolved_invitation_id`) is a separate concern layered on top, exactly per Part 3.10's "keep raw data untouched, normalize in a separate layer."
- Matching happens two ways: automatically at submission time (by invitation token in the URL, or by normalized email) in `app/api/public/forms/[token]/submit/route.ts`; or manually by the Host from the **Responses → Needs matching** tab (`events/[id]/responses/exception-row.tsx`), which runs the identical interpretation logic without ever touching the original row.

## Notable simplifications (known, deliberate, and where to extend them)

- **Bounce detection** is send-time only (a Graph API error at the moment of sending). True NDR/bounce-webhook parsing (catching a bounce that arrives *after* Graph accepted the send) is not implemented — a natural Phase 2 addition would poll the Host's mailbox for bounce messages or use Graph subscriptions.
- **Branding images** are plain URL fields today, not a file upload widget. Supabase Storage is provisioned for this (Part 11.3) but the upload UI itself is a good next increment.
- **Access tokens are cached in the worker's process memory only** (not Redis or similar) — acceptable at pilot scale with a single worker instance; revisit if you ever run multiple worker replicas and want to avoid redundant refreshes.
- **Rate limiting on sign-in** relies entirely on Supabase Auth's own built-in protections rather than a bespoke layer — this is intentional (favor managed services, Part 2.4) and should be revisited only if Supabase's defaults prove insufficient.
