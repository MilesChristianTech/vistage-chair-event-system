-- Adds an 'immediate' pace profile option, offered in the app only for
-- small recipient lists (a handful of test recipients, not a real invite
-- list) as an explicit, non-default choice — see lib/pacing.ts.
alter table send_jobs drop constraint send_jobs_pace_profile_check;
alter table send_jobs add constraint send_jobs_pace_profile_check
  check (pace_profile in ('immediate', 'fastest', 'one_day', 'two_day', 'custom'));
