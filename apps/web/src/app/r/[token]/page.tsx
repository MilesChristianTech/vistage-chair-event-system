import { getPublicFormData } from '@/lib/public-form';
import RsvpFormClient from './rsvp-form-client';

export default async function PublicRsvpPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { i?: string };
}) {
  const data = await getPublicFormData(params.token, searchParams?.i);

  if (!data) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-navy-975 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-aurora-navy animate-aurora" aria-hidden />
        <div className="relative card bg-white max-w-md p-8 text-center">
          <h1 className="text-xl">This link isn’t available</h1>
          <p className="text-navy-500 text-sm mt-2">
            The form may not be published yet, or the link may be incorrect. Please check with your host.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-975 py-10 px-4">
      <div className="absolute inset-0 bg-aurora-navy animate-aurora" aria-hidden />
      <div className="relative max-w-xl mx-auto">
        <div className="rounded-xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent shadow-glow-navy">
          <div className="rounded-[11px] bg-white p-8">
            <p className="text-navy-400 text-xs uppercase tracking-wide mb-1">You’re invited</p>
            <h1 className="text-2xl mb-3">{data.event.publicTitle}</h1>

            <div className="text-sm text-navy-600 space-y-1 mb-5 bg-navy-50 rounded-md p-4">
              {data.event.startsAtFormatted ? <p>{data.event.startsAtFormatted}</p> : null}
              {data.event.venueLine ? <p>{data.event.venueLine}</p> : null}
              {data.event.rsvpDeadlineFormatted ? <p>Please respond by {data.event.rsvpDeadlineFormatted}</p> : null}
            </div>

            {data.introText ? <p className="text-navy-700 text-sm mb-5">{data.introText}</p> : null}

            <RsvpFormClient token={params.token} data={data} />
          </div>
        </div>
        <p className="text-center text-navy-400 text-xs mt-4">Powered by the Chair Event System</p>
      </div>
    </main>
  );
}
