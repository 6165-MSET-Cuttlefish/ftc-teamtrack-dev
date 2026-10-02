/**
 * Absorbing the second half of a double tap.
 *
 * Some presses on /active replace what is under the pointer: Complete
 * Session opens a dialog over itself, Save Session swaps that dialog for the
 * completed screen, Save Changes and Cancel close the match editor. The
 * second press of a double tap then lands on whatever appeared there.
 *
 * `absorbDoubleTap()`, called while the first press is being handled, makes
 * the page ignore a press that follows on the same spot. Only that spot, so
 * a deliberate press on anything else is never held up.
 */

/** Two presses this close together, in time and on screen, are one double tap */
const DOUBLE_TAP_MS = 600;
const DOUBLE_TAP_SLOP_PX = 40;

interface Tap {
  x: number;
  y: number;
  /** performance.now(), which a change to the device clock doesn't move */
  at: number;
}

/** The press being handled, if it came from a mouse or a finger */
let lastTap: Tap | null = null;
/** The press whose repeat is ignored */
let absorbed: Tap | null = null;

const onClick = (e: MouseEvent) => {
  // Enter, Space and scripted clicks have no position, and are never a
  // second tap.
  if (e.detail === 0) {
    lastTap = null;
    return;
  }
  const now = performance.now();
  if (
    absorbed &&
    now - absorbed.at < DOUBLE_TAP_MS &&
    Math.hypot(e.clientX - absorbed.x, e.clientY - absorbed.y) <
      DOUBLE_TAP_SLOP_PX
  ) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  lastTap = { x: e.clientX, y: e.clientY, at: now };
};

/** Follow presses on the page until the returned function is called. */
export const watchTaps = (): (() => void) => {
  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    lastTap = null;
    absorbed = null;
  };
};

/** Ignore a second press on the spot of the one being handled now. */
export const absorbDoubleTap = () => {
  absorbed = lastTap;
};
