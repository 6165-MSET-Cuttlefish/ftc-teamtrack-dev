import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Keyboard focus for controls that take the place of the button pressed.
 *
 * Save Match and the like are swapped for another button as they are
 * pressed (Start Match), and the focus they had falls to the page with
 * them: the next Tab would start again from the top. For a keyboard user a
 * control that comes up in their place picks it up instead. Not after a
 * mouse click or a tap: a button given focus that way would be pressed by
 * the next Space or Enter meant for something else.
 */

/** The element that last had focus, anywhere on the page */
let lastFocused: Element | null = null;
/** Whether it showed its focus ring: it got there from the keyboard */
let lastFocusVisible = false;
let watchers = 0;

const onFocusIn = (e: FocusEvent) => {
  lastFocused = e.target instanceof Element ? e.target : null;
  try {
    lastFocusVisible = lastFocused?.matches(':focus-visible') ?? false;
  } catch {
    // A browser without :focus-visible: carry focus as before
    lastFocusVisible = true;
  }
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
 * As `ref`'s control appears: if the element that had keyboard focus has
 * just been taken off the page, and focus fell to the page with it, carry
 * on from this control. Focus anywhere else is left where it is.
 */
export const useTakeDroppedFocus = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const active = document.activeElement;
    const dropped =
      (active === null || active === document.body) &&
      lastFocused !== null &&
      lastFocusVisible &&
      !lastFocused.isConnected;
    if (dropped) ref.current?.focus({ preventScroll: true });
    // Only as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * True if keyboard focus is on `el` now: a press it gets is the keyboard's
 * (Enter or Space), so whatever comes next should take the focus on.
 */
export const hasKeyboardFocus = (el: Element): boolean => {
  if (document.activeElement !== el) return false;
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
};

/**
 * The page's last resort: when the control that had keyboard focus is
 * taken off the page (pressed, or gone with what it did) and nothing picks
 * its focus up, it goes to `fallback()` rather than to the top of the page,
 * where the next Tab would start again. Looked at a frame later, once
 * whatever does pick it up (`useTakeDroppedFocus`, a dialog handing it
 * back, a toast's own way) has had its turn. Not while a dialog or the
 * walkthrough is up: those keep focus their own way.
 */
export const useCatchDroppedFocus = (fallback: () => HTMLElement | null) => {
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });
  useEffect(() => {
    let frame = 0;
    /** The control whose focus was looked after already (once only) */
    let handled: Element | null = null;
    const dropped = () =>
      lastFocused !== null &&
      lastFocused !== handled &&
      !lastFocused.isConnected &&
      lastFocusVisible;
    const check = () => {
      frame = 0;
      if (!dropped()) return;
      handled = lastFocused;
      const active = document.activeElement;
      if (active !== null && active !== document.body) return;
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-tutorial-card]'
        )
      ) {
        return;
      }
      fallbackRef.current()?.focus();
    };
    const observer = new MutationObserver(() => {
      if (frame === 0 && dropped()) frame = requestAnimationFrame(check);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);
};

/**
 * Keyboard focus to a Match Log row (its Edit button, `data-match-id`), a
 * frame from now: once the log shows what was just done.
 */
export const focusMatchRow = (matchId: string | null | undefined) => {
  if (!matchId) return;
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        `[data-match-log] [data-match-id="${CSS.escape(matchId)}"]`
      )
      ?.focus()
  );
};
