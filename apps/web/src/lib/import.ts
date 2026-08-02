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
// Excel-CRM classifier system) — encoded as `custom:<field_key>` so the
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
    // single-column full-name case — flag as first_name only if nothing
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

    return {
      first_name: get('first_name'),
      last_name: get('last_name'),
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
