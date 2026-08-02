-- ============================================================================
-- Chair Event System - Atomic claim function for the send worker
--
-- Part 2.2 / 7.6: "the worker holds nothing important in its own memory ...
-- any interruption is harmless." The atomicity that guarantees exactly-once
-- sending lives here: claiming a batch of due recipients is a single
-- SELECT ... FOR UPDATE SKIP LOCKED transaction, so if the worker crashes
-- between claiming and sending, the row is left in 'sending' with a
-- claimed_at timestamp; a companion reaper (below) returns anything stuck
-- in 'sending' for too long back to 'queued'. This is also what lets a
-- second worker process be added later (7.6) without any redesign - two
-- workers calling this function concurrently can never claim the same row.
-- ============================================================================

alter table send_job_recipients drop constraint send_job_recipients_status_check;
alter table send_job_recipients add constraint send_job_recipients_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled'));

alter table send_job_recipients add column if not exists claimed_at timestamptz;

create or replace function claim_due_send_recipients(p_limit int)
returns setof send_job_recipients
language plpgsql
as $$
begin
  return query
    update send_job_recipients
    set status = 'sending', claimed_at = now()
    where id in (
      select sjr.id
      from send_job_recipients sjr
      join send_jobs sj on sj.id = sjr.send_job_id
      where sjr.status = 'queued'
        and sjr.scheduled_at <= now()
        and sj.status = 'running'
      order by sjr.scheduled_at
      limit p_limit
      for update of sjr skip locked
    )
    returning *;
end;
$$;

comment on function claim_due_send_recipients is
  'Called by the send worker every polling cycle. Atomically claims up to p_limit due, queued recipients across ALL tenants (the shared queue, 7.6) so multiple worker processes can never double-send the same recipient.';

-- Reaper: anything claimed but not resolved (sent/failed) within 10 minutes
-- almost certainly means the worker crashed mid-send. Returning it to
-- 'queued' is what makes a crash harmless (2.2) - the next polling cycle,
-- by this worker or a replacement, simply picks it back up. A message is
-- occasionally sent twice only in the rare case the crash happened AFTER
-- Graph accepted the send but BEFORE the result was written back; this is
-- an accepted, documented tradeoff of an at-least-once queue (see
-- docs/DATA_MODEL.md) rather than a fully idempotent send (which Graph's
-- API does not support without a client-supplied idempotency key).
create or replace function reap_stuck_send_recipients()
returns integer
language sql
as $$
  with reaped as (
    update send_job_recipients
    set status = 'queued', claimed_at = null
    where status = 'sending' and claimed_at < now() - interval '10 minutes'
    returning id
  )
  select count(*)::int from reaped;
$$;
