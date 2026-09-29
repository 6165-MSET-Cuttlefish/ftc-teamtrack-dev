/**
 * Guest sessions live only in this browser's localStorage, under
 * `STORAGE_KEYS.GUEST_SESSIONS`, newest first.
 */

import type { Session } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import { logger } from './logger';

/** Guest session IDs are prefixed so they can't be mistaken for Firestore IDs. */
export const isGuestSessionId = (id: string): boolean =>
  id.startsWith('guest_');

export const readGuestSessions = (): Session[] => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
    );
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch (error) {
    logger.error('Failed to read guest sessions', error);
    return [];
  }
};

export const writeGuestSessions = (sessions: Session[]): void => {
  localStorage.setItem(STORAGE_KEYS.GUEST_SESSIONS, JSON.stringify(sessions));
};
