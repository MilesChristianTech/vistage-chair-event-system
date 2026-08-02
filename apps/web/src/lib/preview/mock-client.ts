// PREVIEW_MODE only - a tiny stand-in for the Supabase JS client, just
// enough of the query-builder surface this app actually uses (see the
// call-site inventory this was built from) to let the whole UI be clicked
// through against realistic sample data with no real backend. Never
// imported unless PREVIEW_MODE=true (see lib/supabase/server.ts).

import { getTable, setTable, generateId } from './store';
import { TENANT_ID, USER_ID } from './seed';

// [table][embedName] -> which FK column on `table` points at which table.
// Only the relations actually embedded in a .select() string anywhere in
// this app need to be listed here.
const RELATIONS: Record<string, Record<string, { fk: string; table: string }>> = {
  invitations: {
    people: { fk: 'person_id', table: 'people' },
    events: { fk: 'event_id', table: 'events' },
  },
  events: {
    event_types: { fk: 'event_type_id', table: 'event_types' },
  },
};

function withInsertDefaults(table: string, row: any): any {
  const withDefaults: any = {
    id: row.id ?? generateId(table),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    ...row,
  };
  if (table === 'people' && 'email' in withDefaults) {
    withDefaults.email_normalized = withDefaults.email ? String(withDefaults.email).toLowerCase().trim() : null;
  }
  if (table === 'invitations' && !withDefaults.public_token) {
    withDefaults.public_token = generateId('token');
  }
  if (table === 'forms' && !withDefaults.public_token) {
    withDefaults.public_token = generateId('formtoken');
  }
  return withDefaults;
}

type FilterKind = 'eq' | 'neq' | 'in' | 'not_in' | 'not_is_null' | 'ilike' | 'or';
interface FilterSpec {
  kind: FilterKind;
  col: string;
  val?: any;
}

class MockQueryBuilder implements PromiseLike<{ data: any; error: any; count?: number }> {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private selectCols: string | null = null;
  private selectOpts: { count?: string; head?: boolean } = {};
  private filters: FilterSpec[] = [];
  private orderCol: string | null = null;
  private orderOpts: { ascending?: boolean; nullsFirst?: boolean } = {};
  private limitN: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private payload: any = null;
  private upsertOnConflict: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: string, opts?: { count?: string; head?: boolean }): this {
    this.selectCols = cols ?? '*';
    if (opts) this.selectOpts = opts;
    return this;
  }

  eq(col: string, val: any): this {
    this.filters.push({ kind: 'eq', col, val });
    return this;
  }

  neq(col: string, val: any): this {
    this.filters.push({ kind: 'neq', col, val });
    return this;
  }

  in(col: string, vals: any[]): this {
    this.filters.push({ kind: 'in', col, val: vals });
    return this;
  }

  not(col: string, op: string, val: any): this {
    if (op === 'in') {
      const ids = String(val)
        .replace(/^\(|\)$/g, '')
        .split(',')
        .filter(Boolean);
      this.filters.push({ kind: 'not_in', col, val: ids });
    } else if (op === 'is' && val === null) {
      this.filters.push({ kind: 'not_is_null', col });
    }
    return this;
  }

  ilike(col: string, pattern: string): this {
    this.filters.push({ kind: 'ilike', col, val: pattern });
    return this;
  }

  or(expr: string): this {
    this.filters.push({ kind: 'or', col: '', val: expr });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderCol = col;
    this.orderOpts = opts ?? {};
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  insert(payload: any): this {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any): this {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: any, opts?: { onConflict?: string }): this {
    this.op = 'upsert';
    this.payload = payload;
    this.upsertOnConflict = opts?.onConflict ?? 'id';
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onFulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled, onRejected);
  }

  private resolveValue(row: any, col: string): any {
    if (!col.includes('.')) return row[col];
    const [rel, field] = col.split('.');
    const relation = RELATIONS[this.table]?.[rel!];
    if (!relation) return undefined;
    const related = getTable(relation.table).find((r) => r.id === row[relation.fk]);
    return related ? related[field!] : undefined;
  }

  private matchIlike(value: any, pattern: string): boolean {
    if (value == null) return false;
    const regexPattern = '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$';
    return new RegExp(regexPattern, 'i').test(String(value));
  }

  private matchesFilters(row: any): boolean {
    return this.filters.every((f) => {
      if (f.kind === 'or') {
        const segments = String(f.val).split(',');
        return segments.some((seg) => {
          const m = seg.match(/^([^.]+)\.([^.]+)\.(.*)$/);
          if (!m) return false;
          const [, col, op, val] = m;
          const value = this.resolveValue(row, col!);
          if (op === 'ilike') return this.matchIlike(value, val!);
          return String(value) === val;
        });
      }

      if (f.kind === 'not_in') {
        return !(f.val as any[]).includes(row.id);
      }

      const value = this.resolveValue(row, f.col);
      switch (f.kind) {
        case 'eq':
          return value === f.val;
        case 'neq':
          return value !== f.val;
        case 'in':
          return (f.val as any[]).includes(value);
        case 'not_is_null':
          return value != null;
        case 'ilike':
          return this.matchIlike(value, f.val);
        default:
          return true;
      }
    });
  }

  private project(row: any): any {
    if (!this.selectCols || this.selectCols.trim() === '*') return { ...row };

    const embeds: { name: string; fields: string }[] = [];
    const embedRegex = /(\w+)(?:!\w+)?\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = embedRegex.exec(this.selectCols))) {
      embeds.push({ name: m[1]!, fields: m[2]! });
    }

    const plainFields = this.selectCols
      .replace(embedRegex, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let result: any = {};
    if (plainFields.includes('*')) {
      result = { ...row };
    } else {
      for (const field of plainFields) {
        result[field] = row[field];
      }
    }

    for (const embed of embeds) {
      const relation = RELATIONS[this.table]?.[embed.name];
      if (!relation) continue;
      const related = getTable(relation.table).find((r) => r.id === row[relation.fk]);
      if (!related) {
        result[embed.name] = null;
        continue;
      }
      const embedFields = embed.fields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (embedFields.length === 0 || embedFields.includes('*')) {
        result[embed.name] = { ...related };
      } else {
        const obj: any = {};
        for (const f of embedFields) obj[f] = related[f];
        result[embed.name] = obj;
      }
    }

    return result;
  }

  private finish(rows: any[], count?: number): { data: any; error: any; count?: number } {
    if (this.singleMode === 'single') {
      if (rows.length === 0) return { data: null, error: { message: 'No rows found' } };
      return { data: rows[0], error: null };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null, count };
  }

  private execute(): { data: any; error: any; count?: number } {
    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = rows.map((r) => withInsertDefaults(this.table, r));
      const all = getTable(this.table);
      all.push(...inserted);
      setTable(this.table, all);
      return this.finish(inserted.map((r) => this.project(r)));
    }

    if (this.op === 'upsert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCols = (this.upsertOnConflict ?? 'id').split(',').map((s) => s.trim());
      const all = getTable(this.table);
      const results: any[] = [];
      for (const r of rows) {
        const existingIdx = all.findIndex((row) => conflictCols.every((c) => row[c] === r[c]));
        if (existingIdx >= 0) {
          all[existingIdx] = { ...all[existingIdx], ...r, updated_at: new Date().toISOString() };
          results.push(all[existingIdx]);
        } else {
          const withId = withInsertDefaults(this.table, r);
          all.push(withId);
          results.push(withId);
        }
      }
      setTable(this.table, all);
      return this.finish(results.map((r) => this.project(r)));
    }

    if (this.op === 'update') {
      const all = getTable(this.table);
      const matches = all.filter((row) => this.matchesFilters(row));
      for (const row of matches) {
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
        if (this.table === 'people' && 'email' in this.payload) {
          row.email_normalized = row.email ? String(row.email).toLowerCase().trim() : null;
        }
      }
      setTable(this.table, all);
      return this.finish(matches.map((r) => this.project(r)));
    }

    if (this.op === 'delete') {
      const all = getTable(this.table);
      const remaining = all.filter((row) => !this.matchesFilters(row));
      setTable(this.table, remaining);
      return this.finish([]);
    }

    // select
    const rows = getTable(this.table).filter((row) => this.matchesFilters(row));
    const totalCount = rows.length;

    if (this.selectOpts.head) {
      return { data: null, error: null, count: totalCount };
    }

    let ordered = rows;
    if (this.orderCol) {
      const col = this.orderCol;
      const { ascending, nullsFirst } = this.orderOpts;
      ordered = [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return nullsFirst ? -1 : 1;
        if (bv == null) return nullsFirst ? 1 : -1;
        if (av < bv) return ascending === false ? 1 : -1;
        if (av > bv) return ascending === false ? -1 : 1;
        return 0;
      });
    }

    if (this.limitN != null) ordered = ordered.slice(0, this.limitN);

    return this.finish(
      ordered.map((r) => this.project(r)),
      totalCount
    );
  }
}

const mockAuth = {
  async getUser() {
    return { data: { user: { id: USER_ID, email: 'cindy@example.com' } }, error: null };
  },
  async signInWithPassword(_params: { email: string; password: string }) {
    return { data: {}, error: null };
  },
  async signOut() {
    return { error: null };
  },
  async updateUser(_params: { password?: string }) {
    return { data: {}, error: null };
  },
};

export function createMockClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table);
    },
    auth: mockAuth,
  };
}

export const PREVIEW_TENANT_ID = TENANT_ID;
export const PREVIEW_USER_ID = USER_ID;
