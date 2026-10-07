/** Space left between the site header and what is scrolled to, in px */
const HEADER_GAP = 8;

/** What can be pressed or typed in */
const CONTROLS =
  'button, a[href], input, select, textarea, [role="button"], [role="checkbox"]';

/** The phone's match controls, where they are a bar fixed to the bottom */
const fixedBar = (): HTMLElement | null => {
  const bar = document.querySelector<HTMLElement>('[data-tutorial="controls"]');
  return bar && getComputedStyle(bar).position === 'fixed' ? bar : null;
};

/** Whether two boxes share any of the screen's width */
const overlapsAcross = (
  a: { left: number; right: number },
  b: { left: number; right: number }
): boolean => a.left < b.right && a.right > b.left;

/**
 * Where the controls on the page are on screen: not those in the bar or
 * the header (which stay put when the page scrolls), nor toasts, nor any
 * that are not laid out or only there for a screen reader (1 px).
 */
const pageControls = (bar: HTMLElement, extra = ''): DOMRect[] => {
  const header = document.querySelector('header');
  return [...document.querySelectorAll(`${CONTROLS}${extra}`)]
    .filter(
      el =>
        !bar.contains(el) &&
        !header?.contains(el) &&
        !el.closest('.sr-only, [data-sonner-toaster]')
    )
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 1 && r.height > 1);
};

/**
 * True when the `height` px of screen right above the phone's bar show
 * nothing that can be pressed, nor the match clock: the bar could grow by
 * that much without covering any of it. False where there is no such bar.
 */
export const roomAboveBar = (height: number): boolean => {
  const bar = fixedBar();
  if (!bar) return false;
  const { top, left, right } = bar.getBoundingClientRect();
  // What is scrolled away under the pinned header is not on screen
  const headerBottom = visibleBand().top;
  return !pageControls(bar, ', [data-match-timer]').some(
    r =>
      r.right > left &&
      r.left < right &&
      r.top < top &&
      r.bottom > Math.max(top - height, headerBottom)
  );
};

/**
 * The most the page stops short of where it was going, to leave a control
 * the bar's edge would cut all under the bar instead: a button's height
 */
const MAX_SHORT = 48;

/**
 * What to add to a scroll of `by` px so that no control is left cut by the
 * top edge of the phone's bar: part of it on screen, the rest under the
 * bar. Either a little further, until it shows in full (only as far as
 * the gap kept under the header can give), or a little short, until it is
 * all under the bar; whichever is less, and only if that leaves no other
 * control cut instead. Else 0.
 */
export const clearOfBarEdge = (by: number): number => {
  const bar = fixedBar();
  if (!bar) return 0;
  const barRect = bar.getBoundingClientRect();
  const edge = barRect.top;
  // Side by side the bar only spans the clock's column: what scrolls
  // beside it isn't cut by its edge.
  const controls = pageControls(bar).filter(r => overlapsAcross(r, barRect));
  // The controls the edge cuts once the page is scrolled by `to`
  const cutAt = (to: number) =>
    controls.filter(r => r.top - to < edge && r.bottom - to > edge);
  const cut = cutAt(by);
  if (cut.length === 0) return 0;
  const further = Math.ceil(Math.max(...cut.map(r => r.bottom - by - edge)));
  const short = Math.ceil(Math.max(...cut.map(r => edge - (r.top - by))));
  const ways = [
    ...(further < HEADER_GAP ? [further] : []),
    ...(short <= MAX_SHORT ? [-short] : []),
  ].sort((a, b) => Math.abs(a) - Math.abs(b));
  return ways.find(extra => cutAt(by + extra).length === 0) ?? 0;
};

/**
 * The part of the screen the page shows through: below the site header when
 * it is pinned, and above the match controls when they are a bar fixed to
 * the bottom of the screen (the phone layout). On a full-size screen the
 * controls are pinned under the header after the buzzer, with a band of
 * background `HEADER_GAP` deep under them: the page shows below that.
 *
 * Given what is to be shown (`target`), the bar only counts where it is
 * under it: on a phone on its side the bar spans the clock's column alone,
 * and the scoring column beside it shows down to the bottom of the screen.
 */
export const visibleBand = (
  target?: Element
): { top: number; bottom: number } => {
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
      bar &&
      barPosition === 'fixed' &&
      (!target ||
        overlapsAcross(
          bar.getBoundingClientRect(),
          target.getBoundingClientRect()
        ))
        ? bar.getBoundingClientRect().top
        : window.innerHeight,
  };
};

/**
 * Scroll the page so `target` starts just under the site header.
 * `scrollIntoView` would put it underneath a pinned header instead. On a
 * phone the page goes a few px further, or stops a little short, where
 * that keeps a control from being cut by the bar's edge.
 *
 * With `onlyIfHidden`, a target that is already on screen in full is left
 * where it is.
 */
export const scrollUnderHeader = (
  target: Element,
  { onlyIfHidden = false }: { onlyIfHidden?: boolean } = {}
) => {
  const band = visibleBand(target);
  const { top, bottom } = target.getBoundingClientRect();
  if (onlyIfHidden && top >= band.top && bottom <= band.bottom) return;
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  // In whole px, as the page scrolls: what is worked out for the bar's
  // edge must be where things land.
  const by = Math.round(top - band.top - HEADER_GAP);
  window.scrollBy({
    top: by + clearOfBarEdge(by),
    behavior: reduceMotion ? 'instant' : 'smooth',
  });
};

/**
 * Bring `target` into view by the shortest scroll, then clear of the pinned
 * header and the fixed bar, which `scrollIntoView` knows nothing about.
 */
export const revealInView = (target: Element) => {
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  const band = visibleBand(target);
  const { top, bottom } = target.getBoundingClientRect();
  const under = bottom + HEADER_GAP - band.bottom;
  const over = band.top + HEADER_GAP - top;
  // When it can't all fit, its top wins.
  if (over > 0) window.scrollBy({ top: -over, behavior: 'instant' });
  else if (under > 0) {
    window.scrollBy({ top: Math.min(under, -over), behavior: 'instant' });
  }
};
