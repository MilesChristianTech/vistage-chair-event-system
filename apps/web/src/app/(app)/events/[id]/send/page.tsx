import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import SendClient from './send-client';
import { getActiveSendJobsAction } from './actions';

export const dynamic = 'force-dynamic';

const JOB_TYPES = [
  { type: 'invitation', label: 'Initial invitation' },
  { type: 'reminder', label: 'Reminder' },
  { type: 'priority_follow_up', label: 'Priority follow-up' },
  { type: 'rsvp_confirmation', label: 'RSVP confirmation' },
  { type: 'final_details', label: 'Final details' },
  { type: 'waitlist', label: 'Waitlist notice' },
  { type: 'cancellation', label: 'Cancellation / change' },
  { type: 'thank_you', label: 'Thank you' },
  { type: 'post_event_follow_up', label: 'Post-event follow-up' },
] as const;

export default async function SendPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: event } = await supabase.from('events').select('id, public_title').eq('id', params.id).single();
  if (!event) notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('message_type, is_approved')
    .eq('event_id', params.id);

  const approvedByType = new Map((messages ?? []).map((m) => [m.message_type, m.is_approved]));
  const jobs = await getActiveSendJobsAction(params.id);

  return (
    <AppPageBody>
      <SendClient
        eventId={params.id}
        eventTitle={event.public_title}
        jobTypeOptions={JOB_TYPES.map((jt) => ({ ...jt, approved: approvedByType.get(jt.type) ?? false }))}
        initialJobs={jobs}
      />
    </AppPageBody>
  );
}
