import 'dotenv/config';
import { getServiceClient } from './supabase';
import { decryptSecret } from './crypto';
import { refreshAccessToken, sendMail, classifyGraphError } from './graph';
import { resolveAttachments } from './attachments';

/**
 * The send worker (Part 2.2, 7.6) — the single most important reliability
 * component in the product. It holds nothing important in memory: every
 * cycle it asks the database "what's due next, across every tenant?", acts
 * on a small batch, and writes the result back immediately. If this process
 * is killed at any point — mid-batch, mid-send, between cycles — the next
 * start (by Railway's own restart policy, or a fresh deploy) picks up
 * exactly where the database says to, with no double-sends and no skips.
 *
 * Run with: npm run worker   (see package.json / docs/OWNER_SETUP_CHECKLIST.md)
 */

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE || 5);
const REAP_EVERY_N_CYCLES = 24; // roughly every 2 minutes at a 5s poll interval

const supabase = getServiceClient();

// Pure performance cache — losing it costs one extra token refresh, nothing
// more. Never treated as a source of truth (2.2).
const accessTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

async function getAccessTokenForTenant(tenantId: string): Promise<
  { ok: true; accessToken: string } | { ok: false; reason: 'disconnected' | 'needs_reconnect' }
> {
  const cached = accessTokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { ok: true, accessToken: cached.accessToken };
  }

  const { data: mailbox } = await supabase
    .from('mailbox_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!mailbox || !mailbox.encrypted_refresh_token) {
    return { ok: false, reason: 'disconnected' };
  }

  try {
    const refreshToken = decryptSecret(mailbox.encrypted_refresh_token);
    const { accessToken, expiresOn } = await refreshAccessToken(refreshToken);
    accessTokenCache.set(tenantId, { accessToken, expiresAt: expiresOn.getTime() });

    if (mailbox.status !== 'connected') {
      await supabase
        .from('mailbox_connections')
        .update({ status: 'connected', last_error: null, last_checked_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
    }

    return { ok: true, accessToken };
  } catch (err) {
    await supabase
      .from('mailbox_connections')
      .update({
        status: 'needs_reconnect',
        last_error: err instanceof Error ? err.message : 'Token refresh failed',
        last_checked_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);
    return { ok: false, reason: 'needs_reconnect' };
  }
}

interface ClaimedRecipient {
  id: string;
  tenant_id: string;
  send_job_id: string;
  invitation_id: string;
  resolved_subject: string;
  resolved_body: string;
  attachment_urls: { name?: string; url?: string }[] | null;
  attempt_count: number;
}

async function processRecipient(row: ClaimedRecipient) {
  const { data: job } = await supabase.from('send_jobs').select('*').eq('id', row.send_job_id).single();
  if (!job) {
    console.error(`[worker] send_job ${row.send_job_id} missing for recipient ${row.id} — marking failed`);
    await supabase
      .from('send_job_recipients')
      .update({ status: 'failed', last_error: 'Parent send job not found' })
      .eq('id', row.id);
    return;
  }

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, person_id, people(email, first_name, last_name, preferred_name)')
    .eq('id', row.invitation_id)
    .single();

  const person = invitation ? (Array.isArray(invitation.people) ? invitation.people[0] : invitation.people) : null;

  if (!invitation || !person?.email) {
    await supabase
      .from('send_job_recipients')
      .update({ status: 'failed', last_error: 'Recipient has no email on file' })
      .eq('id', row.id);
    await supabase.from('send_jobs').update({ failed_count: job.failed_count + 1 }).eq('id', job.id);
    return;
  }

  // Demo tenants never send real email (Part 2.5) — simulate delivery so
  // the operator can demo pacing/progress/variants safely.
  if (job.is_simulated) {
    await markSent(row, job);
    console.log(`[worker] (simulated) sent to ${person.email} — job ${job.id}`);
    return;
  }

  const tokenResult = await getAccessTokenForTenant(row.tenant_id);
  if (!tokenResult.ok) {
    // Not the recipient's fault — release the claim and let it retry once
    // the Host reconnects, without burning an attempt.
    await supabase
      .from('send_job_recipients')
      .update({ status: 'queued', claimed_at: null })
      .eq('id', row.id);
    console.warn(`[worker] tenant ${row.tenant_id} mailbox ${tokenResult.reason} — recipient ${row.id} requeued`);
    return;
  }

  const toName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email;
  const attachments = row.attachment_urls?.length ? await resolveAttachments(row.attachment_urls) : undefined;
  const result = await sendMail({
    accessToken: tokenResult.accessToken,
    toEmail: person.email,
    toName,
    subject: row.resolved_subject,
    htmlBody: row.resolved_body,
    attachments,
  });

  if (result.ok) {
    await markSent(row, job);
    console.log(`[worker] sent to ${person.email} — job ${job.id}`);
    return;
  }

  const errorClass = classifyGraphError(result.status);

  if (errorClass === 'throttled') {
    // Back off this recipient by 5 minutes rather than failing it, and
    // flag the mailbox so the Host sees an honest status (Part 7.1).
    const backoffUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    await supabase
      .from('send_job_recipients')
      .update({ status: 'queued', claimed_at: null, scheduled_at: backoffUntil, attempt_count: row.attempt_count + 1 })
      .eq('id', row.id);
    await supabase
      .from('mailbox_connections')
      .update({ status: 'throttled', last_error: 'Microsoft is temporarily rate-limiting this mailbox.' })
      .eq('tenant_id', row.tenant_id);
    console.warn(`[worker] throttled for tenant ${row.tenant_id} — backing off recipient ${row.id}`);
    return;
  }

  if (errorClass === 'needs_reconnect') {
    await supabase
      .from('send_job_recipients')
      .update({ status: 'queued', claimed_at: null })
      .eq('id', row.id);
    await supabase
      .from('mailbox_connections')
      .update({ status: 'needs_reconnect', last_error: result.error ?? 'Authorization expired' })
      .eq('tenant_id', row.tenant_id);
    return;
  }

  if (errorClass === 'transient' && row.attempt_count < 4) {
    const backoffMs = Math.min(30_000 * 2 ** row.attempt_count, 30 * 60_000);
    await supabase
      .from('send_job_recipients')
      .update({
        status: 'queued',
        claimed_at: null,
        attempt_count: row.attempt_count + 1,
        scheduled_at: new Date(Date.now() + backoffMs).toISOString(),
        last_error: result.error ?? null,
      })
      .eq('id', row.id);
    return;
  }

  // Permanent failure (or too many transient retries) — surfaced to the
  // Host as "needs attention" rather than silently dropped (Part 7.6).
  await supabase
    .from('send_job_recipients')
    .update({ status: 'failed', attempt_count: row.attempt_count + 1, last_error: result.error ?? 'Send failed' })
    .eq('id', row.id);
  await supabase.from('send_jobs').update({ failed_count: job.failed_count + 1 }).eq('id', job.id);
  await supabase.from('invitations').update({ invite_status: 'bounced' }).eq('id', row.invitation_id);
  console.error(`[worker] permanent failure for recipient ${row.id}: ${result.error}`);
}

// Note for future multi-worker scaling (Part 7.6 anticipates this):
// claim_due_send_recipients() is safe across multiple worker processes
// (SELECT ... FOR UPDATE SKIP LOCKED), but the read-then-write increment of
// send_jobs.sent_count below is not — two workers finishing a send for the
// same job in the same instant could race and lose an increment. Harmless
// today (the pilot runs a single worker instance), but if a second worker
// is ever added, replace this with an atomic SQL increment (a small RPC
// alongside claim_due_send_recipients, e.g. `sent_count = sent_count + 1`)
// rather than this read-modify-write.
async function markSent(row: ClaimedRecipient, job: { id: string; sent_count: number; total_recipients: number; failed_count: number }) {
  const sentAt = new Date().toISOString();
  await supabase
    .from('send_job_recipients')
    .update({ status: 'sent', sent_at: sentAt, claimed_at: null })
    .eq('id', row.id);

  await supabase.from('invitations').update({ invite_status: 'sent' }).eq('id', row.invitation_id);

  const newSentCount = job.sent_count + 1;
  const isComplete = newSentCount + job.failed_count >= job.total_recipients;

  await supabase
    .from('send_jobs')
    .update({
      sent_count: newSentCount,
      ...(isComplete ? { status: 'completed' } : {}),
    })
    .eq('id', job.id);
}

let cycleCount = 0;

async function tick() {
  cycleCount++;

  if (cycleCount % REAP_EVERY_N_CYCLES === 0) {
    const { data: reapedCount } = await supabase.rpc('reap_stuck_send_recipients');
    if (reapedCount && reapedCount > 0) {
      console.warn(`[worker] reaped ${reapedCount} stuck 'sending' recipient(s) back to queued`);
    }
  }

  const { data: claimed, error } = await supabase.rpc('claim_due_send_recipients', { p_limit: BATCH_SIZE });

  if (error) {
    console.error('[worker] claim error:', error.message);
    return;
  }

  for (const row of (claimed as ClaimedRecipient[] | null) ?? []) {
    try {
      await processRecipient(row);
    } catch (err) {
      console.error(`[worker] unhandled error processing recipient ${row.id}:`, err);
      await supabase
        .from('send_job_recipients')
        .update({ status: 'queued', claimed_at: null })
        .eq('id', row.id);
    }
  }
}

async function main() {
  console.log(`[worker] Chair Event System send worker starting. Poll interval: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startedAt = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error('[worker] tick failed:', err);
    }
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, POLL_INTERVAL_MS - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

main().catch((err) => {
  console.error('[worker] fatal error, exiting:', err);
  process.exit(1);
});
