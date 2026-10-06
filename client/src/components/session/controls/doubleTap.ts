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
 *
 * A press on a toast's own buttons (Undo, or its close button) is absorbed
 * without being asked: it takes the toast away, and on a phone the toast
 * sat over the header, whose buttons are then under the finger.
 */

/** Two presses this close together, in time and on screen, are one double tap */
const DOUBLE_TAP_MS = 600;
const DOUBLE_TAP_SLOP_PX = 40;

/** Buttons inside a toast (Sonner marks each toast with this attribute) */
const TOAST_BUTTON = '[data-sonner-toast] button';

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

const isRepeat = (e: MouseEvent) =>
  absorbed !== null &&
  performance.now() - absorbed.at < DOUBLE_TAP_MS &&
  Math.hypot(e.clientX - absorbed.x, e.clientY - absorbed.y) <
    DOUBLE_TAP_SLOP_PX;

const ignore = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
};

// The repeat is ignored from the moment it starts, not only its click: the
// header's menus open as the finger goes down.
const onPointerDown = (e: PointerEvent) => {
  if (isRepeat(e)) ignore(e);
};

const onClick = (e: MouseEvent) => {
  // Enter, Space and scripted clicks have no position, and are never a
  // second tap.
  if (e.detail === 0) {
    lastTap = null;
    return;
  }
  if (isRepeat(e)) {
    ignore(e);
    return;
  }
  lastTap = { x: e.clientX, y: e.clientY, at: performance.now() };
  if (e.target instanceof Element && e.target.closest(TOAST_BUTTON)) {
    absorbed = lastTap;
  }
};

/** Follow presses on the page until the returned function is called. */
export const watchTaps = (): (() => void) => {
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onClick, true);
    lastTap = null;
    absorbed = null;
  };
};

/** Ignore a second press on the spot of the one being handled now. */
export const absorbDoubleTap = () => {
  absorbed = lastTap;
};
