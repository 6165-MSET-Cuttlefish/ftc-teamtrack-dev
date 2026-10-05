import { STORAGE_KEYS } from '@/constants';

/*
 * Whether the tutorial has been seen, kept apart from the tutorial itself:
 * the scoring page reads it to decide whether to fetch the tutorial's code
 * at all (it is only needed for a first run or a replay).
 */

/** localStorage, for a browser that may refuse it. */
export const readFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

export const writeFlag = (key: string): void => {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* storage unavailable: the tutorial is offered again next time */
  }
};

/** The "seen" key for an account, a guest, or (neither yet) the device */
export const tutorialSeenKey = (
  uid: string | null | undefined,
  guestId: string | null | undefined
): string => {
  if (uid) return `${STORAGE_KEYS.TUTORIAL_SEEN}-${uid}`;
  if (guestId) return `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`;
  return STORAGE_KEYS.TUTORIAL_SEEN;
};

/**
 * Seen under `key`, or on this device by anyone: someone who has been shown
 * around as a guest is not shown around again for signing up on the same
 * phone.
 */
export const hasSeenTutorial = (key: string): boolean =>
  readFlag(key) || readFlag(STORAGE_KEYS.TUTORIAL_SEEN);
