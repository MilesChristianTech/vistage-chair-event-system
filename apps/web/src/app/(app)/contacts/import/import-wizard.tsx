'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  applyMapping,
  guessColumnMapping,
  mergeMappings,
  dedupeMapping,
  PERSON_FIELD_LABELS,
  type MappedPersonRow,
  type ParsedSheet,
  type ColumnTarget,
} from '@/lib/import';
import {
  checkDuplicateEmailsAction,
  commitImportAction,
  createCustomFieldDefinitionAction,
  suggestColumnMappingAction,
  type ImportSummary,
  type CustomFieldDefinition,
} from '../actions';

type Step = 'drop' | 'checking' | 'mapping' | 'preview' | 'dedupe' | 'done';
type SmartStatus = { available: true } | { available: false; reason: 'not_configured' | 'error' };

export default function ImportWizard({ customFieldDefinitions }: { customFieldDefinitions: CustomFieldDefinition[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('drop');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<number, ColumnTarget>>({});
  const [fields, setFields] = useState(customFieldDefinitions);
  const [duplicates, setDuplicates] = useState<{ normalizedEmail: string; existingName: string }[]>([]);
  const [dedupeChoice, setDedupeChoice] = useState<'update' | 'skip' | 'keep_both'>('update');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [smartStatus, setSmartStatus] = useState<SmartStatus | null>(null);

  const mappedRows: MappedPersonRow[] = useMemo(() => {
    if (!sheet) return [];
    return applyMapping(sheet, mapping);
  }, [sheet, mapping]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName!];
    const rows: string[][] = XLSX.utils.sheet_to_json(worksheet!, { header: 1, blankrows: false, raw: false });

    if (rows.length === 0) {
      setError('That file looks empty. Please choose a different one.');
      return;
    }

    const [headerRow, ...dataRows] = rows;
    const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());
    const cleanedRows = dataRows.map((r) => headers.map((_, i) => String(r[i] ?? '')));

    const parsed: ParsedSheet = { headers, rows: cleanedRows };
    setSheet(parsed);
    setStep('checking');

    // The regex guess is the instant fallback; the AI checker (Part
    // request: "an agent that... sorts them perfectly into the correct
    // column before it maps the columns and preview") reviews the actual
    // header row and sample values against the Host's real fields and gets
    // the final say on every collision - see mergeMappings. This step
    // blocks the mapping screen on purpose, so the Host reviews what the
    // checker actually decided rather than an unreviewed guess.
    const regexMapping = guessColumnMapping(headers);
    const result = await suggestColumnMappingAction(headers, cleanedRows.slice(0, 8));
    const finalMapping = result.available ? mergeMappings(regexMapping, result.mapping) : dedupeMapping(regexMapping);
    setMapping(finalMapping);
    setSmartStatus(result.available ? { available: true } : { available: false, reason: result.reason ?? 'error' });
    setStep('mapping');
  }, []);

  async function goToDedupeCheck() {
    setIsBusy(true);
    setError(null);
    try {
      const emails = mappedRows.map((r) => r.email).filter((e): e is string => Boolean(e));
      const dups = await checkDuplicateEmailsAction(emails);
      setDuplicates(dups.map((d) => ({ normalizedEmail: d.normalizedEmail, existingName: d.existingName })));
      setStep('dedupe');
    } finally {
      setIsBusy(false);
    }
  }

  async function commit() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await commitImportAction({ rows: mappedRows, dedupeChoice });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.summary);
      setStep('done');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <StepIndicator step={step} />

      {step === 'drop' ? <DropStep onFile={handleFile} error={error} /> : null}

      {step === 'checking' ? <CheckingStep /> : null}

      {step === 'mapping' && sheet ? (
        <MappingStep
          sheet={sheet}
          mapping={mapping}
          fields={fields}
          smartStatus={smartStatus}
          onChangeMapping={(idx, target) => setMapping((m) => ({ ...m, [idx]: target }))}
          onAddField={(field) => setFields((current) => (current.some((f) => f.field_key === field.field_key) ? current : [...current, field]))}
          onBack={() => setStep('drop')}
          onNext={() => setStep('preview')}
        />
      ) : null}

      {step === 'preview' ? (
        <PreviewStep rows={mappedRows} onBack={() => setStep('mapping')} onNext={goToDedupeCheck} isBusy={isBusy} />
      ) : null}

      {step === 'dedupe' ? (
        <DedupeStep
          duplicateCount={duplicates.length}
          totalCount={mappedRows.length}
          choice={dedupeChoice}
          onChoice={setDedupeChoice}
          onBack={() => setStep('preview')}
          onCommit={commit}
          isBusy={isBusy}
          error={error}
        />
      ) : null}

      {step === 'done' && summary ? <DoneStep summary={summary} onFinish={() => router.push('/contacts')} /> : null}

      {fileName && step !== 'drop' && step !== 'done' ? (
        <p className="text-xs text-navy-400 mt-4">File: {fileName}</p>
      ) : null}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'drop', label: '1. Drop file' },
    { key: 'mapping', label: '2. Map columns' },
    { key: 'preview', label: '3. Preview' },
    { key: 'dedupe', label: '4. Duplicates' },
    { key: 'done', label: '5. Done' },
  ];
  // "checking" is a brief transient sub-state on the way to "mapping" - it
  // doesn't get its own slot in the indicator, just highlights that one.
  const currentIndex = steps.findIndex((s) => s.key === (step === 'checking' ? 'mapping' : step));

  return (
    <div className="flex items-center gap-2 mb-6 text-xs">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={`px-2.5 py-1 rounded-full ${
            i === currentIndex ? 'bg-navy-900 text-white' : i < currentIndex ? 'bg-success-bg text-success' : 'bg-navy-100 text-navy-500'
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function DropStep({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={`card p-12 text-center border-2 border-dashed transition-colors ${
        isDragging ? 'border-navy-400 bg-navy-50' : 'border-navy-200'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <p className="text-navy-700 mb-1 font-medium">Drop a CSV or Excel file here</p>
      <p className="text-navy-500 text-sm mb-4">or</p>
      <label className="btn-primary cursor-pointer">
        Choose a file
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      <p className="text-navy-400 text-xs mt-4">No template needed - we’ll adapt to your file’s columns.</p>
      {error ? <p className="text-danger text-sm mt-4">{error}</p> : null}
    </div>
  );
}

const ADD_NEW_FIELD = '__add_new__';

function CheckingStep() {
  return (
    <div className="card p-12 text-center">
      <div className="inline-flex h-8 w-8 items-center justify-center mb-4">
        <span className="h-5 w-5 rounded-full border-2 border-navy-200 border-t-navy-700 animate-spin" />
      </div>
      <p className="text-navy-700 font-medium mb-1">Checking your columns…</p>
      <p className="text-navy-500 text-sm">
        Matching every column against your contact fields before showing you the mapping - just a moment.
      </p>
    </div>
  );
}

function MappingStep({
  sheet,
  mapping,
  fields,
  smartStatus,
  onChangeMapping,
  onAddField,
  onBack,
  onNext,
}: {
  sheet: ParsedSheet;
  mapping: Record<number, ColumnTarget>;
  fields: CustomFieldDefinition[];
  smartStatus: { available: true } | { available: false; reason: 'not_configured' | 'error' } | null;
  onChangeMapping: (index: number, target: ColumnTarget) => void;
  onAddField: (field: CustomFieldDefinition) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const targetCounts = new Map<ColumnTarget, number>();
  for (const target of Object.values(mapping)) {
    if (target === 'ignore') continue;
    targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
  }
  const hasDuplicates = Array.from(targetCounts.values()).some((c) => c > 1);

  return (
    <div className="card p-5">
      <h3>Review the column mapping</h3>
      <p className="text-navy-500 text-sm mb-4">
        Checked column by column against your contact fields. Change anything that’s not right - any column can also
        become its own custom field if it doesn’t fit a standard one.
      </p>
      {smartStatus?.available ? (
        <p className="text-xs text-success mb-3">Reviewed against your actual data, not just column headers - still worth a quick check below.</p>
      ) : smartStatus && !smartStatus.available ? (
        <p className="text-xs text-warn mb-3">
          {smartStatus.reason === 'not_configured'
            ? 'Smart checking isn’t connected right now, so this is a plain pattern-based guess - please look over every row carefully.'
            : 'Smart checking hit an error, so this is a plain pattern-based guess - please look over every row carefully.'}
        </p>
      ) : null}
      {hasDuplicates ? (
        <p className="text-xs text-danger mb-3">
          Two or more columns are mapped to the same field below - only one will actually be used per person. Set
          the extra one(s) to “Ignore this column” or a different field.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-navy-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Your column</th>
              <th className="text-left px-3 py-2 font-medium">Sample value</th>
              <th className="text-left px-3 py-2 font-medium">Maps to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {sheet.headers.map((header, idx) => (
              <MappingRow
                key={idx}
                idx={idx}
                header={header}
                sampleValue={sheet.rows[0]?.[idx]}
                target={mapping[idx] ?? 'ignore'}
                fields={fields}
                onChangeMapping={onChangeMapping}
                onAddField={onAddField}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          Preview import
        </button>
      </div>
    </div>
  );
}

function MappingRow({
  idx,
  header,
  sampleValue,
  target,
  fields,
  onChangeMapping,
  onAddField,
}: {
  idx: number;
  header: string;
  sampleValue: string | undefined;
  target: ColumnTarget;
  fields: CustomFieldDefinition[];
  onChangeMapping: (index: number, target: ColumnTarget) => void;
  onAddField: (field: CustomFieldDefinition) => void;
}) {
  const [addingField, setAddingField] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function confirmNewField() {
    if (!newLabel.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    const result = await createCustomFieldDefinitionAction(newLabel);
    setIsCreating(false);
    if (!result.ok || !result.field) {
      setCreateError(result.error || 'Could not create that field.');
      return;
    }
    onAddField(result.field);
    onChangeMapping(idx, `custom:${result.field.field_key}`);
    setAddingField(false);
    setNewLabel('');
  }

  return (
    <tr>
      <td className="px-3 py-2 font-medium text-navy-800">{header || `Column ${idx + 1}`}</td>
      <td className="px-3 py-2 text-navy-500">{sampleValue || '-'}</td>
      <td className="px-3 py-2">
        {addingField ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input"
              placeholder="Field name, e.g. Prospect status"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button type="button" className="btn-secondary shrink-0 text-xs" disabled={isCreating || !newLabel.trim()} onClick={confirmNewField}>
              {isCreating ? 'Adding…' : 'Add'}
            </button>
            <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => setAddingField(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <select
            className="input"
            value={target}
            onChange={(e) => {
              if (e.target.value === ADD_NEW_FIELD) {
                setAddingField(true);
                return;
              }
              onChangeMapping(idx, e.target.value as ColumnTarget);
            }}
          >
            {Object.entries(PERSON_FIELD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {fields.length > 0 ? (
              <optgroup label="Custom fields">
                {fields.map((f) => (
                  <option key={f.field_key} value={`custom:${f.field_key}`}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={ADD_NEW_FIELD}>+ Add new custom field…</option>
          </select>
        )}
        {createError ? <p className="text-xs text-danger mt-1">{createError}</p> : null}
      </td>
    </tr>
  );
}

function PreviewStep({
  rows,
  onBack,
  onNext,
  isBusy,
}: {
  rows: MappedPersonRow[];
  onBack: () => void;
  onNext: () => void;
  isBusy: boolean;
}) {
  const invalidEmailCount = rows.filter((r) => r.email && !r.email_valid).length;

  return (
    <div className="card p-5">
      <h3>Preview</h3>
      <p className="text-navy-500 text-sm mb-4">
        Here’s exactly how the first rows will land. {rows.length} {rows.length === 1 ? 'person' : 'people'} total.
        {invalidEmailCount > 0 ? (
          <span className="text-warn"> {invalidEmailCount} have an email that looks malformed - they’ll still be added, flagged for your attention.</span>
        ) : null}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-navy-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Company</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.slice(0, 8).map((row, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2">
                  {row.first_name} {row.last_name}
                </td>
                <td className="px-3 py-2">
                  {row.email ? (
                    !row.email_valid ? (
                      <span className="text-warn">{row.email} (check format)</span>
                    ) : (
                      row.email
                    )
                  ) : (
                    <span className="text-navy-300">-</span>
                  )}
                </td>
                <td className="px-3 py-2">{row.company || <span className="text-navy-300">-</span>}</td>
                <td className="px-3 py-2">{row.relationship_type_label || <span className="text-navy-300">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 ? <p className="text-navy-400 text-xs mt-2">…and {rows.length - 8} more.</p> : null}
      <div className="flex items-center gap-2 mt-5">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext} disabled={isBusy}>
          {isBusy ? 'Checking for duplicates…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function DedupeStep({
  duplicateCount,
  totalCount,
  choice,
  onChoice,
  onBack,
  onCommit,
  isBusy,
  error,
}: {
  duplicateCount: number;
  totalCount: number;
  choice: 'update' | 'skip' | 'keep_both';
  onChoice: (choice: 'update' | 'skip' | 'keep_both') => void;
  onBack: () => void;
  onCommit: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  return (
    <div className="card p-5">
      <h3>Duplicates</h3>
      {duplicateCount > 0 ? (
        <>
          <p className="text-navy-700 text-sm mb-4">
            {duplicateCount} of these {totalCount} already exist in your contacts (matched by email). What should we
            do with them?
          </p>
          <div className="space-y-2 mb-5">
            <RadioOption
              name="dedupe"
              checked={choice === 'update'}
              onChange={() => onChoice('update')}
              label="Update the existing records with the new information"
            />
            <RadioOption
              name="dedupe"
              checked={choice === 'skip'}
              onChange={() => onChoice('skip')}
              label="Skip the duplicates, keep the existing records as-is"
            />
            <RadioOption
              name="dedupe"
              checked={choice === 'keep_both'}
              onChange={() => onChoice('keep_both')}
              label="Keep both (create new, separate records)"
            />
          </div>
        </>
      ) : (
        <p className="text-navy-700 text-sm mb-4">No duplicates found - every one of these will be added fresh.</p>
      )}

      {error ? <p className="text-danger text-sm mb-3">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={onBack} disabled={isBusy}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onCommit} disabled={isBusy}>
          {isBusy ? 'Importing…' : `Import ${totalCount} ${totalCount === 1 ? 'person' : 'people'}`}
        </button>
      </div>
    </div>
  );
}

function RadioOption({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-navy-800" />
      {label}
    </label>
  );
}

function DoneStep({ summary, onFinish }: { summary: ImportSummary; onFinish: () => void }) {
  return (
    <div className="card p-8 text-center">
      <h3>Import complete</h3>
      <div className="flex items-center justify-center gap-8 my-5">
        <SummaryStat label="Added" value={summary.added} />
        <SummaryStat label="Updated" value={summary.updated} />
        <SummaryStat label="Skipped" value={summary.skipped} />
        <SummaryStat label="Flagged" value={summary.flagged} warn />
      </div>
      {summary.flagged > 0 ? (
        <p className="text-navy-500 text-sm mb-4">
          Flagged records need a quick look - likely a malformed email. Nothing was lost; just fix at your leisure.
        </p>
      ) : null}
      <button className="btn-primary" onClick={onFinish}>
        Go to contacts
      </button>
    </div>
  );
}

function SummaryStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-semibold ${warn && value > 0 ? 'text-warn' : 'text-navy-900'}`}>{value}</p>
      <p className="text-xs text-navy-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}
