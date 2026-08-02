import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARY diagnostic endpoint - removed immediately after use. Exposes
// no secrets: just enough of each value to confirm which environment this
// deployment is actually running against.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '(unset)';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return NextResponse.json({
    previewMode: process.env.PREVIEW_MODE ?? '(unset)',
    supabaseUrl: url,
    serviceKeyPrefix: key ? key.slice(0, 20) : '(unset)',
    serviceKeyLength: key.length,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
