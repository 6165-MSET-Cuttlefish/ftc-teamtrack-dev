import {
  clearOfBarEdge,
  scrollsWithPage,
  visibleBand,
} from './scrollUnderHeader';

/** Space left between what is revealed and the band's edges, in px */
const REVEAL_GAP = 8;

/**
 * Less of the big clock than this left showing under the top edge reads as
 * a stray band of digit bottoms, not a clock: the page goes on until it is
 * off the top.
 */
const CLOCK_SLIVER = 24;

/**
 * The controls left cut by the top edge (`edge`) once the page has gone
 * `by` px: a strip of buttons peeking out from under the header. How much
 * further the page has to go to take them all off the top (`past`), and
 * how much less to have them all under it (`short`). 0 and 0 where none
 * would be.
 */
const cutByTopEdge = (
  by: number,
  edge: number
): { past: number; short: number } => {
  const cut = [...document.querySelectorAll('button, input, [role="checkbox"]')]
    .filter(el => !el.closest('header, .sr-only') && scrollsWithPage(el))
    .map(el => el.getBoundingClientRect())
    .filter(
      r =>
        r.width > 1 && r.height > 1 && r.top - by < edge && r.bottom - by > edge
    );
  return cut.length === 0
    ? { past: 0, short: 0 }
    : {
        past: Math.ceil(Math.max(...cut.map(r => r.bottom - by - edge))),
        short: Math.ceil(Math.max(...cut.map(r => edge - (r.top - by)))),
      };
};

/**
 * Whether the page, once it has gone `by` px, leaves any of `boxes` (as on
 * screen now) cut by the screen line `edge`: part above it, part below.
 */
const cutAt = (boxes: DOMRect[], by: number, edge: number): boolean =>
  boxes.some(r => r.top - by < edge && r.bottom - by > edge);

/**
 * Where the page stops, given the scroll the reveal worked out (`by`):
 * there, or a few px off it where that keeps a control from being cut by
 * the bar's edge (`clearOfBarEdge`), if nothing is cut by either edge
 * there. Where the rows only just fit between the edges (a short screen),
 * clearing one edge can cut a row at the other: then it is the nearest
 * place clean at both, with no sliver of the clock under the top one
 * either, that still shows all that `by` does of `shown` (the robot rows,
 * the section's note, its first row), at most `REVEAL_GAP` further or half
 * the screen short. Where there is none, it is the one of those places
 * clean at the top edge with the least of a row peeking over the bar: a
 * strip of controls left under the header reads worse.
 */
const settle = (
  by: number,
  band: { top: number; bottom: number },
  shown: DOMRect[]
): number => {
  const moved = by + clearOfBarEdge(by);
  const controls = [
    ...document.querySelectorAll('button, input, [role="checkbox"]'),
  ].filter(el => !el.closest('header, .sr-only') && scrollsWithPage(el));
  // A stepper's frame is a px taller than its buttons: that px shows too
  const boxes = [
    ...controls,
    ...controls.flatMap(el =>
      el instanceof HTMLInputElement && el.parentElement
        ? [el.parentElement]
        : []
    ),
  ]
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 1 && r.height > 1);
  const clock = document.querySelector('[data-clock-row]');
  const clockBottom =
    clock && scrollsWithPage(clock)
      ? clock.getBoundingClientRect().bottom
      : null;
  const topClean = (to: number) => {
    const clockShowing = clockBottom === null ? 0 : clockBottom - to - band.top;
    return (
      !cutAt(boxes, to, band.top) &&
      !(clockShowing > 0 && clockShowing < CLOCK_SLIVER)
    );
  };
  // The bar only has an edge to cut at where it is under the section
  const barEdge = band.bottom < window.innerHeight ? band.bottom : null;
  /** How far the controls the bar's edge cuts reach over it (0: none) */
  const overBar = (to: number) =>
    barEdge === null
      ? 0
      : Math.max(
          0,
          ...boxes
            .filter(r => r.top - to < barEdge && r.bottom - to > barEdge)
            .map(r => barEdge - (r.top - to))
        );
  if (topClean(moved) && overBar(moved) === 0) return moved;
  const onScreen = (r: DOMRect, to: number) =>
    r.top - to >= band.top && r.bottom - to <= band.bottom;
  const staying = shown.filter(r => onScreen(r, by));
  // Only where the page can scroll to: elsewhere it would stop short
  const least = -window.scrollY;
  const most =
    document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  const back = Math.floor((band.bottom - band.top) / 2);
  let fallback: { to: number; over: number } | null = null;
  for (let step = 0; step <= back; step++) {
    const tries =
      step === 0
        ? [by]
        : step <= REVEAL_GAP
          ? [by + step, by - step]
          : [by - step];
    for (const to of tries) {
      if (
        to < least ||
        to > most ||
        !topClean(to) ||
        !staying.every(r => onScreen(r, to))
      )
        continue;
      const over = overBar(to);
      if (over === 0) return to;
      if (!fallback || over < fallback.over) fallback = { to, over };
    }
  }
  return fallback?.to ?? by;
};

/**
 * Bring the first row of steppers in `section` (End of Match) into view,
 * unless it is on screen already. Used at the buzzer.
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
 * down. Either way no control is left cut by the bar's edge, nor by the top
 * edge, wherever there is a place for that (see `settle`).
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
  // Where it is more than that gap (a short scroll that only just clears
  // the band at the foot of the screen), it stops that little short of
  // them instead, as long as the row still shows; else it goes on past
  // them, as long as the row and `keep` stay on screen.
  const { past, short } = cutByTopEdge(by, band.top);
  if (
    past > 0 &&
    past <= REVEAL_GAP &&
    (!kept || by + past <= keepLimit + REVEAL_GAP)
  )
    by += past;
  else if (
    past > 0 &&
    short <= REVEAL_GAP &&
    row.bottom - by + short <= band.bottom
  )
    by -= short;
  else if (
    past > 0 &&
    row.top - by - past >= band.top &&
    (!kept || by + past <= keepLimit) &&
    cutByTopEdge(by + past, band.top).past === 0
  )
    by += past;
  by = Math.round(by);
  // The section's note (the band over the counters): its first paragraph
  const note = (section.querySelector('p') ?? section).getBoundingClientRect();
  window.scrollBy({
    top: settle(by, band, kept ? [kept, note, row] : [note, row]),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
  });
};
