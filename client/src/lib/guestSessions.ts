/**
 * Guest sessions live only in this browser's localStorage, under
 * `STORAGE_KEYS.GUEST_SESSIONS`, newest first.
 *
 * The same key was used by last season's build, so the stored list can hold
 * older-season sessions too. Those are kept in storage but left out of
 * `readGuestSessions`, the same way older Firestore sessions are left out of
 * every list.
 */

import type { Session } from '@/types';
import { CURRENT_SEASON, STORAGE_KEYS } from '@/constants';
import { logger } from './logger';
import { normalizeSession, seasonOf } from './sessionNormalize';

type StoredEntry = Record<string, unknown>;

/** Guest session IDs are prefixed so they can't be mistaken for Firestore IDs. */
export const isGuestSessionId = (id: string): boolean =>
  id.startsWith('guest_');

/**
 * Move an unreadable stored value out of the way rather than overwrite it:
 * the next save would otherwise replace whatever could still be recovered.
 */
const setAsideCorrupt = (value: string): void => {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.GUEST_SESSIONS}.corrupt-${Date.now()}`,
      value
    );
    localStorage.removeItem(STORAGE_KEYS.GUEST_SESSIONS);
  } catch (error) {
    logger.error('Failed to back up unreadable guest sessions', error);
  }
};

/**
 * Every stored entry that is at least an object, exactly as stored except
 * that entries saved without a season tag get one (decided by shape) written
 * back, so a later edit can't change which season a session counts under.
 */
const readStoredEntries = (): StoredEntry[] => {
  let value: string | null;
  try {
    value = localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS);
  } catch (error) {
    logger.error('Failed to read guest sessions', error);
    return [];
  }
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed)) {
    logger.warn('Stored guest sessions are unreadable; set aside a backup');
    setAsideCorrupt(value);
    return [];
  }

  const entries = parsed.filter(
    (entry): entry is StoredEntry =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  );
  let tagged = false;
  for (const entry of entries) {
    if (typeof entry.season !== 'string' || !entry.season) {
      entry.season = seasonOf(entry);
      tagged = true;
    }
  }
  if (tagged) {
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_SESSIONS, JSON.stringify(parsed));
    } catch (error) {
      logger.error('Failed to tag guest sessions with their season', error);
    }
  }
  return entries;
};

const toSession = (entry: StoredEntry, index: number): Session =>
  normalizeSession(
    entry,
    typeof entry.id === 'string' && entry.id ? entry.id : `guest_${index + 1}`
  );

/** Every stored guest session, older seasons included. */
export const readAllGuestSessions = (): Session[] =>
  readStoredEntries().map(toSession);

/** This season's guest sessions — the ones the app lists and charts. */
export const readGuestSessions = (): Session[] =>
  readAllGuestSessions().filter(session => session.season === CURRENT_SEASON);

/**
 * Replace the stored list. Stored older-season sessions that `sessions`
 * doesn't mention are kept: callers build their list from
 * `readGuestSessions`, which never showed them those.
 */
export const writeGuestSessions = (sessions: Session[]): void => {
  const listed = new Set(sessions.map(session => session.id));
  const hidden = readStoredEntries().filter(
    entry =>
      entry.season !== CURRENT_SEASON &&
      !(typeof entry.id === 'string' && listed.has(entry.id))
  );
  localStorage.setItem(
    STORAGE_KEYS.GUEST_SESSIONS,
    JSON.stringify([...sessions, ...hidden])
  );
};
