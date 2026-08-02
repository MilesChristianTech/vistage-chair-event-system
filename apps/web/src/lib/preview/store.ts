// PREVIEW_MODE only. A tiny in-memory "database" backed by a JSON file on
// disk (so it survives Next.js dev-server module reloads), used in place of
// Supabase when no real project is configured yet. Never used when
// PREVIEW_MODE is unset - see lib/supabase/server.ts.

import fs from 'fs';
import path from 'path';
import { buildSeedData } from './seed';

const DATA_FILE = path.join(process.cwd(), '.preview-data.json');

let cache: Record<string, any[]> | null = null;

function load(): Record<string, any[]> {
  if (cache) return cache;

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    cache = JSON.parse(raw);
    return cache!;
  } catch {
    cache = buildSeedData();
    persist();
    return cache;
  }
}

function persist() {
  if (!cache) return;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Best-effort only - an in-memory-only fallback is fine for a preview.
  }
}

export function getTable(name: string): any[] {
  const db = load();
  if (!db[name]) db[name] = [];
  return db[name];
}

export function setTable(name: string, rows: any[]) {
  const db = load();
  db[name] = rows;
  persist();
}

export function resetPreviewData() {
  cache = buildSeedData();
  persist();
}

let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
