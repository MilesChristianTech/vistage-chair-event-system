'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  generateDraftAction,
  saveMessageAction,
  refineDraftAction,
  strengthenDraftAction,
  approveMessageAction,
  generateSuiteAction,
  type AttachmentRef,
} from './actions';
import VariantsPanel, { type VariantRow } from './variants-panel';
import PersonalTouches, { type InviteeForTouch } from './personal-touches';

export interface MessageRow {
  id: string;
  message_type: string;
  subject: string | null;
  body: string;
  attachment_urls: AttachmentRef[];
  is_approved: boolean;
}

const MESSAGE_LABELS: Record<string, string> = {
  invitation: 'Initial invitation',
  reminder: 'Reminder',
  priority_follow_up: 'Priority follow-up',
  rsvp_confirmation: 'RSVP confirmation',
  final_details: 'Final details',
  waitlist: 'Waitlist notice',
  cancellation: 'Cancellation / change',
  thank_you: 'Thank you (post-event)',
  post_event_follow_up: 'Follow-up (no-shows/declines)',
  form_intro: 'Form intro text',
  form_confirmation: 'Form confirmation screen',
};

export default function ComposeClient({
  eventId,
  messages,
  variants,
  invitedCount,
  variantThreshold,
  variantCountMin,
  variantCountMax,
  invitations,
  alreadySentTypes = [],
}: {
  eventId: string;
  messages: MessageRow[];
  variants: VariantRow[];
  invitedCount: number;
  variantThreshold: number;
  variantCountMin: number;
  variantCountMax: number;
  invitations: InviteeForTouch[];
  alreadySentTypes?: string[];
}) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState('invitation');
  const [view, setView] = useState<'message' | 'variants' | 'touches'>('message');

  const selected = messages.find((m) => m.message_type === selectedType);

  const [subject, setSubject] = useState(selected?.subject ?? '');
  const [body, setBody] = useState(selected?.body ?? '');
  const [attachments, setAttachments] = useState<AttachmentRef[]>(selected?.attachment_urls ?? []);
  const [instruction, setInstruction] = useState('');
  const [improvements, setImprovements] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSubject(selected?.subject ?? '');
    setBody(selected?.body ?? '');
    setAttachments(selected?.attachment_urls ?? []);
    setImprovements(null);
    setDirty(false);
    setError(null);
  }, [selectedType, selected?.subject, selected?.body, selected?.attachment_urls]);

  function save() {
    if (!selected) return;
    startTransition(async () => {
      const result = await saveMessageAction(selected.id, { subject, body, attachment_urls: attachments });
      if (!result.ok) setError(result.error || 'Could not save.');
      else {
        setDirty(false);
        toast.success('Draft saved.');
        router.refresh();
      }
    });
  }

  function addAttachment() {
    setAttachments((a) => [...a, { name: '', url: '' }]);
    setDirty(true);
  }

  function updateAttachment(index: number, patch: Partial<AttachmentRef>) {
    setAttachments((a) => a.map((att, i) => (i === index ? { ...att, ...patch } : att)));
    setDirty(true);
  }

  function removeAttachment(index: number) {
    setAttachments((a) => a.filter((_, i) => i !== index));
    setDirty(true);
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateDraftAction(eventId, selectedType);
      if (!result.ok) {
        setError(result.error || 'Could not generate a draft.');
        return;
      }
      setSubject(result.subject ?? '');
      setBody(result.body ?? '');
      setDirty(false);
      router.refresh();
    });
  }

  function askCoach() {
    if (!instruction.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await refineDraftAction({ eventId, currentSubject: subject, currentBody: body, instruction });
      if (!result.ok) {
        setError(result.error || 'Could not apply that change.');
        return;
      }
      setSubject(result.subject ?? '');
      setBody(result.body ?? '');
      setInstruction('');
      setDirty(true);
    });
  }

  function strengthen() {
    setError(null);
    startTransition(async () => {
      const result = await strengthenDraftAction({ eventId, currentSubject: subject, currentBody: body });
      if (!result.ok) {
        setError(result.error || 'Could not strengthen this draft.');
        return;
      }
      setSubject(result.subject ?? '');
      setBody(result.body ?? '');
      setImprovements(result.improvements ?? []);
      setDirty(true);
    });
  }

  function toggleApprove() {
    if (!selected) return;
    const willApprove = !selected.is_approved;
    setError(null);
    startTransition(async () => {
      const result = await approveMessageAction(selected.id, willApprove);
      if (!result.ok) {
        setError(result.error || 'Could not update approval status.');
        return;
      }
      toast.success(willApprove ? 'Approved.' : 'Approval removed — back to draft.');
      router.refresh();
    });
  }

  function generateSuite() {
    setError(null);
    startTransition(async () => {
      const result = await generateSuiteAction(eventId);
      if (!result.ok) setError(result.error || 'Could not generate the message suite.');
      else {
        toast.success('Full message suite generated — every message is a draft, ready for your review.');
        router.refresh();
      }
    });
  }

  const invitationMessage = messages.find((m) => m.message_type === 'invitation');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="space-y-1">
        {messages.map((m) => (
          <button
            key={m.message_type}
            onClick={() => {
              setSelectedType(m.message_type);
              setView('message');
            }}
            className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
              selectedType === m.message_type && view === 'message' ? 'bg-navy-900 text-white' : 'hover:bg-navy-50 text-navy-800'
            }`}
          >
            <span>{MESSAGE_LABELS[m.message_type] ?? m.message_type}</span>
            {m.is_approved ? <span className="status-dot bg-success" title="Approved" /> : null}
          </button>
        ))}

        {invitationMessage ? (
          <>
            <div className="border-t border-navy-100 my-2" />
            <button
              onClick={() => setView('variants')}
              className={`w-full text-left px-3 py-2 rounded text-sm ${view === 'variants' ? 'bg-navy-900 text-white' : 'hover:bg-navy-50 text-navy-800'}`}
            >
              Variants {invitedCount >= variantThreshold ? '(recommended)' : ''}
            </button>
            <button
              onClick={() => setView('touches')}
              className={`w-full text-left px-3 py-2 rounded text-sm ${view === 'touches' ? 'bg-navy-900 text-white' : 'hover:bg-navy-50 text-navy-800'}`}
            >
              Personal touches
            </button>
          </>
        ) : null}

        {invitationMessage?.is_approved ? (
          <div className="pt-3">
            <button className="btn-secondary w-full" onClick={generateSuite} disabled={isPending}>
              {isPending ? 'Generating…' : 'Generate full message suite'}
            </button>
            <p className="field-hint">Creates reminder, follow-up, confirmation, and all the rest from your approved invitation.</p>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-3">
        {view === 'variants' && invitationMessage ? (
          <VariantsPanel
            eventId={eventId}
            variants={variants}
            invitedCount={invitedCount}
            threshold={variantThreshold}
            countMin={variantCountMin}
            countMax={variantCountMax}
          />
        ) : view === 'touches' ? (
          <PersonalTouches eventId={eventId} invitations={invitations} />
        ) : selected ? (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="mb-0">{MESSAGE_LABELS[selected.message_type] ?? selected.message_type}</h3>
              <div className="flex items-center gap-2">
                {selected.is_approved ? (
                  <span className="badge-success">Approved</span>
                ) : (
                  <span className="badge-warn">Draft — not approved</span>
                )}
              </div>
            </div>

            {alreadySentTypes.includes(selected.message_type) ? (
              <div className="rounded border border-navy-200 bg-navy-50 text-navy-700 text-sm px-3 py-2 mb-4">
                This message already went out to some people. Editing it now only changes what{' '}
                <em>hasn’t been sent yet</em> — it can’t rewrite what already landed in someone’s inbox. If you need
                to correct something they already received, send a follow-up instead.
              </div>
            ) : null}

            {!selected.body ? (
              <div className="text-center py-10">
                <p className="text-navy-500 text-sm mb-4">No draft yet.</p>
                <button className="btn-primary" onClick={generate} disabled={isPending}>
                  {isPending ? 'Writing…' : 'Have the Coach draft this'}
                </button>
                {error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2 mt-4 max-w-md mx-auto">{error}</p> : null}
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label className="field-label">Subject</label>
                  <input
                    className="input"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="mb-4">
                  <label className="field-label">Body</label>
                  <textarea
                    className="input font-sans"
                    rows={14}
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="mb-4">
                  <label className="field-label">Attachments</label>
                  <p className="field-hint mb-2">
                    A link to a file (e.g. an event poster PDF) — hosted anywhere reachable by a plain URL. Attached
                    to every email this message sends.
                  </p>
                  {attachments.map((att, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        className="input"
                        placeholder="File name (e.g. Event Poster.pdf)"
                        value={att.name}
                        onChange={(e) => updateAttachment(i, { name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="https://…"
                        value={att.url}
                        onChange={(e) => updateAttachment(i, { url: e.target.value })}
                      />
                      <button type="button" className="btn-ghost text-xs shrink-0" onClick={() => removeAttachment(i)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary text-xs" onClick={addAttachment}>
                    Add attachment
                  </button>
                </div>

                {improvements && improvements.length > 0 ? (
                  <div className="mb-4 bg-navy-50 rounded p-3 text-sm">
                    <p className="font-medium text-navy-800 mb-1">What changed and why:</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-navy-700">
                      {improvements.map((imp, i) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2 mb-4">{error}</p> : null}

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button className="btn-primary" onClick={save} disabled={isPending || !dirty}>
                    Save
                  </button>
                  <button className="btn-secondary" onClick={generate} disabled={isPending}>
                    Regenerate
                  </button>
                  <button className="btn-secondary" onClick={strengthen} disabled={isPending}>
                    Make it more compelling
                  </button>
                  <button
                    className={selected.is_approved ? 'btn-secondary' : 'btn-primary'}
                    onClick={toggleApprove}
                    disabled={isPending || dirty}
                    title={dirty ? 'Save your changes first' : undefined}
                  >
                    {selected.is_approved ? 'Un-approve' : 'Approve'}
                  </button>
                </div>

                <div className="border-t border-navy-100 pt-4">
                  <label className="field-label">Ask the Coach to change this</label>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder='e.g. "make this warmer" or "shorter"'
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && askCoach()}
                    />
                    <button className="btn-secondary shrink-0" onClick={askCoach} disabled={isPending || !instruction.trim()}>
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
