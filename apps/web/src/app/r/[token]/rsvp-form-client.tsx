'use client';

import { useState } from 'react';
import type { PublicFormData } from '@/lib/public-form';

export default function RsvpFormClient({ token, data }: { token: string; data: PublicFormData }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState(data.prefill ? `${data.prefill.firstName} ${data.prefill.lastName}` : '');
  const [email, setEmail] = useState(data.prefill?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsIdentity = !data.prefill;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const attendanceQuestion = data.questions.find((q) => q.question_type === 'attendance');
    if (attendanceQuestion?.is_required && !answers[attendanceQuestion.id]) {
      setError('Please let us know if you can attend.');
      return;
    }
    if (needsIdentity && (!name.trim() || !email.trim())) {
      setError('Please enter your name and email.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/forms/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          invitationId: data.prefill?.invitationId,
          submittedName: name || undefined,
          submittedEmail: email || undefined,
        }),
      });

      if (!response.ok) {
        setError('Something went wrong submitting your response. Please try again.');
        return;
      }

      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="text-success text-lg font-medium mb-2">Thank you!</p>
        <p className="text-navy-600 text-sm">
          {data.confirmationText || "Your response has been recorded. We'll follow up with any details you need."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {needsIdentity ? (
        <>
          <div>
            <label className="field-label">Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Your email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </>
      ) : null}

      {data.questions.map((q) => (
        <QuestionField key={q.id} question={q} value={answers[q.id] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
      ))}

      {error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2">{error}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
        {submitting ? 'Sending…' : 'Submit response'}
      </button>
    </form>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: PublicFormData['questions'][number];
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <label className="field-label">
      {question.label} {question.is_required ? <span className="text-danger">*</span> : null}
    </label>
  );

  if (question.question_type === 'attendance') {
    return (
      <div>
        {label}
        {question.help_text ? <p className="field-hint mb-1">{question.help_text}</p> : null}
        <div className="space-y-1.5">
          {['Yes, I plan to attend', "I'm not certain yet", 'I cannot attend'].map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-navy-800 border border-navy-100 rounded px-3 py-2 cursor-pointer has-[:checked]:border-navy-400 has-[:checked]:bg-navy-50">
              <input
                type="radio"
                name={question.id}
                required={question.is_required}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-navy-800"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.question_type === 'yes_no') {
    return (
      <div>
        {label}
        <div className="flex gap-3">
          {['Yes', 'No'].map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type="radio" name={question.id} checked={value === opt} onChange={() => onChange(opt)} className="accent-navy-800" />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.question_type === 'guest_count') {
    return (
      <div>
        {label}
        <input
          type="number"
          min={0}
          className="input max-w-[120px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={question.is_required}
        />
      </div>
    );
  }

  if (question.question_type === 'open_text' || question.question_type === 'dietary_accessibility') {
    return (
      <div>
        {label}
        {question.help_text ? <p className="field-hint mb-1">{question.help_text}</p> : null}
        <textarea className="input" rows={2} value={value} onChange={(e) => onChange(e.target.value)} required={question.is_required} />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} required={question.is_required} />
    </div>
  );
}
