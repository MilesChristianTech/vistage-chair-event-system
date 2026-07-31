import { getAnthropicClient, COACH_MODEL } from '@/lib/anthropic';

/**
 * The Invitation Coach (Part 5) and the message-variation generator
 * (Part 7.5). Every function here is a pure request/response call to
 * Anthropic — no state, no side effects, no sending. Everything it returns
 * is a draft; the caller (a Server Action) is responsible for persisting it
 * as unapproved and letting the Host review it (Part 5.5: "never send
 * anything automatically").
 */

export interface EventContext {
  publicTitle: string;
  eventTypeLabel: string;
  purpose: string | null;
  audienceDescription: string | null;
  valueProposition: string | null;
  speakerDetails: string | null;
  startsAtFormatted: string | null;
  venueLine: string | null;
  rsvpDeadlineFormatted: string | null;
  hostDisplayName: string | null;
  hostSignature: string | null;
  formLinkPlaceholder: string;
}

const GUARDRAILS = `
You are the Invitation Coach inside the Chair Event System, helping a Host — a
respected, commercially sophisticated executive-event convener — write
communications to CEOs, presidents, founders, and senior executives.

Non-negotiable rules (violating any of these is a failure):
- Never invent facts: no fabricated speaker credentials, attendee names, social
  proof, capacity figures, or urgency. If a fact is missing from the event
  context provided, write a clearly bracketed placeholder like [confirm venue
  parking details] rather than inventing one.
- Never use manipulative, deceptive, exclusionary, discriminatory, or coercive
  language. No fake urgency, no manufactured scarcity, no guilt.
- Never imply endorsement by an organization not explicitly stated in context.
- RSVP language is always affirmative and human: "Yes, I plan to attend" / "I
  cannot attend" / "I'm not certain yet" — never "Accept" / "Decline".
- Respect the recipient's intelligence and time. Do not over-explain basics.
- Sound like a specific, warm human host — not a marketing department, not a
  generic AI. Avoid cliché AI phrasing ("I hope this email finds you well",
  "in today's fast-paced world", excessive exclamation points, corporate
  buzzwords).

Quality bar for any invitation-family message (Part 9 of the build spec):
- Subject line: specific, credible, concise (~35-55 characters), leads with
  topic/relevance/trusted host — never the word "Invitation".
- First ~75 words make clear why THIS recipient should care.
- A logistics block (date, time, location or virtual link, RSVP deadline) is
  scannable and consistent.
- Exactly one call to action.
- Initial invitations run ~175-300 words unless the event genuinely needs more.
- Warm, low-pressure close with an easy way to ask questions.
`.trim();

async function callForJSON<T>(params: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  if (process.env.PREVIEW_MODE === 'true') {
    const { buildPreviewResponse } = await import('@/lib/preview/coach-fixtures');
    // A believable delay so the UI's loading states are visible too.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return buildPreviewResponse(params.toolName, params.user) as T;
  }

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: params.schema as any,
      },
    ],
    tool_choice: { type: 'tool', name: params.toolName },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolUse = (response.content as any[]).find((block) => block.type === 'tool_use') as
    | { type: 'tool_use'; input: unknown }
    | undefined;

  if (!toolUse) {
    throw new Error('The writing assistant did not return a structured draft. Please try again.');
  }

  return toolUse.input as T;
}

function contextBlock(ctx: EventContext): string {
  return `
Event facts (do not invent anything beyond this):
- Public title: ${ctx.publicTitle}
- Event type: ${ctx.eventTypeLabel}
- Purpose: ${ctx.purpose ?? '[not provided]'}
- Intended audience: ${ctx.audienceDescription ?? '[not provided]'}
- Value proposition: ${ctx.valueProposition ?? '[not provided]'}
- Speaker/facilitator: ${ctx.speakerDetails ?? '[not provided]'}
- Date/time: ${ctx.startsAtFormatted ?? '[not yet scheduled]'}
- Venue/link: ${ctx.venueLine ?? '[not provided]'}
- RSVP deadline: ${ctx.rsvpDeadlineFormatted ?? '[not provided]'}
- Host name: ${ctx.hostDisplayName ?? '[Host name]'}
- Host signature block: ${ctx.hostSignature ?? '[Host name]'}
- RSVP link placeholder to include verbatim: ${ctx.formLinkPlaceholder}
`.trim();
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string', description: 'Plain-text email body, using \\n\\n between paragraphs.' },
  },
  required: ['subject', 'body'],
};

export async function generateInvitationDraft(ctx: EventContext) {
  return callForJSON<{ subject: string; body: string }>({
    system: GUARDRAILS,
    user: `Write the initial invitation email for this event.\n\n${contextBlock(ctx)}\n\nGreet the recipient as {{greeting_name}} — leave that merge tag literally in the text, it is resolved per-recipient later. Sign off using the host signature block. Return via the tool.`,
    toolName: 'return_draft',
    toolDescription: 'Return the drafted invitation email.',
    schema: DRAFT_SCHEMA,
  });
}

export async function refineDraft(params: {
  ctx: EventContext;
  currentSubject: string;
  currentBody: string;
  instruction: string;
  selectedPassage?: string;
}) {
  const { ctx, currentSubject, currentBody, instruction, selectedPassage } = params;
  return callForJSON<{ subject: string; body: string }>({
    system: GUARDRAILS,
    user: `${contextBlock(ctx)}

Current draft:
Subject: ${currentSubject}
Body:
${currentBody}

${selectedPassage ? `The Host highlighted this passage specifically:\n"""${selectedPassage}"""\n` : ''}
The Host's instruction: "${instruction}"

Apply the instruction${selectedPassage ? ' to the highlighted passage, keeping the rest of the email intact' : ' to the whole draft'} and return the complete updated draft (full subject and full body, not just the changed part).`,
    toolName: 'return_draft',
    toolDescription: 'Return the revised draft.',
    schema: DRAFT_SCHEMA,
  });
}

export async function strengthenDraft(params: {
  ctx: EventContext;
  currentSubject: string;
  currentBody: string;
}) {
  const { ctx, currentSubject, currentBody } = params;
  return callForJSON<{ subject: string; body: string; improvements: string[] }>({
    system: GUARDRAILS,
    user: `${contextBlock(ctx)}

Current draft:
Subject: ${currentSubject}
Body:
${currentBody}

Diagnose this draft's weaknesses in relevance, value clarity, and overall clarity — then produce a stronger version. It must NOT sound like marketing copy: no superlatives, no hype, no invented specifics. Also return a short list (2-4 items) of the most consequential improvements you made, in plain language a non-technical Host would appreciate (e.g. "Moved the value proposition into the first sentence so a busy exec sees it immediately").`,
    toolName: 'return_strengthened_draft',
    toolDescription: 'Return the strengthened draft and a plain-language list of the key improvements made.',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        improvements: { type: 'array', items: { type: 'string' } },
      },
      required: ['subject', 'body', 'improvements'],
    },
    maxTokens: 2560,
  });
}

const SUITE_MESSAGE_TYPES = [
  { key: 'reminder', label: 'Reminder', hint: 'Sent to non-responders partway to the RSVP deadline. Warm nudge, restates the value briefly, one CTA.' },
  { key: 'priority_follow_up', label: 'Priority follow-up', hint: 'A more personal nudge for high-priority non-responders close to the deadline. Slightly warmer/more direct, still no pressure tactics.' },
  { key: 'rsvp_confirmation', label: 'RSVP confirmation', hint: 'Sent immediately after someone RSVPs yes. Confirms details, builds anticipation, no pitch.' },
  { key: 'final_details', label: 'Final details / logistics', hint: 'Sent to confirmed attendees shortly before the event. Practical: parking, timing, what to expect.' },
  { key: 'waitlist', label: 'Waitlist notice', hint: 'Sent when capacity is reached. Honest about being at capacity, warm, offers to notify if a seat opens.' },
  { key: 'cancellation', label: 'Cancellation / change notice', hint: 'Used if the event is cancelled or a major detail changes. Clear, apologetic where appropriate, no spin.' },
  { key: 'thank_you', label: 'Post-event thank-you', hint: 'Sent to attendees after the event. Genuine thanks, no ask.' },
  { key: 'post_event_follow_up', label: 'Post-event follow-up for no-shows/declines', hint: 'Warm, no guilt, leaves the door open for next time.' },
  { key: 'form_intro', label: 'RSVP form intro text', hint: 'Short (2-3 sentences) intro text shown at the top of the hosted RSVP form itself.' },
  { key: 'form_confirmation', label: 'RSVP form confirmation screen', hint: 'Short thank-you copy shown immediately after someone submits the form.' },
] as const;

export type SuiteMessageKey = (typeof SUITE_MESSAGE_TYPES)[number]['key'];

export async function generateMessageSuite(ctx: EventContext, invitationDraft: { subject: string; body: string }) {
  const results: Partial<Record<SuiteMessageKey, { subject: string; body: string }>> = {};

  await Promise.all(
    SUITE_MESSAGE_TYPES.map(async (spec) => {
      const draft = await callForJSON<{ subject: string; body: string }>({
        system: GUARDRAILS,
        user: `${contextBlock(ctx)}

The approved initial invitation (for consistent tone/facts/voice):
Subject: ${invitationDraft.subject}
Body:
${invitationDraft.body}

Now write the "${spec.label}" message for this same event. ${spec.hint} Keep it consistent with the invitation's facts and the Host's voice. Use the {{greeting_name}} merge tag for the greeting where a greeting applies. Include the RSVP link placeholder "${ctx.formLinkPlaceholder}" where relevant.`,
        toolName: 'return_draft',
        toolDescription: `Return the drafted ${spec.label} message.`,
        schema: DRAFT_SCHEMA,
      });
      results[spec.key] = draft;
    })
  );

  return results;
}

export async function generateVariants(params: {
  ctx: EventContext;
  canonicalSubject: string;
  canonicalBody: string;
  count: number;
}) {
  const { ctx, canonicalSubject, canonicalBody, count } = params;
  return callForJSON<{ variants: Array<{ subject: string; body: string }> }>({
    system: GUARDRAILS,
    user: `${contextBlock(ctx)}

Canonical, Host-approved invitation:
Subject: ${canonicalSubject}
Body:
${canonicalBody}

Generate ${count} variants of this exact message for deliverability at volume (Part 7.5 of the build spec). Rules:
- Every variant must be semantically identical: same facts, same value proposition, same call to action, same meaning.
- Vary the wording meaningfully — especially the subject line and opening sentence, since spam filters key on those most.
- Every variant must independently meet the same quality bar as the original (not a lesser copy).
- Keep the {{greeting_name}} merge tag and the RSVP link placeholder "${ctx.formLinkPlaceholder}" in every variant.
- Do not vary tone into something inconsistent with a warm, credible executive host.`,
    toolName: 'return_variants',
    toolDescription: 'Return the array of message variants.',
    schema: {
      type: 'object',
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: { subject: { type: 'string' }, body: { type: 'string' } },
            required: ['subject', 'body'],
          },
        },
      },
      required: ['variants'],
    },
    maxTokens: 4096,
  });
}

export async function generateHandwrittenTouch(params: {
  ctx: EventContext;
  personFirstName: string;
  personContext: string;
}) {
  const { ctx, personFirstName, personContext } = params;
  return callForJSON<{ sentence: string }>({
    system: GUARDRAILS,
    user: `${contextBlock(ctx)}

Write ONE short, genuine personal sentence to open this invitee's email, for ${personFirstName}. It should read like the Host wrote it by hand for this specific person — not a generic pleasantry.

Context the Host chose to share about this relationship: "${personContext}"

Do not fabricate anything beyond what's given. If the context is thin, keep the sentence simple and honest rather than inventing detail.`,
    toolName: 'return_touch',
    toolDescription: 'Return the single personal sentence.',
    schema: {
      type: 'object',
      properties: { sentence: { type: 'string' } },
      required: ['sentence'],
    },
    maxTokens: 300,
  });
}
