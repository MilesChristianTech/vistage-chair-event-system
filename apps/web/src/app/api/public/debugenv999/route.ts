import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

const TOKEN = '947c5394-cb7b-4930-b9f8-c1489d1450a2';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// TEMPORARY diagnostic endpoint - removed immediately after use.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '(unset)';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('forms')
    .select('id, intro_text, theme, updated_at')
    .eq('id', '3355a434-33f1-46b8-ba22-897cac993158')
    .maybeSingle();

  // Force-purge whatever Vercel cached for these paths back when they were
  // first deployed (before force-dynamic existed on them) - adding the
  // export in a later deploy doesn't retroactively invalidate what was
  // already cached.
  revalidatePath(`/r/${TOKEN}`, 'page');
  revalidatePath(`/api/public/forms/${TOKEN}`, 'page');
  revalidatePath('/r/[token]', 'page');
  revalidatePath('/api/public/forms/[token]', 'page');
  revalidatePath('/r/[token]', 'layout');

  return NextResponse.json({
    previewMode: process.env.PREVIEW_MODE ?? '(unset)',
    supabaseUrl: url,
    serviceKeyPrefix: key ? key.slice(0, 20) : '(unset)',
    serviceKeyLength: key.length,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    directQuery: data,
    directQueryError: error,
    fetchedAt: new Date().toISOString(),
  });
}
