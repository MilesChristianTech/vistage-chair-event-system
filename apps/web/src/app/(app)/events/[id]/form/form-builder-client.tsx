'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ConfirmAction from '@/components/confirm-action';
import {
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
  updateFormMetaAction,
  publishFormAction,
} from './actions';

interface FormQuestion {
  id: string;
  question_type: string;
  label: string;
  help_text: string | null;
  is_required: boolean;
  sort_order: number;
}

interface FormRow {
  id: string;
  public_token: string;
  intro_text: string | null;
  confirmation_text: string | null;
  is_published: boolean;
}

const QUESTION_TEMPLATES: { type: string; label: string; description: string }[] = [
  { type: 'attendance', label: 'Attendance', description: '"Yes / No / Not certain" — the core RSVP question.' },
  { type: 'guest_count', label: 'Guest count', description: 'How many guests are they bringing.' },
  { type: 'guest_names', label: 'Guest names', description: "Their guest's name(s)." },
  { type: 'dietary_accessibility', label: 'Dietary / accessibility', description: 'Any needs to accommodate.' },
  { type: 'open_text', label: 'Open question', description: 'A free-response question.' },
  { type: 'short_text', label: 'Short answer', description: 'A brief text field.' },
  { type: 'yes_no', label: 'Yes / No', description: 'A simple custom yes/no question.' },
];

export default function FormBuilderClient({
  form,
  questions,
  responseCount,
}: {
  form: FormRow;
  questions: FormQuestion[];
  responseCount: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(questions);
  const [introText, setIntroText] = useState(form.intro_text ?? '');
  const [confirmationText, setConfirmationText] = useState(form.confirmation_text ?? '');
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${form.public_token}` : `/r/${form.public_token}`;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((q) => q.id === active.id);
      const newIndex = current.findIndex((q) => q.id === over.id);
      const next = arrayMove(current, oldIndex, newIndex);
      startTransition(() => {
        void reorderQuestionsAction(next.map((q) => q.id));
      });
      return next;
    });
  }

  function addQuestion(type: string) {
    startTransition(async () => {
      await addQuestionAction(form.id, type);
      router.refresh();
    });
  }

  function removeQuestion(id: string) {
    setItems((current) => current.filter((q) => q.id !== id));
    startTransition(async () => {
      await deleteQuestionAction(id);
      router.refresh();
    });
  }

  function saveMeta() {
    startTransition(async () => {
      await updateFormMetaAction(form.id, { intro_text: introText, confirmation_text: confirmationText });
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {responseCount > 0 ? (
          <div className="rounded border border-warn/30 bg-warn-bg text-warn text-sm px-4 py-3">
            {responseCount} {responseCount === 1 ? 'person has' : 'people have'} already responded to this form.
            Changing or removing a question they already answered means those answers won't line up going forward —
            consider adding a new question instead of editing an existing one.
          </div>
        ) : null}

        <div className="card p-5">
          <h3>Questions</h3>
          {items.length === 0 ? (
            <p className="text-navy-400 text-sm">No questions yet — add some from the templates on the right.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((q) => (
                    <QuestionCard key={q.id} question={q} onRemove={() => removeQuestion(q.id)} onSaved={() => router.refresh()} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="card p-5">
          <h3>Intro & confirmation text</h3>
          <div className="mb-3">
            <label className="field-label">Intro text (shown at the top of the form)</label>
            <textarea className="input" rows={2} value={introText} onChange={(e) => setIntroText(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="field-label">Confirmation screen (shown after submitting)</label>
            <textarea className="input" rows={2} value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={saveMeta} disabled={isPending}>
            Save
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <h3>Add a question</h3>
          <div className="space-y-2">
            {QUESTION_TEMPLATES.map((t) => (
              <button
                key={t.type}
                className="w-full text-left px-3 py-2 rounded border border-navy-100 hover:bg-navy-50 text-sm"
                onClick={() => addQuestion(t.type)}
                disabled={isPending}
              >
                <span className="font-medium text-navy-900 block">{t.label}</span>
                <span className="text-navy-500 text-xs">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3>Publish</h3>
          {form.is_published ? (
            <>
              <p className="text-sm text-success mb-2">Live and accepting responses.</p>
              <div className="flex items-center gap-2 mb-3">
                <input readOnly className="input text-xs" value={publicUrl} />
                <button
                  className="btn-secondary shrink-0 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(publicUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <ConfirmAction
                triggerLabel="Unpublish"
                triggerClassName="btn-secondary w-full justify-center"
                consequence="This takes the form offline — anyone who visits the link will see it's no longer accepting responses. Already-collected responses are unaffected."
                confirmLabel="Unpublish"
                successMessage="Form taken offline."
                onConfirm={async () => {
                  const result = await publishFormAction(form.id, false);
                  router.refresh();
                  return result;
                }}
              />
            </>
          ) : (
            <ConfirmAction
              triggerLabel="Publish form"
              triggerClassName="btn-primary w-full justify-center"
              consequence={`This makes your RSVP form live at a public link${items.length === 0 ? ' — you haven\'t added any questions yet' : ''}. You can keep editing it after publishing.`}
              confirmLabel="Publish"
              successMessage="Your form is live."
              onConfirm={async () => {
                const result = await publishFormAction(form.id, true);
                router.refresh();
                return result;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  onRemove,
  onSaved,
}: {
  question: FormQuestion;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(question.label);
  const [helpText, setHelpText] = useState(question.help_text ?? '');
  const [isRequired, setIsRequired] = useState(question.is_required);

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  async function save() {
    await updateQuestionAction(question.id, { label, help_text: helpText || null, is_required: isRequired });
    setEditing(false);
    onSaved();
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-navy-100 rounded p-3 bg-white">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-navy-300 pt-1" aria-label="Drag to reorder">
          ⠿
        </button>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
              <input className="input text-xs" placeholder="Help text (optional)" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-navy-700">
                <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="accent-navy-800" />
                Required
              </label>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={save}>
                  Save
                </button>
                <button className="btn-ghost text-xs" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-navy-900">
                {question.label} {question.is_required ? <span className="text-danger">*</span> : null}
              </p>
              {question.help_text ? <p className="text-xs text-navy-500">{question.help_text}</p> : null}
              <p className="text-xs text-navy-400 mt-1">{question.question_type.replace('_', ' ')}</p>
            </>
          )}
        </div>
        {!editing ? (
          <div className="flex gap-1 shrink-0">
            <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn-ghost text-xs text-danger" onClick={onRemove}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
