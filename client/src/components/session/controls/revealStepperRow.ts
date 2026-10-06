import { visibleBand } from './scrollUnderHeader';

/** Space left between what is revealed and the band's edges, in px */
const REVEAL_GAP = 8;

/**
 * Less of the big clock than this left showing under the top edge reads as
 * a stray band of digit bottoms, not a clock: the page goes on until it is
 * off the top.
 */
const CLOCK_SLIVER = 24;

/** Whether the element scrolls with the page (not pinned in a column) */
const scrollsWithPage = (el: Element): boolean => {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const { position } = getComputedStyle(e);
    if (position === 'sticky' || position === 'fixed') return false;
  }
  return true;
};

/**
 * Bring the first row of steppers in `section` (End of Match) into view,
 * unless it is on screen already. Used at the buzzer and by "Count them
 * first", so both land the page in the same place.
 *
 * A heading on screen is not enough: on a phone the steppers under it can
 * sit behind the bar fixed over the bottom of the page. The row is the box
 * around the first input and its +/- buttons. The scroll is the least that
 * shows the section: from below, only until its last field clears the
 * bottom edge, so the robot rows above it (End park) stay on screen where
 * there is room for both; from above, its heading goes just under the top
 * edge. Either way the row has to end up on screen: where the heading and
 * the row can't both fit, the row's bottom goes just over the bottom edge
 * and the heading goes off the top.
 */
export const revealFirstStepperRow = (section: Element): void => {
  // Between the site header (and, on a full-size screen, the controls
  // pinned under it after the buzzer) and, on a phone, the fixed bar.
  const band = visibleBand();
  const { top, bottom } = section.getBoundingClientRect();
  const row = (
    section.querySelector('input')?.parentElement ?? section
  ).getBoundingClientRect();
  if (row.top >= band.top && row.bottom <= band.bottom) return;
  const toTop = top - band.top - REVEAL_GAP;
  const toBottom = bottom - band.bottom + REVEAL_GAP;
  const rowShown = row.bottom - band.bottom + REVEAL_GAP;
  let by = Math.max(
    rowShown,
    top >= band.top ? Math.min(toTop, toBottom) : toTop
  );
  // Not a sliver of the clock's digits under the top edge, where going on
  // past them still leaves the row on screen.
  const clock = document.querySelector('[data-clock-row]');
  if (clock && scrollsWithPage(clock)) {
    const showing = clock.getBoundingClientRect().bottom - by - band.top;
    if (
      showing > 0 &&
      showing < CLOCK_SLIVER &&
      row.top - by - showing >= band.top
    )
      by += showing;
  }
  window.scrollBy({
    top: by,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
  });
};
