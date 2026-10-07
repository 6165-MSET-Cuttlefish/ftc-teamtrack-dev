import { clearOfBarEdge, visibleBand } from './scrollUnderHeader';

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
 * How much further than `by` the page has to go so that no control is left
 * cut by the top edge (`edge`): a strip of buttons peeking out from under
 * the header. 0 where none would be.
 */
const pastTopEdge = (by: number, edge: number): number => {
  const cut = [...document.querySelectorAll('button, input, [role="checkbox"]')]
    .filter(el => !el.closest('header, .sr-only') && scrollsWithPage(el))
    .map(el => el.getBoundingClientRect())
    .filter(
      r =>
        r.width > 1 && r.height > 1 && r.top - by < edge && r.bottom - by > edge
    );
  return cut.length === 0
    ? 0
    : Math.ceil(Math.max(...cut.map(r => r.bottom - by - edge)));
};

/**
 * Bring the first row of steppers in `section` (End of Match) into view,
 * unless it is on screen already. Used at the buzzer (and by "Count them
 * first", so both land the page in the same place).
 *
 * A heading on screen is not enough: on a phone the steppers under it can
 * sit behind the bar fixed over the bottom of the page. The row is the box
 * around the first input and its +/- buttons. The scroll is the least that
 * shows the section: from below, only until its last field clears the
 * bottom edge, but never so far that `keep` (the robot rows, where End park
 * is marked first) goes off the top; from above, its heading goes just
 * under the top edge. The row has to end up on screen too. Where the row
 * and `keep` can't both be on screen (a short phone on its side, two
 * robots), `keep` wins, as End park is what the band asks for first: the
 * page stops with it at the top, and the counters follow one short scroll
 * down. Either way no control is left cut by the bar's edge.
 */
export const revealFirstStepperRow = (
  section: Element,
  keep?: Element | null
): void => {
  // Between the site header (and, on a full-size screen, the controls
  // pinned under it after the buzzer) and, on a phone, the fixed bar where
  // it is under the section (side by side it is beside it).
  const band = visibleBand(section);
  const { top, bottom } = section.getBoundingClientRect();
  const row = (
    section.querySelector('input')?.parentElement ?? section
  ).getBoundingClientRect();
  if (row.top >= band.top && row.bottom <= band.bottom) return;
  const toTop = top - band.top - REVEAL_GAP;
  const toBottom = bottom - band.bottom + REVEAL_GAP;
  const rowShown = row.bottom - band.bottom + REVEAL_GAP;
  /** The furthest the page can go with `keep` still on screen */
  const kept = keep?.getBoundingClientRect();
  const keepLimit =
    kept && kept.top >= band.top && kept.height < band.bottom - band.top
      ? kept.top - band.top - REVEAL_GAP
      : Infinity;
  let by =
    top >= band.top
      ? Math.min(Math.max(rowShown, Math.min(toTop, toBottom)), keepLimit)
      : Math.max(rowShown, toTop);
  // Not a sliver of the clock's digits under the top edge, where going on
  // past them still leaves the row and `keep` on screen.
  const clock = document.querySelector('[data-clock-row]');
  if (clock && scrollsWithPage(clock)) {
    const showing = clock.getBoundingClientRect().bottom - by - band.top;
    if (
      showing > 0 &&
      showing < CLOCK_SLIVER &&
      row.top - by - showing >= band.top &&
      by + showing <= keepLimit
    )
      by += showing;
  }
  // Nor a strip of the controls over `keep` (+1 Tip) left under the top
  // edge by the gap kept over it: the page goes on until they are gone.
  const past = pastTopEdge(by, band.top);
  if (
    past > 0 &&
    past <= REVEAL_GAP &&
    (!kept || by + past <= keepLimit + REVEAL_GAP)
  )
    by += past;
  by = Math.round(by);
  window.scrollBy({
    top: by + clearOfBarEdge(by),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
  });
};
