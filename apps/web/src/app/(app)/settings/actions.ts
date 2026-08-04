'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function updateHostProfileAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('tenant_settings')
    .update({
      host_display_name: String(formData.get('host_display_name') || '').trim() || null,
      host_signature: String(formData.get('host_signature') || '').trim() || null,
    })
    .eq('tenant_id', appUser.tenant_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateBrandingAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const branding = {
    logoUrl: String(formData.get('logo_url') || '').trim() || null,
    accentColor: String(formData.get('accent_color') || '#b08d57'),
    primaryColor: String(formData.get('primary_color') || '#0f1f3d'),
  };

  const { error } = await supabase.from('tenant_settings').update({ branding }).eq('tenant_id', appUser.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateAdvancedSettingsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('tenant_settings')
    .update({
      variant_threshold: Number(formData.get('variant_threshold') || 60),
      variant_count_min: Number(formData.get('variant_count_min') || 5),
      variant_count_max: Number(formData.get('variant_count_max') || 8),
    })
    .eq('tenant_id', appUser.tenant_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateVoiceSamplesAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const samples = [
    String(formData.get('sample_1') || '').trim(),
    String(formData.get('sample_2') || '').trim(),
    String(formData.get('sample_3') || '').trim(),
  ].filter((s) => s.length > 0);

  const { error } = await supabase.from('tenant_settings').update({ voice_samples: samples }).eq('tenant_id', appUser.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true };
}

export async function disconnectMailboxAction(): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('mailbox_connections')
    .update({ status: 'disconnected', encrypted_refresh_token: null })
    .eq('tenant_id', appUser.tenant_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true };
}

export async function changePasswordAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const newPassword = String(formData.get('new_password') || '');
  const confirmPassword = String(formData.get('confirm_password') || '');

  if (newPassword.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  if (newPassword !== confirmPassword) return { ok: false, error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
