import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import ComposeClient from './compose-client';

export const dynamic = 'force-dynamic';
// Coach drafts (Anthropic tool-use calls, sometimes generating a whole
// message suite in parallel) can comfortably exceed Vercel's default 10s
// serverless function limit — this raises it to the Hobby-plan max so a
// slow draft fails with our own friendly error instead of a silent platform
// timeout that looks like the button did nothing.
export const maxDuration = 60;

const MESSAGE_TYPE_ORDER = [
  'invitation',
  'reminder',
  'priority_follow_up',
  'rsvp_confirmation',
  'final_details',
  'waitlist',
  'cancellation',
  'thank_you',
  'post_event_follow_up',
  'form_intro',
  'form_confirmation',
] as const;

export default async function ComposePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: event } = await supabase.from('events').select('id, public_title').eq('id', params.id).single();
  if (!event) notFound();

  const { data: messages } = await supabase.from('messages').select('*').eq('event_id', params.id);
  const invitationMessage = messages?.find((m) => m.message_type === 'invitation');

  const { data: variants } = invitationMessage
    ? await supabase
        .from('message_variants')
        .select('*')
        .eq('message_id', invitationMessage.id)
        .order('variant_index')
    : { data: [] };

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, personalization_note, people(id, first_name, last_name, summary_note)')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false });

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('variant_threshold, variant_count_min, variant_count_max')
    .single();

  const invitedCount = invitations?.length ?? 0;

  // Part 6.3/6.5: editing an already-sent message must never look like a
  // silent no-op or a mysterious lock — the editor stays open (you can
  // always send a fresh correction/update), but it should say plainly that
  // past sends are untouched.
  const { data: sentJobs } = await supabase
    .from('send_jobs')
    .select('job_type')
    .eq('event_id', params.id)
    .in('status', ['running', 'paused', 'completed']);
  const alreadySentTypes = new Set((sentJobs ?? []).map((j) => j.job_type));

  const sortedMessages = MESSAGE_TYPE_ORDER.map((type) => messages?.find((m) => m.message_type === type)).filter(
    (m): m is NonNullable<typeof m> => Boolean(m)
  );

  return (
    <AppPageBody>
      <ComposeClient
        eventId={params.id}
        messages={sortedMessages}
        variants={variants ?? []}
        invitedCount={invitedCount}
        variantThreshold={settings?.variant_threshold ?? 60}
        variantCountMin={settings?.variant_count_min ?? 5}
        variantCountMax={settings?.variant_count_max ?? 8}
        alreadySentTypes={Array.from(alreadySentTypes)}
        invitations={(invitations ?? []).map((inv) => ({
          id: inv.id,
          personalization_note: inv.personalization_note,
          person: Array.isArray(inv.people) ? inv.people[0] ?? null : inv.people,
        }))}
      />
    </AppPageBody>
  );
}
