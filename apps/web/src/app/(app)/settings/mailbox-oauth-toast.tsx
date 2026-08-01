'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

/** The Microsoft OAuth callback redirects back here with a `ms_connected` or
 * `ms_error` query param — this fires the matching toast once, then strips
 * the param from the URL so it can't re-fire on refresh or linger forever
 * as a static banner. */
export default function MailboxOAuthToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get('ms_connected');
    const error = searchParams.get('ms_error');
    if (!connected && !error) return;

    if (connected) {
      toast.success('Your Microsoft account is connected.');
    } else if (error === 'not_configured') {
      toast.error("Microsoft sign-in isn't set up yet — this is a one-time step for the operator.");
    } else if (error) {
      toast.error("Couldn't connect your Microsoft account. Please try again.");
    }

    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
