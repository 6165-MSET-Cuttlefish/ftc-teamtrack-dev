import { useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * Keyboard focus for controls that take the place of the button pressed.
 *
 * Save Match, Keep scoring and the like are swapped for another button as
 * they are pressed (Start Match, End early), and the focus they had falls
 * to the page with them: the next Tab would start again from the top. A
 * control that comes up in their place picks it up instead.
 */

/** The element that last had focus, anywhere on the page */
let lastFocused: Element | null = null;
let watchers = 0;

const onFocusIn = (e: FocusEvent) => {
  lastFocused = e.target instanceof Element ? e.target : null;
};

/** Follow focus on the page while any caller is mounted. */
export const useWatchFocus = () => {
  useEffect(() => {
    if (watchers++ === 0) document.addEventListener('focusin', onFocusIn);
    return () => {
      if (--watchers === 0) {
        document.removeEventListener('focusin', onFocusIn);
        lastFocused = null;
      }
    };
  }, []);
};

/**
 * As `ref`'s control appears: if the element that had focus has just been
 * taken off the page, and focus fell to the page with it, carry on from
 * this control. Focus anywhere else is left where it is.
 */
export const useTakeDroppedFocus = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const active = document.activeElement;
    const dropped =
      (active === null || active === document.body) &&
      lastFocused !== null &&
      !lastFocused.isConnected;
    if (dropped) ref.current?.focus({ preventScroll: true });
    // Only as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
