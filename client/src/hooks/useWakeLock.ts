import { useEffect } from 'react';

/**
 * Keeps the screen awake while `active` is true, where the browser can.
 *
 * The Screen Wake Lock API is missing from older browsers and can be refused
 * (low battery, power saver), so this is an enhancement only: nothing is
 * shown, and nothing depends on the lock being held. The browser drops the
 * lock whenever the page is hidden, so it is asked for again once the page
 * is back in view.
 */
export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let requesting = false;
    let cancelled = false;

    const request = async () => {
      // A hidden page is refused, and a lock still held (or already on its
      // way) needs no second one.
      if (document.visibilityState !== 'visible') return;
      if (requesting || (sentinel && !sentinel.released)) return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        // Turned off while the request was still out
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        /* refused: the screen follows the device's own timeout */
      } finally {
        requesting = false;
      }
    };

    void request();
    document.addEventListener('visibilitychange', request);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
};
