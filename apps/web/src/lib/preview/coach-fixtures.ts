// PREVIEW_MODE only — canned Coach responses so the writing-assistant flows
// (draft, refine, strengthen, variants, handwritten touch) can be clicked
// through with no Anthropic key configured. See lib/coach.ts's callForJSON.

function extract(prompt: string, label: string): string | null {
  const m = prompt.match(new RegExp(`${label}:\\s*(.+)`));
  return m ? m[1]!.trim() : null;
}

export function buildPreviewResponse(toolName: string, userPrompt: string): any {
  const title = extract(userPrompt, 'Public title') ?? 'this event';
  const value = extract(userPrompt, 'Value proposition') ?? 'a genuinely useful hour with the right peers';

  const genericBody =
    `{{greeting_name}} —\n\nI'm putting together ${title} and thought of you right away — ${value.toLowerCase().startsWith('[') ? 'it should be a genuinely useful conversation' : value.charAt(0).toLowerCase() + value.slice(1)}.\n\n` +
    `Details:\nDate: [event date]\nLocation: [venue]\nPlease RSVP by [deadline]\n\n` +
    `If this sounds worthwhile, I'd love to have you there: {{form_link}}\n\n{{host_signature}}`;

  switch (toolName) {
    case 'return_draft':
      return { subject: `An invitation: ${title}`.slice(0, 55), body: genericBody };

    case 'return_strengthened_draft':
      return {
        subject: `A quick conversation on ${title}`.slice(0, 55),
        body: genericBody.replace("I'm putting together", "I've been putting together") + '\n\n(Preview mode — connect a real Anthropic key to see this tailored to your actual draft.)',
        improvements: [
          'Moved the value proposition earlier so a busy reader sees it in the first sentence.',
          'Tightened the subject line so it reads as personal rather than promotional.',
          'Simplified the call to action to a single, clear link.',
        ],
      };

    case 'return_variants': {
      const openings = [
        "I'm putting together",
        "I've been organizing",
        "I wanted to personally invite you to",
      ];
      return {
        variants: openings.map((opening, i) => ({
          subject: `${title} — worth an hour?`.slice(0, 55),
          body: genericBody.replace("I'm putting together", opening),
          _previewVariant: i + 1,
        })),
      };
    }

    case 'return_touch':
      return { sentence: 'It was great catching up last time — this felt like exactly the right group for you.' };

    default:
      return {};
  }
}
