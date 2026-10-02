import type { KeyboardEvent } from 'react';

/**
 * Makes a held-down Enter count as one press.
 *
 * Enter presses a button on every key-down, auto-repeat included, and these
 * controls change in place: holding it on Complete Session would also submit
 * the dialog it opens, and holding it on Save Match would start the next
 * match. Only the first key-down of a press gets through.
 */
export const ignoreHeldEnter = (e: KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' && e.repeat) {
    e.preventDefault();
  }
};
