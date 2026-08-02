'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';

export interface UploadImageResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);

/** Replaces "paste a URL" for branding images - a pasted `file:///...` path
 * (copied from Windows Explorer, easy to do by mistake) only ever resolves
 * on the machine that copied it; nothing else can load it. This actually
 * uploads the file to a public Supabase Storage bucket and returns a real,
 * web-accessible URL. */
export async function uploadBrandingImageAction(formData: FormData): Promise<UploadImageResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file provided.' };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: 'Please choose a PNG, JPEG, GIF, WebP, or SVG image.' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'That image is larger than 5MB - please choose a smaller one.' };

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${appUser.tenant_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('branding').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data } = supabase.storage.from('branding').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
