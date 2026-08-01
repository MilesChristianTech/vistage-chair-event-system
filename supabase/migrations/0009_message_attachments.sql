-- Lets a Host attach a file (e.g. an event poster PDF) to a message, by
-- URL rather than a full upload pipeline - the worker fetches the bytes at
-- send time and attaches them to the Graph API request. Stored on both
-- messages (the editable draft) and send_job_recipients (frozen at enqueue
-- time, same as resolved_subject/resolved_body, so an edit after a send has
-- started never changes what's already scheduled).
alter table messages add column attachment_urls jsonb not null default '[]';
alter table send_job_recipients add column attachment_urls jsonb not null default '[]';
