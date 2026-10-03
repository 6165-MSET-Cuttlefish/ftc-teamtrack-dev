/** Space left between the site header and what is scrolled to, in px */
const HEADER_GAP = 8;

/**
 * The part of the screen the page shows through: below the site header when
 * it is pinned, and above the match controls when they are a bar fixed to
 * the bottom of the screen (the phone layout). On a full-size screen the
 * controls are pinned under the header after the buzzer, with a band of
 * background `HEADER_GAP` deep under them: the page shows below that.
 */
export const visibleBand = (): { top: number; bottom: number } => {
  const header = document.querySelector('header');
  const headerPinned =
    header !== null &&
    ['sticky', 'fixed'].includes(getComputedStyle(header).position);
  const bar = document.querySelector<HTMLElement>('[data-tutorial="controls"]');
  const barPosition = bar ? getComputedStyle(bar).position : null;
  const headerHeight = headerPinned ? header.getBoundingClientRect().height : 0;
  return {
    top:
      bar && barPosition === 'sticky'
        ? headerHeight + bar.offsetHeight + HEADER_GAP
        : headerHeight,
    bottom:
      bar && barPosition === 'fixed'
        ? bar.getBoundingClientRect().top
        : window.innerHeight,
  };
};

/**
 * Scroll the page so `target` starts just under the site header.
 * `scrollIntoView` would put it underneath a pinned header instead.
 *
 * With `onlyIfHidden`, a target that is already on screen in full is left
 * where it is.
 */
export const scrollUnderHeader = (
  target: Element,
  { onlyIfHidden = false }: { onlyIfHidden?: boolean } = {}
) => {
  const band = visibleBand();
  const { top, bottom } = target.getBoundingClientRect();
  if (onlyIfHidden && top >= band.top && bottom <= band.bottom) return;
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  window.scrollBy({
    top: top - band.top - HEADER_GAP,
    behavior: reduceMotion ? 'instant' : 'smooth',
  });
};

/**
 * Bring `target` into view by the shortest scroll, then clear of the pinned
 * header and the fixed bar, which `scrollIntoView` knows nothing about.
 */
export const revealInView = (target: Element) => {
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  const band = visibleBand();
  const { top, bottom } = target.getBoundingClientRect();
  const under = bottom + HEADER_GAP - band.bottom;
  const over = band.top + HEADER_GAP - top;
  // When it can't all fit, its top wins.
  if (over > 0) window.scrollBy({ top: -over, behavior: 'instant' });
  else if (under > 0) {
    window.scrollBy({ top: Math.min(under, -over), behavior: 'instant' });
  }
};
