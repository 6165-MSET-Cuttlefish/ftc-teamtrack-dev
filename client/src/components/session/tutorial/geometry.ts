/*
 * Where the tutorial's spotlight goes: round what a page element shows, with
 * the same space on every side and corners that follow the element's own.
 */

/** Space between what is spotlit and the inner edge of the ring, in px */
export const SPOT_PAD = 8;
/** The ring's width, in px */
export const SPOT_RING = 2;
/** Least room kept between the ring and a screen edge, in px */
export const EDGE_MIN = 2;
/** Least space kept round what is spotlit when a screen edge is that close, in px */
const MIN_PAD = 3;
/** Corner radius for what is spotlit when nothing in it has corners of its own */
const DEFAULT_RADIUS = 12;
/** The roundest corner the spotlight takes from what it surrounds */
const MAX_RADIUS = 20;

export interface Edges {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** What a page element shows, measured relative to its own top left corner */
export interface Painted {
  edges: Edges;
  /** Corner radius of the boxes that make the corners of `edges`, in px */
  radius: number;
}

export interface HoleBox {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

const isTransparent = (color: string) =>
  color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);

/**
 * Elements that draw something of their own whatever their styles say. Not
 * a button: one can be a bare icon or word with a hit area round it bigger
 * than what it shows (the (i) beside a counter's name is 44px under a
 * finger round a 14px icon), so a button counts at its full size only when
 * it paints that size, like any other element.
 */
const REPLACED = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'IMG',
  'svg',
  'CANVAS',
  'VIDEO',
]);

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;

/** Splits a list of CSS values at the commas that are not inside brackets */
const layers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out;
};

/**
 * True for a shadow that shows: Tailwind gives every element with a ring or
 * shadow class a stack of shadows, most of them transparent placeholders.
 */
const showsShadow = (value: string) =>
  value !== 'none' &&
  layers(value).some(layer => {
    const color = layer.match(/(?:rgba?|hsla?|color)\([^)]*\)|transparent/);
    return !color || !isTransparent(color[0]);
  });

/** True for a box that paints all of itself: a background, a border or a shadow */
const paintsBox = (style: CSSStyleDeclaration) =>
  !isTransparent(style.backgroundColor) ||
  style.backgroundImage !== 'none' ||
  showsShadow(style.boxShadow) ||
  SIDES.some(
    side =>
      parseFloat(style[`border${side}Width`]) > 0 &&
      !isTransparent(style[`border${side}Color`])
  );

/**
 * True for an element that is there for screen readers only (`sr-only`):
 * clipped away, or shrunk to a pixel with what overflows it cut off. Its
 * words still measure their full width, a pixel left of the page's.
 */
const visuallyHidden = (el: Element, style: CSSStyleDeclaration) => {
  if (
    style.clip !== 'auto' &&
    (style.position === 'absolute' || style.position === 'fixed')
  ) {
    return true;
  }
  if (style.overflowX === 'visible' && style.overflowY === 'visible') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width <= 1 || rect.height <= 1;
};

const radiusOf = (value: string, box: DOMRect): number => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.trim().endsWith('%')
    ? (n / 100) * Math.min(box.width, box.height)
    : n;
};

/**
 * Where the element shows anything: the union of its text, its icons and
 * fields, and every box that paints a background, a border or a shadow,
 * skipping what is hidden or visually hidden. Not its own box: an element
 * can be taller than what it shows (the live counters keep a blank line for
 * a message that comes and goes), or reach the screen's edges (the phone's
 * match controls). Nor a bare button's hit area, which can reach past the
 * icon or words it shows. The
 * corner radius is the roundest of the boxes that make the union's corners,
 * so the spotlight's corners follow the element's: one radius for all four,
 * so they are even.
 */
export const measurePainted = (root: HTMLElement): Painted | null => {
  const origin = root.getBoundingClientRect();
  let edges: Edges | null = null;
  const boxes: { rect: DOMRect; style: CSSStyleDeclaration }[] = [];
  const add = (r: DOMRect) => {
    if (r.width <= 1 || r.height <= 1) return false;
    edges = edges
      ? {
          top: Math.min(edges.top, r.top),
          left: Math.min(edges.left, r.left),
          right: Math.max(edges.right, r.right),
          bottom: Math.max(edges.bottom, r.bottom),
        }
      : { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    return true;
  };
  const visit = (el: Element) => {
    const style = getComputedStyle(el);
    if (
      style.display === 'none' ||
      Number(style.opacity) === 0 ||
      visuallyHidden(el, style)
    ) {
      return;
    }
    let box = false;
    if (style.visibility === 'visible') {
      box = el !== root && (REPLACED.has(el.tagName) || paintsBox(style));
      if (box) {
        const rect = el.getBoundingClientRect();
        if (add(rect)) boxes.push({ rect, style });
      } else {
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            add(range.getBoundingClientRect());
          }
        }
      }
      // A control's insides are already inside its box
      if (box && REPLACED.has(el.tagName)) return;
    }
    for (const child of el.children) visit(child);
  };
  visit(root);
  const found = edges as Edges | null;
  if (!found) return null;

  const near = (a: number, b: number) => Math.abs(a - b) <= 1.5;
  let radius = 0;
  for (const { rect, style } of boxes) {
    const top = near(rect.top, found.top);
    const bottom = near(rect.bottom, found.bottom);
    const left = near(rect.left, found.left);
    const right = near(rect.right, found.right);
    const corners: string[] = [];
    if (top && left) corners.push(style.borderTopLeftRadius);
    if (top && right) corners.push(style.borderTopRightRadius);
    if (bottom && left) corners.push(style.borderBottomLeftRadius);
    if (bottom && right) corners.push(style.borderBottomRightRadius);
    for (const corner of corners) {
      radius = Math.max(radius, radiusOf(corner, rect));
    }
  }
  const width = found.right - found.left;
  const height = found.bottom - found.top;
  return {
    edges: {
      top: found.top - origin.top,
      left: found.left - origin.left,
      right: found.right - origin.left,
      bottom: found.bottom - origin.top,
    },
    radius: Math.min(
      radius > 0 ? radius : DEFAULT_RADIUS,
      MAX_RADIUS,
      width / 2,
      height / 2
    ),
  };
};

/**
 * The spotlight's opening round `edges` (on screen): the same space on every
 * side, and corners as round as the element's plus that space, so the ring
 * runs parallel to the element all the way round. Where a screen edge is too
 * close for that space (the phone's match controls sit at the bottom), the
 * space shrinks on every side alike rather than on one, and the ring stays
 * whole on screen. `pinned`: the element stays put as the page scrolls, so
 * the top and bottom edges of the screen count too.
 */
export const holeAround = (
  edges: Edges,
  radius: number,
  view: { width: number; height: number },
  pinned: boolean
): HoleBox => {
  const gaps = [edges.left, view.width - edges.right];
  if (pinned) gaps.push(edges.top, view.height - edges.bottom);
  const room = Math.floor(Math.min(...gaps) - SPOT_RING - EDGE_MIN);
  const pad = Math.max(MIN_PAD, Math.min(SPOT_PAD, room));
  return {
    top: edges.top - pad,
    left: edges.left - pad,
    width: edges.right - edges.left + 2 * pad,
    height: edges.bottom - edges.top + 2 * pad,
    radius: radius + pad,
  };
};

/** Least of an opening cut short by `keepInBand` still worth showing, in px */
const MIN_SHOWN = 40;

/**
 * An opening round something taller than the part of the screen left
 * between the header and a bar pinned to the bottom (a phone on its side)
 * stops at their edges, ring and all, so its corners stay round and whole;
 * what is spotlit carries on past it. Left alone when that would leave too
 * little of it to show (it is being scrolled away).
 */
export const keepInBand = (
  box: HoleBox,
  band: { top: number; bottom: number }
): HoleBox => {
  const top = Math.max(box.top, band.top + SPOT_RING + EDGE_MIN);
  const bottom = Math.min(
    box.top + box.height,
    band.bottom - SPOT_RING - EDGE_MIN
  );
  if (top === box.top && bottom === box.top + box.height) return box;
  if (bottom - top < MIN_SHOWN) return box;
  return {
    ...box,
    top,
    height: bottom - top,
    radius: Math.min(box.radius, (bottom - top) / 2),
  };
};

/** True for an element that stays where it is on screen as the page scrolls. */
export const isPinned = (el: HTMLElement) => {
  for (
    let node: HTMLElement | null = el;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
};

/**
 * How far down the screen the page can be seen round `target`: to the top
 * of a bar pinned over the bottom of the screen (the phone's match
 * controls) where the bar is under it, else to the bottom of the screen.
 */
export const screenFloor = (
  target: HTMLElement,
  barSelector: string,
  viewHeight: number
): number => {
  const bar = document.querySelector<HTMLElement>(barSelector);
  if (!bar || bar.contains(target) || !isPinned(bar)) return viewHeight;
  const edge = bar.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const under = edge.left < rect.right && edge.right > rect.left;
  return under && edge.top > viewHeight / 2
    ? Math.min(viewHeight, edge.top)
    : viewHeight;
};

/**
 * The part of the screen the spotlight takes round `el` (its ring
 * included), for keeping the card off it. The element's own box when it
 * shows nothing that can be measured.
 */
export const spotlitRect = (el: HTMLElement): Edges => {
  const rect = el.getBoundingClientRect();
  const painted = measurePainted(el);
  if (!painted) {
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    };
  }
  const reach = SPOT_PAD + SPOT_RING;
  return {
    top: rect.top + painted.edges.top - reach,
    left: rect.left + painted.edges.left - reach,
    right: rect.left + painted.edges.right + reach,
    bottom: rect.top + painted.edges.bottom + reach,
  };
};
