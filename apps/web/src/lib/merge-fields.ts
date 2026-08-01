/**
 * Merge-field resolution (Part 3.5). Runs once per recipient at enqueue
 * time, producing the frozen, fully-resolved content stored on the send
 * job recipient row (7.6) — so a later edit to the underlying draft can
 * never alter something already scheduled.
 */

export interface MergeFieldContext {
  greetingName: string; // preferred name, falling back to first name — never blank (3.5)
  eventPublicTitle: string;
  formLink: string;
  calendarLink?: string;
  hostDisplayName: string;
  hostSignature: string;
  personalTouch?: string | null;
}

export function resolveGreetingName(person: { preferredName: string | null; firstName: string }): string {
  const candidate = person.preferredName?.trim();
  return candidate && candidate.length > 0 ? candidate : person.firstName;
}

export function resolveMergeFields(template: string, ctx: MergeFieldContext): string {
  let resolved = template
    .replaceAll('{{greeting_name}}', ctx.greetingName)
    .replaceAll('{{event_title}}', ctx.eventPublicTitle)
    .replaceAll('{{form_link}}', ctx.formLink)
    .replaceAll('{{calendar_link}}', ctx.calendarLink ?? '')
    .replaceAll('{{host_name}}', ctx.hostDisplayName)
    .replaceAll('{{host_signature}}', ctx.hostSignature);

  if (ctx.personalTouch && ctx.personalTouch.trim().length > 0) {
    // The handwritten pass (5.4): insert right after the greeting line if a
    // {{personal_touch}} tag exists; otherwise prepend it as its own
    // opening line so it always appears naturally even in older drafts.
    if (resolved.includes('{{personal_touch}}')) {
      resolved = resolved.replaceAll('{{personal_touch}}', ctx.personalTouch.trim());
    } else {
      resolved = `${ctx.personalTouch.trim()}\n\n${resolved}`;
    }
  } else {
    resolved = resolved.replaceAll('{{personal_touch}}', '');
  }

  return resolved;
}

// Only these message types get a calendar link auto-appended when the
// underlying draft doesn't already reference the {{calendar_link}} tag
// itself — a Host-written invitation might deliberately not want it, but a
// confirmation/logistics message benefits from it by default.
const CALENDAR_LINK_RELEVANT_TYPES = new Set(['rsvp_confirmation', 'final_details']);

export function appendCalendarLinkIfRelevant(resolvedBody: string, jobType: string, calendarLink: string | null): string {
  if (!calendarLink || !CALENDAR_LINK_RELEVANT_TYPES.has(jobType)) return resolvedBody;
  if (resolvedBody.includes(calendarLink)) return resolvedBody; // template already used {{calendar_link}}
  return `${resolvedBody}\n\nAdd to your calendar: ${calendarLink}`;
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 1em 0;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}
