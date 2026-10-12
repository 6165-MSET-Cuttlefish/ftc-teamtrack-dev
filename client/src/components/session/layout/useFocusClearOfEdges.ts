import { useEffect } from 'react';

import { scrollsWithPage, visibleBand } from '../controls/scrollUnderHeader';
import { hasKeyboardFocus } from '../controls/takeDroppedFocus';

/** Gap kept between a control focus lands on and what covers the page, in px */
const FOCUS_GAP = 8;

/** What focus comes back from when a menu or dialog closes */
const POPUP = '[role="menu"], [role="dialog"], [role="alertdialog"]';

/**
 * Where the page starts to show under the top of the screen, for `target`
 * (see `visibleBand`). The controls row pinned on a full-size screen only
 * covers the page once it has reached the header: until the page is
 * scrolled that far it is still in its own place, and what is just under
 * it shows.
 */
const topEdge = (target: Element): number => {
  const band = visibleBand(target).top;
  const row = document.querySelector('[data-tutorial="controls"]');
  if (!row) return band;
  const { position, top } = getComputedStyle(row);
  const stuck = row.getBoundingClientRect().top <= (parseFloat(top) || 0) + 1;
  if (position !== 'sticky' || stuck) return band;
  const header = document.querySelector('header');
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
};

/**
 * Keyboard focus scrolls a control only as far as the edge of the screen,
 * and what is pinned over the page is inside that: the site header (and on
 * a full-size screen after the buzzer, the controls row pinned under it)
 * over the top, the phone's bar over the bottom. Shift+Tab back up the page
 * left steppers under the header, and Tab onto a counter just over the bar
 * left it under the bar. Once the browser has scrolled to the control, the
 * page goes on until it is clear of them, with a gap that leaves its ring
 * whole at a bare edge of the screen too.
 *
 * Only where the keyboard moved focus onto the page itself. The header,
 * the pinned row and the bar stay on screen: scroll padding on the page
 * kept focus clear as well, but it also scrolled the page to its top when
 * focus went back to one of those (a menu closing), away from what was
 * being scored. A click puts focus where the pointer is, and a field
 * clicked into (Session Notes) stays where it was clicked, even with its
 * top under the header. Focus given without a scroll, off the screen, is
 * left there.
 */
export const useFocusClearOfEdges = () => {
  useEffect(() => {
    let frame = 0;
    /** The last thing pressed was a pointer rather than a key */
    let byPointer = false;
    const onPointer = () => {
      byPointer = true;
    };
    const onKey = () => {
      byPointer = false;
    };
    // Coming back to the tab or window, the browser gives focus back to
    // the control that had it, still as keyboard focus. That isn't a move,
    // so the page stays where it was left: the first focus after the
    // window comes back is let pass if it lands on that same control.
    let leftOn: Element | null = null;
    const onWindowBlur = (event: Event) => {
      if (event.target === window) leftOn = document.activeElement;
    };
    // A menu or dialog closing gives focus back to what opened it, which
    // was on screen when it was pressed: not a move either. The menu is
    // gone by then, so it is focus last seen inside one that tells.
    let inPopup = false;
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      const intoPopup =
        target instanceof Element && target.closest(POPUP) !== null;
      const givenBack = target === leftOn || (inPopup && !intoPopup);
      leftOn = null;
      inPopup = intoPopup;
      if (
        givenBack ||
        byPointer ||
        !(target instanceof Element) ||
        !hasKeyboardFocus(target) ||
        !scrollsWithPage(target)
      ) {
        return;
      }
      cancelAnimationFrame(frame);
      // Once the browser has scrolled to it
      frame = requestAnimationFrame(() => {
        const { top, bottom } = target.getBoundingClientRect();
        if (!target.isConnected || bottom <= 0 || top >= window.innerHeight) {
          return;
        }
        const over = topEdge(target) + FOCUS_GAP - top;
        const under = bottom + FOCUS_GAP - visibleBand(target).bottom;
        // When it can't all fit, its top wins.
        const by = over > 0 ? -over : Math.max(0, Math.min(under, -over));
        if (by !== 0) window.scrollBy({ top: by, behavior: 'instant' });
      });
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('blur', onWindowBlur);
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
};
