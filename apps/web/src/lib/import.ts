/**
 * Contact import (Part 4.2). Parsing happens client-side (the Host's file
 * never needs to touch the server until commit), producing a plain grid of
 * rows the wizard can guess columns for, let the Host remap, and preview
 * before anything is written.
 */

export type PersonField =
  | 'first_name'
  | 'last_name'
  | 'preferred_name'
  | 'email'
  | 'company'
  | 'title'
  | 'relationship_type'
  | 'notes'
  | 'ignore';

// A column can map to one of the fixed fields above, or to a Host-defined
// custom field (Part request: "unlimited import columns" / a basic
// Excel-CRM classifier system) - encoded as `custom:<field_key>` so the
// mapping stays a single value per column without a second parallel map.
export type ColumnTarget = PersonField | `custom:${string}`;

export function isCustomFieldTarget(target: ColumnTarget): target is `custom:${string}` {
  return target.startsWith('custom:');
}

export function customFieldKeyFromTarget(target: ColumnTarget): string {
  return target.slice('custom:'.length);
}

export const PERSON_FIELD_LABELS: Record<PersonField, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  preferred_name: 'Preferred Name',
  email: 'Email',
  company: 'Company',
  title: 'Title',
  relationship_type: 'Relationship Type',
  notes: 'Notes',
  ignore: 'Ignore this column',
};

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

const GUESS_PATTERNS: Array<{ field: PersonField; patterns: RegExp[] }> = [
  { field: 'email', patterns: [/e[-_ ]?mail/i] },
  { field: 'first_name', patterns: [/^first/i, /given/i, /^fname$/i] },
  { field: 'last_name', patterns: [/^last/i, /surname/i, /family/i, /^lname$/i] },
  { field: 'preferred_name', patterns: [/preferred/i, /nickname/i, /goes by/i] },
  { field: 'company', patterns: [/company/i, /organization/i, /employer/i, /firm/i] },
  { field: 'title', patterns: [/title/i, /position/i, /role/i] },
  { field: 'relationship_type', patterns: [/relationship/i, /type/i, /segment/i, /category/i] },
  { field: 'notes', patterns: [/notes?/i, /comments?/i] },
];

export function guessColumnMapping(headers: string[]): Record<number, PersonField> {
  const mapping: Record<number, PersonField> = {};
  const claimed = new Set<PersonField>();

  headers.forEach((header, index) => {
    const trimmed = header.trim();
    for (const { field, patterns } of GUESS_PATTERNS) {
      if (claimed.has(field)) continue;
      if (patterns.some((p) => p.test(trimmed))) {
        mapping[index] = field;
        claimed.add(field);
        return;
      }
    }
    // "Name" alone, when first/last aren't both already claimed, is a common
    // single-column full-name case - flag as first_name only if nothing
    // better claimed it, so the Host notices and can fix it in review.
    if (!claimed.has('first_name') && /^name$/i.test(trimmed)) {
      mapping[index] = 'first_name';
      claimed.add('first_name');
      return;
    }
    mapping[index] = 'ignore';
  });

  return mapping;
}

/** Guarantees every non-"ignore" target is claimed by at most one column -
 * whichever comes first (lowest column index) wins, later duplicates become
 * "ignore". Without this, applyMapping's get() and its custom-fields loop
 * both silently use only one of the duplicate columns' data (first-match for
 * fixed fields, last-write for custom fields) while the mapping table still
 * shows every duplicate as confidently mapped - so a Host reviewing it sees
 * nothing wrong, but data from every column except the winner never actually
 * lands anywhere. Run this on any mapping before it's trusted, not just the
 * AI-assisted one, since a manual selection can create the same collision. */
export function dedupeMapping(mapping: Record<number, ColumnTarget>): Record<number, ColumnTarget> {
  const result: Record<number, ColumnTarget> = {};
  const claimed = new Set<ColumnTarget>();
  const indices = Object.keys(mapping)
    .map(Number)
    .sort((a, b) => a - b);

  for (const idx of indices) {
    const target = mapping[idx]!;
    if (target !== 'ignore' && claimed.has(target)) {
      result[idx] = 'ignore';
      continue;
    }
    result[idx] = target;
    if (target !== 'ignore') claimed.add(target);
  }

  return result;
}

/** Combines the instant regex guess with the AI checker's verdict, letting
 * the AI's decisions win any target collision regardless of column order
 * (it saw the actual sample values, the regex guess only saw headers) - the
 * regex guess only fills in columns the AI didn't address. Always dedupe the
 * result (see dedupeMapping) since resolving one collision can create
 * another between two columns the AI never even considered. */
export function mergeMappings(base: Record<number, ColumnTarget>, overrides: Record<number, ColumnTarget>): Record<number, ColumnTarget> {
  const claimed = new Set<ColumnTarget>();
  const result: Record<number, ColumnTarget> = {};

  const overrideIndices = Object.keys(overrides)
    .map(Number)
    .sort((a, b) => a - b);
  for (const idx of overrideIndices) {
    const target = overrides[idx]!;
    if (target !== 'ignore' && claimed.has(target)) {
      result[idx] = 'ignore';
      continue;
    }
    result[idx] = target;
    if (target !== 'ignore') claimed.add(target);
  }

  const remainingIndices = Object.keys(base)
    .map(Number)
    .filter((idx) => !(idx in overrides))
    .sort((a, b) => a - b);
  for (const idx of remainingIndices) {
    const target = base[idx]!;
    if (target !== 'ignore' && claimed.has(target)) {
      result[idx] = 'ignore';
      continue;
    }
    result[idx] = target;
    if (target !== 'ignore') claimed.add(target);
  }

  return result;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface MappedPersonRow {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  relationship_type_label: string | null;
  summary_note: string | null;
  custom_fields: Record<string, string>;
  email_valid: boolean;
  source_row_index: number;
}

export function applyMapping(sheet: ParsedSheet, mapping: Record<number, ColumnTarget>): MappedPersonRow[] {
  return sheet.rows.map((row, rowIndex) => {
    const get = (field: PersonField): string => {
      const colIndex = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      if (colIndex === undefined) return '';
      return (row[Number(colIndex)] ?? '').trim();
    };

    const customFields: Record<string, string> = {};
    for (const [colIndex, target] of Object.entries(mapping)) {
      if (isCustomFieldTarget(target)) {
        const value = (row[Number(colIndex)] ?? '').trim();
        if (value) customFields[customFieldKeyFromTarget(target)] = value;
      }
    }

    const email = get('email');

    // A single "Name" column (no separately-mapped last name) most often
    // holds a full name - split it so First/Last land in the right fields
    // instead of the whole thing sitting in First Name alone.
    let firstName = get('first_name');
    let lastName = get('last_name');
    if (firstName && !lastName && firstName.trim().includes(' ')) {
      const parts = firstName.trim().split(/\s+/);
      firstName = parts[0]!;
      lastName = parts.slice(1).join(' ');
    }

    return {
      first_name: firstName,
      last_name: lastName,
      preferred_name: get('preferred_name') || null,
      email: email || null,
      company: get('company') || null,
      title: get('title') || null,
      relationship_type_label: get('relationship_type') || null,
      summary_note: get('notes') || null,
      custom_fields: customFields,
      email_valid: email ? isValidEmail(email) : true,
      source_row_index: rowIndex,
    };
  });
}
