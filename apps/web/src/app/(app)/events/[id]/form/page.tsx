import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import FormBuilderClient from './form-builder-client';

export const dynamic = 'force-dynamic';

export default async function FormBuilderPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: form } = await supabase.from('forms').select('*').eq('event_id', params.id).single();
  if (!form) notFound();

  const { data: questions } = await supabase
    .from('form_questions')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order');

  const { count: responseCount } = await supabase
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', form.id);

  return (
    <AppPageBody>
      <FormBuilderClient form={form} questions={questions ?? []} responseCount={responseCount ?? 0} />
    </AppPageBody>
  );
}
