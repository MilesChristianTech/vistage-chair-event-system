# Chair Event System

A single-surface, professionally hosted application for executive-event invitation, RSVP, and relationship management. See `Chair_Event_System_Build_Spec.md` for the full product specification this codebase implements.

## Repository layout

```
apps/
  web/      Next.js 14 app - every screen the Host uses, plus Server Actions
            and a handful of public/OAuth Route Handlers.
  worker/   Always-on Node process that sends queued email (Part 2.2, 7.6
            of the spec). Deploys separately (Railway recommended).
supabase/
  migrations/  The full database schema, RLS policies, and tenant
               auto-provisioning trigger, as plain numbered SQL files.
docs/
  OWNER_SETUP_CHECKLIST.md   Every manual step required to go live.
  HOST_QUICKSTART.md         Handed to the Host on day one.
  DATA_MODEL.md              How the schema and sending engine actually work.
  TERMS_OF_SERVICE.md        Placeholder - needs legal review before scaling.
  PRIVACY_POLICY.md          Placeholder - needs legal review before scaling.
  TEST_CHECKLIST.md          Acceptance tests mapped to the build spec.
```

## First-time setup

**Start with `docs/OWNER_SETUP_CHECKLIST.md`.** It walks through Supabase, the Anthropic API key, the Microsoft Azure AD app registration, deploying the web app and worker, and provisioning the first Host account, in order.

## Local development

```
npm install                       # installs both apps/web and apps/worker
cp apps/web/.env.example apps/web/.env.local       # fill in real values
cp apps/worker/.env.example apps/worker/.env       # fill in real values (shares the same Supabase project)

npm run dev          # starts the Next.js app on :3000
npm run worker        # in a second terminal - starts the send worker

npm run provision:tenant -- --email you@example.com --password "..." --name "Your Name" --tenant "Your Org"
npm run seed:demo      # creates/resets the demo tenant with fictional sample data
```

## Why two deployable apps?

Sending a large invitation list is deliberately paced over hours or days (Part 7 of the spec) so it reads as human rather than bulk mail. That means sending cannot live inside the Next.js app's request/response lifecycle or the Host's browser tab - it has to be a persistent background process that survives closed laptops, server restarts, and deploys. `apps/worker` is that process; `docs/DATA_MODEL.md` explains exactly how it guarantees no recipient is ever double-sent or skipped.

## Status

This is a from-scratch build against the full specification. See `docs/TEST_CHECKLIST.md` for what to verify against a real deployment before treating any part of it as production-proven - in particular, nothing here has been exercised against a live Supabase project, a live Microsoft mailbox, or a live Anthropic key yet, since those all require credentials only the operator can provide.
