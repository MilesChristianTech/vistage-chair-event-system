'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/** Fires a success toast when a useFormState result flips to ok — but never
 * on first mount, only after an actual submission. Without this, saving a
 * settings form gives no visible confirmation beyond the button relabeling,
 * which reads as "did that actually work?" */
export function useSuccessToast(state: { ok: boolean }, message: string) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.ok) toast.success(message);
  }, [state, message]);
}
