'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getMessagePreviewAction, getFormPreviewAction, type MessagePreview, type SendJobType } from './actions';
import type { PublicFormData } from '@/lib/public-form';

export default function MessagePreviewModal({
  eventId,
  jobType,
  jobLabel,
  onClose,
}: {
  eventId: string;
  jobType: SendJobType;
  jobLabel: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'email' | 'form'>('email');
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [formData, setFormData] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getMessagePreviewAction(eventId, jobType), getFormPreviewAction(eventId)]).then(([msg, form]) => {
      if (cancelled) return;
      setPreview(msg);
      setFormData(form);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, jobType]);

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-navy-100">
          <div>
            <h3 className="mb-0">Preview: {jobLabel}</h3>
            <p className="text-navy-500 text-xs">Exactly how this will look — nothing sends from here.</p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close preview">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="shrink-0 flex gap-1 px-5 pt-3 border-b border-navy-100">
          <TabButton active={tab === 'email'} onClick={() => setTab('email')} label="Email" />
          <TabButton active={tab === 'form'} onClick={() => setTab('form')} label="RSVP form" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-navy-50">
          {loading ? (
            <p className="p-8 text-center text-navy-400 text-sm">Loading preview…</p>
          ) : tab === 'email' ? (
            preview ? (
              <EmailPreview preview={preview} />
            ) : (
              <p className="p-8 text-center text-navy-400 text-sm">
                No draft to preview yet — write and approve this message in Compose first.
              </p>
            )
          ) : formData ? (
            <FormPreview data={formData} />
          ) : (
            <p className="p-8 text-center text-navy-400 text-sm">This event doesn’t have a form set up yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? 'border-navy-900 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmailPreview({ preview }: { preview: MessagePreview }) {
  return (
    <div className="p-5">
      {preview.isSampleRecipient ? (
        <p className="text-xs text-warn bg-warn-bg border border-warn/25 rounded px-3 py-2 mb-4">
          No one is eligible for this message yet, so this shows a sample recipient — the real thing will look
          identical once there’s someone real to send it to.
        </p>
      ) : null}
      <div className="rounded-lg border border-navy-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-navy-100 px-4 py-3 text-sm space-y-1">
          <Row label="From" value={preview.fromEmail ?? 'Your connected mailbox'} />
          <Row label="To" value={`${preview.recipientName}${preview.recipientEmail ? ` <${preview.recipientEmail}>` : ''}`} />
          <Row label="Subject" value={preview.subject} bold />
        </div>
        <div className="p-5 text-sm text-navy-900" dangerouslySetInnerHTML={{ __html: preview.htmlBody }} />
        {preview.attachments.length > 0 ? (
          <div className="border-t border-navy-100 px-4 py-3 flex flex-wrap gap-2">
            {preview.attachments.map((a, i) => (
              <span key={i} className="badge-neutral">
                📎 {a.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-navy-400 w-16 shrink-0">{label}</span>
      <span className={bold ? 'font-medium text-navy-900' : 'text-navy-700'}>{value}</span>
    </div>
  );
}

function FormPreview({ data }: { data: PublicFormData }) {
  const { branding } = data;
  return (
    <div className="p-5">
      <p className="text-xs text-navy-500 bg-white border border-navy-200 rounded px-3 py-2 mb-4">
        This is what invitees see when they click the RSVP link — read-only here, nothing submits.
      </p>
      <div className="rounded-xl overflow-hidden bg-navy-975 p-6">
        <div className="rounded-[11px] bg-white overflow-hidden max-w-md mx-auto">
          <div className="p-6">
            {branding.logoUrl ? (
              <div className="flex justify-center mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt="" className="max-h-16 max-w-full object-contain" />
              </div>
            ) : null}
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: branding.accentColor ?? undefined }}>
              You’re invited
            </p>
            <h1 className="text-xl mb-2" style={{ color: branding.primaryColor ?? undefined }}>
              {data.event.publicTitle}
            </h1>
            <div className="text-sm text-navy-600 space-y-1 mb-4 bg-navy-50 rounded-md p-3">
              {data.event.startsAtFormatted ? <p>{data.event.startsAtFormatted}</p> : null}
              {data.event.venueLine ? <p>{data.event.venueLine}</p> : null}
              {data.event.rsvpDeadlineFormatted ? <p>Please respond by {data.event.rsvpDeadlineFormatted}</p> : null}
            </div>
            {data.introText ? <p className="text-navy-700 text-sm mb-4">{data.introText}</p> : null}
            <div className="space-y-2">
              {data.questions.map((q) => (
                <div key={q.id} className="border border-navy-100 rounded px-3 py-2 text-sm text-navy-700">
                  {q.label}
                  {q.is_required ? <span className="text-danger"> *</span> : null}
                </div>
              ))}
            </div>
            <div className="btn-primary w-full justify-center mt-4 opacity-50 pointer-events-none">Submit response</div>
          </div>
        </div>
      </div>
    </div>
  );
}
