-- Lets a Host paste a few of their own past emails so the Invitation Coach
-- can match their real voice/tone/format instead of writing generically.
alter table tenant_settings add column voice_samples text[] not null default '{}';
