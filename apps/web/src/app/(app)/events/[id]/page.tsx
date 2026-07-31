import { redirect } from 'next/navigation';

export default function EventRootPage({ params }: { params: { id: string } }) {
  redirect(`/events/${params.id}/setup`);
}
