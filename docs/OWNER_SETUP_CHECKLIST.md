# Owner Setup Checklist

Everything in this document requires **your** manual action — an account, a key, a click sequence only you (the operator) can do. Nothing here can be automated away; it's collected in one place, in order, so nothing is buried.

Work through it top to bottom the first time. Total time: roughly 60–90 minutes if you already have Supabase and Railway accounts (the spec assumes you do).

---

## 1. Supabase (database, auth, storage)

1. Create a new Supabase project (or use an existing organization).
2. In the SQL Editor, run every file in `supabase/migrations/` **in filename order** (0001, 0002, 0003, 0004, 0005, 0006). Each one is idempotent-safe to read through before running; together they create every table, the row-level security policies, and the tenant auto-provisioning trigger.
3. From Project Settings → API, copy three values — you'll paste them into both `apps/web/.env.local` and `apps/worker/.env`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web app only)
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (web app **and** worker — treat this like a root password; never expose it to the browser, never commit it)
4. Storage bucket for whitelabel images (logos, header images) is optional for the pilot — the Branding section in Settings currently takes plain image URLs. If you'd like the Host to upload files directly instead of pasting a URL, create a public Supabase Storage bucket named `branding` and this is a natural place for a future enhancement (see `docs/DATA_MODEL.md`).

## 2. The Anthropic API key (Invitation Coach + message variation)

1. Create an API key at console.anthropic.com.
2. Set `ANTHROPIC_API_KEY` in `apps/web/.env.local` (and in Vercel's environment variables once deployed). The worker does not need this key — only the web app calls Anthropic.
3. Optional: set `ANTHROPIC_MODEL` if you want to pin a specific model id; it defaults to `claude-sonnet-5`.
4. This is a metered, per-call cost — budget it as part of your per-Host running cost.

## 3. Microsoft Azure AD app registration (mailbox connection)

This is the fiddliest one-time step. One app registration serves every Host — each Host authorizes it individually later from Settings.

1. Go to portal.azure.com → **Azure Active Directory** (Entra ID) → **App registrations** → **New registration**.
2. Name it (e.g. "Chair Event System"). Under "Supported account types," choose **"Accounts in any organizational directory and personal Microsoft accounts"** — this lets a Host with a personal Microsoft 365 mailbox connect too.
3. Redirect URI: type **Web**, value `https://your-production-domain.com/api/auth/microsoft/callback` (and add a second one for local dev: `http://localhost:3000/api/auth/microsoft/callback`).
4. After creation, copy the **Application (client) ID** → `MICROSOFT_CLIENT_ID`.
5. Go to **Certificates & secrets** → **New client secret**. Copy the secret **value** immediately (it's hidden after you leave the page) → `MICROSOFT_CLIENT_SECRET`.
6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → add `Mail.Send`, `User.Read`, `offline_access`. You do not need admin consent for these (they're standard delegated, user-consentable permissions) — each Host consents individually the first time they click "Connect your Microsoft account."
7. Set `MICROSOFT_TENANT_ID=common` (this is what allows both work/school and personal Microsoft accounts to sign in) in both the web app's and worker's environment.
8. Set `MICROSOFT_REDIRECT_URI` to match exactly what you registered in step 3.

## 4. Token encryption key

Generate a 32-byte key and put the **same value** in both `apps/web/.env.local` and `apps/worker/.env` as `TOKEN_ENCRYPTION_KEY`:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

If this ever needs to rotate, every connected Host's mailbox will need to reconnect (their stored refresh token becomes undecryptable) — treat it like any other production secret.

## 5. Deploy the application (Vercel recommended)

1. Push this repository to GitHub (or your git host of choice).
2. Import it into Vercel, with **`apps/web`** as the project root directory.
3. Add every variable from `apps/web/.env.example` to Vercel's Environment Variables (Production **and** Preview, if you use preview deployments).
4. Set `NEXT_PUBLIC_APP_URL` to your real production URL once you have one (it's used to build the RSVP links embedded in emails).
5. Deploy. Confirm the sign-in screen loads at your domain and nothing else is reachable without signing in.

## 6. Deploy the send worker (Railway recommended)

1. Create a new Railway service pointed at the same repository, with **`apps/worker`** as the root/start directory. Build command: `npm install && npm run build`. Start command: `npm start`.
2. Add every variable from `apps/worker/.env.example`.
3. Deploy it as an **always-on** service (not a cron job / not serverless) — Part 2.2 of the build spec depends on this being a persistent process that keeps polling even when no Host is looking at their browser.
4. Watch the logs after deploy — you should see `[worker] Chair Event System send worker starting.` and, once a real send is running, `[worker] sent to ...` lines. This is your primary place to see what's happening with sends (Part 12: observability).

## 7. Provisioning the pilot Host's account

There is no signup page by design (Part 2.5). Run this from your machine (needs `apps/web/.env.local` filled in):

```
cd apps/web
npm run provision:tenant -- --email cindy@example.com --password "TempPassword123!" --name "Cindy Smith" --tenant "Cindy Smith Coaching"
```

Give the Host the URL, email, and temporary password. Tell them to set their own password from **Settings → Change password** on first login.

To provision a second Host later, run the exact same command with different values — this is the entire "onboarding" process referenced throughout the build spec.

## 8. Creating and resetting the demo account

```
cd apps/web
npm run seed:demo
```

The first run creates a dedicated demo tenant and a login (defaults to `demo@example.com` / `ChangeMe123!Demo` — override with `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD` env vars before running). Every subsequent run (`npm run reset:demo`, an alias for the same script) wipes and re-seeds the demo tenant's sample data, so you always start a demo from a clean, fictional state.

**Confirmed:** the demo tenant's `send_jobs.is_simulated` flag is always `true` (see `apps/worker/src/index.ts`, `markSent`) — the worker never calls Microsoft Graph for a demo-tenant send. A real email cannot leave the demo account even if someone connects a real mailbox to it by mistake.

## 9. Domain and deliverability notes

Because every send genuinely originates from the Host's own mailbox (Part 7.1), deliverability depends on **the Host's own domain**, not on this app's infrastructure. There's nothing to configure here on your end beyond:
- Encouraging each Host to make sure their own domain has healthy SPF/DKIM/DMARC (this is standard Microsoft 365 admin hygiene, not something this app controls).
- If a Host's mailbox is ever flagged as throttled repeatedly, that's a signal to have them check their own tenant's sending reputation with their IT admin — the app surfaces this status automatically (Settings → Email connection).

## 10. Terms of Service and Privacy Policy

Placeholder documents live at `docs/TERMS_OF_SERVICE.md` and `docs/PRIVACY_POLICY.md`. **These are not legal advice and are not a substitute for review by a qualified professional** before onboarding any paying Host beyond the pilot. Wire the acceptance step into sign-in when you're ready to expand past a single Host — for the pilot, having the documents exist and be linkable is sufficient.

## 11. Final smoke test before handing off to the Host

- [ ] Sign in as the pilot Host; land on the dashboard, not a blank screen.
- [ ] Connect the Host's Microsoft account in Settings; confirm it shows "Connected as [address]".
- [ ] Import a small real (or test) contact list.
- [ ] Create a test event, write an invitation with the Coach, publish the form.
- [ ] Send to 2–3 real addresses you control; confirm they land in your inbox, the RSVP link works, and the response shows up on the dashboard.
- [ ] Sign in to the demo account separately; confirm its data is obviously fictional and unrelated to the Host's real tenant.

Once all of the above pass, you're ready to hand the Host `docs/HOST_QUICKSTART.md`.
