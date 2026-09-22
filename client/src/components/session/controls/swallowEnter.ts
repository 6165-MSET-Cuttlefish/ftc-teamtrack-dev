import type { KeyboardEvent } from 'react';

/**
 * Keeps Enter from re-triggering a match control.
 *
 * Scoring is driven from the keyboard during a match, so a stray Enter after
 * typing a count must not activate whichever button happens to be focused.
 */
export const swallowEnter = (e: KeyboardEvent<HTMLButtonElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
  }
};
