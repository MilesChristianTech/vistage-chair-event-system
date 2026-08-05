'use client';

import { useEffect, useState } from 'react';
import ConfirmAction from '@/components/confirm-action';
import { getPaceRecommendations, formatEta, type PaceProfile } from '@/lib/pacing';
import {
  getPreflightStatusAction,
  createSendJobAction,
  pauseSendJobAction,
  resumeSendJobAction,
  cancelSendJobAction,
  type PreflightStatus,
  type SendJobType,
} from './actions';
import JobProgress, { type JobSummary } from './job-progress';
import MessagePreviewModal from './message-preview-modal';

const JOB_LABELS: Record<string, string> = {
  invitation: 'Initial invitation',
  reminder: 'Reminder',
  priority_follow_up: 'Priority follow-up',
  rsvp_confirmation: 'RSVP confirmation',
  final_details: 'Final details',
  waitlist: 'Waitlist notice',
  cancellation: 'Cancellation / change',
  thank_you: 'Thank you',
  post_event_follow_up: 'Post-event follow-up',
};

export default function SendClient({
  eventId,
  eventTitle,
  jobTypeOptions,
  initialJobs,
}: {
  eventId: string;
  eventTitle: string;
  jobTypeOptions: { type: string; label: string; approved: boolean }[];
  initialJobs: JobSummary[];
}) {
  const [selectedType, setSelectedType] = useState<SendJobType>('invitation');
  const [preflight, setPreflight] = useState<PreflightStatus | null>(null);
  const [pace, setPace] = useState<PaceProfile>('fastest');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>(initialJobs);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPreflightStatusAction(eventId, selectedType)
      .then((status) => {
        setPreflight(status);
        const recs = getPaceRecommendations(status.recipientCount);
        setPace(recs.find((r) => r.isRecommended)?.profile ?? 'fastest');
      })
      .finally(() => setLoading(false));
  }, [eventId, selectedType]);

  const recommendations = preflight ? getPaceRecommendations(preflight.recipientCount) : [];

  async function handleSend() {
    setCreateError(null);
    const result = await createSendJobAction({ eventId, jobType: selectedType, paceProfile: pace });
    if (!result.ok) {
      setCreateError(result.error || 'Could not start the send.');
      return { ok: false, error: result.error };
    }
    // Re-fetch preflight (recipient count now 0 for this type) and jobs list.
    const status = await getPreflightStatusAction(eventId, selectedType);
    setPreflight(status);
    if (result.jobId) {
      setJobs((prev) => [
        {
          id: result.jobId!,
          job_type: selectedType,
          status: 'running',
          total_recipients: preflight?.recipientCount ?? 0,
          sent_count: 0,
          failed_count: 0,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    return { ok: true };
  }

  const chosenRec = recommendations.find((r) => r.profile === pace);
  const estimatedFinish = preflight && chosenRec ? new Date(Date.now() + chosenRec.totalSpanMs) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <h3>Send a message</h3>
          <div className="mb-4">
            <label className="field-label">Which message?</label>
            <select className="input max-w-sm" value={selectedType} onChange={(e) => setSelectedType(e.target.value as SendJobType)}>
              {jobTypeOptions.map((jt) => (
                <option key={jt.type} value={jt.type} disabled={!jt.approved}>
                  {jt.label}
                  {!jt.approved ? ' (not approved yet)' : ''}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-navy-400 text-sm">Checking readiness…</p>
          ) : preflight ? (
            <>
              {preflight.blockers.length > 0 ? (
                <div className="rounded border border-warn/30 bg-warn-bg text-warn text-sm px-4 py-3 mb-4 space-y-1">
                  {preflight.blockers.map((b, i) => (
                    <p key={i}>{b}</p>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-success/30 bg-success-bg text-success text-sm px-4 py-3 mb-4">
                  Ready to send to {preflight.recipientCount} {preflight.recipientCount === 1 ? 'person' : 'people'}.
                  {preflight.isDemo ? ' (Simulated - this is the demo tenant, no real email will go out.)' : ''}
                </div>
              )}

              <div className="mb-4">
                <button type="button" className="btn-secondary" onClick={() => setShowPreview(true)}>
                  Preview
                </button>
              </div>

              {preflight.blockers.length === 0 ? (
                <>
                  <div className="mb-4">
                    <label className="field-label">Pacing</label>
                    <div className="space-y-2">
                      {recommendations.map((rec) => (
                        <label
                          key={rec.profile}
                          className="flex items-start gap-2 text-sm border border-navy-100 rounded px-3 py-2 cursor-pointer has-[:checked]:border-navy-400 has-[:checked]:bg-navy-50"
                        >
                          <input type="radio" name="pace" checked={pace === rec.profile} onChange={() => setPace(rec.profile)} className="accent-navy-800 mt-0.5" />
                          <span>
                            <span className="font-medium text-navy-900">{rec.label}</span>
                            {rec.isRecommended ? <span className="badge-success ml-2">Recommended</span> : null}
                            <span className="block text-navy-500 text-xs">{rec.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {createError ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2 mb-3">{createError}</p> : null}

                  <ConfirmAction
                    triggerLabel={`Send ${JOB_LABELS[selectedType]}`}
                    triggerClassName="btn-primary"
                    consequence={`This will send "${JOB_LABELS[selectedType]}" for ${eventTitle} to ${preflight.recipientCount} ${
                      preflight.recipientCount === 1 ? 'person' : 'people'
                    }${
                      estimatedFinish
                        ? `, spaced out through around ${formatEta(estimatedFinish)}`
                        : ''
                    }. You can close this window any time - sending continues on the server, and you can pause or cancel the rest from here later.`}
                    confirmLabel="Send"
                    onConfirm={handleSend}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="mb-1">Send history</h3>
        {jobs.length === 0 ? (
          <p className="text-navy-400 text-sm">No sends yet for this event.</p>
        ) : (
          jobs.map((job) => (
            <JobProgress
              key={job.id}
              job={job}
              label={JOB_LABELS[job.job_type] ?? job.job_type}
              onPause={() => pauseSendJobAction(job.id)}
              onResume={() => resumeSendJobAction(job.id)}
              onCancel={() => cancelSendJobAction(job.id)}
            />
          ))
        )}
      </div>

      {showPreview ? (
        <MessagePreviewModal
          eventId={eventId}
          jobType={selectedType}
          jobLabel={JOB_LABELS[selectedType] ?? selectedType}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </div>
  );
}
