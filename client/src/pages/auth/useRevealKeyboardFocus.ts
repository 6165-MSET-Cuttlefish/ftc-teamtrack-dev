/**
 * The focus handler for a sign-in page's root (Login, Signup, Forgot
 * password): keyboard focus brings the whole control and its focus ring on
 * screen, clear of a pinned header.
 *
 * Tabbing down the form, the browser scrolls a field only until its text
 * line shows (on a phone) and never as far as a control's focus ring, so
 * the last field on a short screen sat half under the fold. Once that
 * scroll is done, this scrolls the rest of the way.
 */

import { useEffect, useRef, type FocusEvent } from 'react';
import { revealInView } from '@/components/session/controls/scrollUnderHeader';

export const useRevealKeyboardFocus = () => {
  // Coming back from another tab or window, the browser gives focus back to
  // the field that had it, and a text field still counts as keyboard focus
  // then. That is not a move, and the page stays where the reader left it:
  // what had focus as the window lost it is that one focus to let pass.
  const leftOn = useRef<Element | null>(null);

  useEffect(() => {
    const onWindowBlur = (e: Event) => {
      if (e.target === window) leftOn.current = document.activeElement;
    };
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, []);

  return (e: FocusEvent<HTMLElement>) => {
    const target = e.target;
    const givenBack = target === leftOn.current;
    leftOn.current = null;
    if (givenBack || !target.matches(':focus-visible')) return;
    requestAnimationFrame(() => revealInView(target));
  };
};
