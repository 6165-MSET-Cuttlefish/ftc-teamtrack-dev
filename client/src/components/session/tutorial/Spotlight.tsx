import { useEffect, useRef, useState } from 'react';
import {
  SPOT_RING,
  holeAround,
  isPinned,
  keepInBand,
  measurePainted,
  type HoleBox,
  type Painted,
} from './geometry';

/** How long the opening takes to move from one step's element to the next */
const MOVE_MS = 380;
const MOVE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Far enough to cover the whole page, from wherever the opening is on it */
const DIM_SPREAD = 9999;

const FADE = 'opacity 200ms ease-out';
const GLIDE = [
  'top',
  'left',
  'width',
  'height',
  'border-radius',
  'box-shadow',
].map(property => `${property} ${MOVE_MS}ms ${MOVE_EASE}`);

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The tutorial's dimmed page with one opening in it, round the element the
 * step is about: a plain dim (no blur, which smears the text next to it), a
 * rounded opening with the same space on every side of the element, and a
 * crisp ring in the accent with a soft glow. The opening is the box of one
 * element and the dim is its shadow, so the page shows through it exactly
 * as it is. It moves from one step's element to the next.
 *
 * Placed on the page, not the screen, for an element that scrolls with it,
 * so the two move together; on the screen for one pinned there (the phone's
 * match controls). Re-measured only when the element changes or moves.
 *
 * `target` null with `expectTarget`: the step's element is about to render,
 * so the opening stays where it is. Without `expectTarget` the step points
 * at nothing and the whole page is dimmed.
 */
export const Spotlight = ({
  target,
  expectTarget,
  isDarkMode,
  zIndex,
  header,
  bottomBar,
}: {
  target: HTMLElement | null;
  expectTarget: boolean;
  isDarkMode: boolean;
  zIndex: number;
  /** The raised site header: its height, and the layer to dim it on */
  header: { bottom: number; zIndex: number };
  /** A bar that may be pinned over the bottom of the page (the phone's controls) */
  bottomBar?: string;
}) => {
  const holeRef = useRef<HTMLDivElement | null>(null);
  /** The header's bottom edge, for the frame loop, which outlives renders */
  const headerBottomRef = useRef(header.bottom);
  headerBottomRef.current = header.bottom;
  /** False until the opening has been placed once: nothing shows before */
  const [placed, setPlaced] = useState(false);

  const dim = isDarkMode ? 'rgba(0, 0, 0, 0.62)' : 'rgba(15, 23, 42, 0.48)';
  const ring = `0 0 0 ${SPOT_RING}px rgb(var(--team-blue)), 0 0 20px 3px rgb(var(--team-blue) / ${isDarkMode ? 0.4 : 0.3})`;
  const noRing = '0 0 0 0 transparent, 0 0 0 0 transparent';

  useEffect(() => {
    const hole = holeRef.current;
    if (!hole) return;
    if (expectTarget && !target) return;

    const fixed = target ? isPinned(target) : true;
    const placedBefore = hole.dataset.placed === 'true';
    const reduced = reducedMotion();
    /** Moves made until then glide; later ones (a resize) are immediate */
    const glideUntil =
      placedBefore && !reduced ? performance.now() + MOVE_MS + 120 : 0;

    // From the screen to the page or back: put the opening where it is now
    // in the new terms first, so it glides from there and does not jump.
    const wasFixed = hole.style.position === 'fixed';
    if (placedBefore && wasFixed !== fixed) {
      const now = hole.getBoundingClientRect();
      hole.style.transition = FADE;
      hole.style.position = fixed ? 'fixed' : 'absolute';
      hole.style.top = `${now.top + (fixed ? 0 : window.scrollY)}px`;
      hole.style.left = `${now.left + (fixed ? 0 : window.scrollX)}px`;
      // Have that land before the move starts
      void hole.offsetWidth;
    }

    let painted: Painted | null = null;
    let dirty = true;
    const markDirty = () => {
      dirty = true;
    };
    const resizes = new ResizeObserver(markDirty);
    const mutations = new MutationObserver(markDirty);
    if (target) {
      resizes.observe(target);
      mutations.observe(target, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'disabled'],
      });
    }
    window.addEventListener('resize', markDirty);

    /** The bar pinned over the bottom of the page, if there is one */
    let bar: HTMLElement | null = null;
    let barPinned = false;
    /**
     * How far down the page shows round `box`: to the bar's top edge where
     * the bar is under it, else to the bottom of the screen.
     */
    const floor = (box: HoleBox, height: number) => {
      const el = bottomBar
        ? document.querySelector<HTMLElement>(bottomBar)
        : null;
      if (el !== bar) {
        bar = el;
        barPinned = !!el && !el.contains(target) && isPinned(el);
      }
      if (!bar || !barPinned) return height;
      const edge = bar.getBoundingClientRect();
      const under = edge.left < box.left + box.width && edge.right > box.left;
      return under && edge.top > height / 2
        ? Math.min(height, edge.top)
        : height;
    };

    let last = '';
    const write = (box: HoleBox, lit: boolean) => {
      const top = Math.round(box.top + (fixed ? 0 : window.scrollY));
      const left = Math.round(box.left + (fixed ? 0 : window.scrollX));
      const width = Math.max(0, Math.round(box.width));
      const height = Math.max(0, Math.round(box.height));
      const radius = Math.round(box.radius);
      const key = `${top},${left},${width},${height},${radius},${lit}`;
      if (key === last) return;
      last = key;
      hole.style.transition = [
        FADE,
        ...(performance.now() < glideUntil ? GLIDE : []),
      ].join(', ');
      hole.style.position = fixed ? 'fixed' : 'absolute';
      hole.style.top = `${top}px`;
      hole.style.left = `${left}px`;
      hole.style.width = `${width}px`;
      hole.style.height = `${height}px`;
      hole.style.borderRadius = `${radius}px`;
      hole.style.boxShadow = `${lit ? ring : noRing}, 0 0 0 ${DIM_SPREAD}px ${dim}`;
      hole.style.opacity = '1';
      hole.dataset.placed = 'true';
      setPlaced(true);
    };

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const view = { width: window.innerWidth, height: window.innerHeight };
      if (!target) {
        // Nothing to point at: the opening closes to a point under the
        // centred card, and the whole page is dimmed.
        write(
          {
            top: view.height / 2,
            left: view.width / 2,
            width: 0,
            height: 0,
            radius: 0,
          },
          false
        );
        return;
      }
      if (!target.isConnected) return;
      if (dirty) {
        dirty = false;
        painted = measurePainted(target);
      }
      if (!painted) return;
      const rect = target.getBoundingClientRect();
      const box = holeAround(
        {
          top: rect.top + painted.edges.top,
          left: rect.left + painted.edges.left,
          right: rect.left + painted.edges.right,
          bottom: rect.top + painted.edges.bottom,
        },
        painted.radius,
        view,
        fixed
      );
      write(
        fixed
          ? box
          : keepInBand(box, {
              top: headerBottomRef.current,
              bottom: floor(box, view.height),
            }),
        true
      );
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', markDirty);
    };
  }, [target, expectTarget, dim, ring, bottomBar]);

  const fade: React.CSSProperties = {
    opacity: placed ? 1 : 0,
    transition: 'opacity 200ms ease-out',
    pointerEvents: 'none',
  };

  return (
    <>
      {/* Its place, look and opacity are set as it is measured, not here:
          these only hold until then. */}
      <div
        ref={holeRef}
        aria-hidden
        data-tutorial-spotlight=""
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
          zIndex,
        }}
      />
      {/* The raised header is above the dim, so it gets its own strip */}
      <div
        aria-hidden
        style={{
          ...fade,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: header.bottom,
          backgroundColor: dim,
          zIndex: header.zIndex,
        }}
      />
    </>
  );
};
