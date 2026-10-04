import { useCallback, useLayoutEffect, useRef } from 'react';

/** How long after a dialog opens its destructive button ignores presses */
const ARM_DELAY_MS = 450;

/**
 * For the button in a dialog that does something that can't be undone.
 *
 * A dialog can open right where the finger that opened it still is: on a
 * phone the sign-out question puts "Sign Out Anyway" exactly where the menu
 * item was, so the second half of a quick double tap lands on it. The check
 * this returns is false from the moment `open` turns true until `delayMs`
 * later (and while closed), and true from then on; the button only acts when
 * it is true. The safe choice should not be guarded: a stray press on it is
 * harmless.
 *
 * Asked at the moment of the press rather than kept as state, so the time is
 * measured from when the dialog actually appeared to when the press arrived.
 */
export const useArmedAfterOpen = (
  open: boolean,
  delayMs: number = ARM_DELAY_MS
): (() => boolean) => {
  const openedAtRef = useRef<number | null>(null);

  // In the same commit that shows the dialog, before anything can press it.
  useLayoutEffect(() => {
    openedAtRef.current = open ? performance.now() : null;
  }, [open]);

  return useCallback(() => {
    const openedAt = openedAtRef.current;
    return openedAt !== null && performance.now() - openedAt >= delayMs;
  }, [delayMs]);
};
