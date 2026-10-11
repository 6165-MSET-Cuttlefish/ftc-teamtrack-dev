/**
 * Moving the sessions a guest saved in this browser into an account.
 *
 * Signing up does it by itself: a new account can only be the guest's own.
 * Signing in to an existing one only offers it (Sessions' Import banner), as
 * the account may be someone else's on a shared laptop. Nothing is ever
 * dropped: a session leaves this browser only once the account has it.
 *
 * Import this module by its path, not through `@/lib`: it depends on the
 * Firestore service, which itself imports `@/lib`.
 */

import { toast } from 'sonner';
import type { CreateSessionData, Session } from '@/types';
import { firebaseService } from '@/services';
import { readGuestSessions, writeGuestSessions } from './guestSessions';
import { logger } from './logger';
import { getPendingDeleteIds } from './pendingSessionDeletes';
import { matchScore, sessionMatchType } from './scoring';
import { rememberSessionNames } from './sessionName';
import { toDate } from './utils';

/**
 * The guest sessions in this browser that an account can take in. One the
 * guest deleted but can still bring back is left out: it is on its way out,
 * and Undo puts it back on offer.
 */
export const importableGuestSessions = (): Session[] => {
  const pendingIds = getPendingDeleteIds();
  return readGuestSessions().filter(session => !pendingIds.has(session.id));
};

export interface GuestImportResult {
  imported: number;
  /** Still in this browser: they can be imported again later */
  failed: number;
}

/** The import under way, so a second one waits for it rather than doubling up */
let running: Promise<GuestImportResult> | null = null;
const listeners = new Set<() => void>();

const announce = () => listeners.forEach(listener => listener());

/** Whether this browser's guest sessions are being moved right now. */
export const isImportingGuestSessions = (): boolean => running !== null;

/**
 * Hear when an import starts or finishes (to show it, and to read the list
 * again once it is done). Returns the way to stop.
 */
export const subscribeGuestImport = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const importAll = async (
  uid: string,
  email: string
): Promise<GuestImportResult> => {
  // Oldest first, so the account's list ends up in the original order even
  // if a session's date can't be carried over.
  const toImport = importableGuestSessions().sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
  );

  let imported = 0;
  let failed = 0;
  const names: string[] = [];
  for (const guestSession of toImport) {
    const {
      id: guestId,
      createdAt: recordedAt,
      teamId: _teamId,
      ...rest
    } = guestSession;
    const data: CreateSessionData = {
      ...rest,
      userId: uid,
      userEmail: email,
      matchType: sessionMatchType(guestSession.matches, guestSession.matchType),
      matches: guestSession.matches.map(match => ({
        ...match,
        finalScore: matchScore(match, guestSession.matchType),
      })),
    };

    try {
      // Dated when it was recorded, not when it went up
      const recorded = recordedAt ? toDate(recordedAt) : null;
      const created = await firebaseService.createSession(
        data,
        undefined,
        recorded && !Number.isNaN(recorded.getTime()) ? recorded : undefined
      );
      if (!created?.id) throw new Error('Session was not saved');
      writeGuestSessions(readGuestSessions().filter(s => s.id !== guestId));
      imported++;
      if (guestSession.sessionName) names.push(guestSession.sessionName);
    } catch (error) {
      failed++;
      logger.error('Error importing guest session', error);
    }
  }

  // A new session is numbered past the ones the account now holds.
  if (names.length > 0) rememberSessionNames(uid, names, { replace: false });
  return { imported, failed };
};

/**
 * Copy this browser's guest sessions into the account `uid`, as personal
 * sessions, oldest first. Each one leaves this browser only once its upload
 * has succeeded, so a failure part-way loses nothing and a retry can't
 * duplicate what already went up. One import at a time: asking again while
 * one runs waits for it.
 */
export const importGuestSessions = (
  uid: string,
  email: string | null
): Promise<GuestImportResult> => {
  if (running) return running;
  running = importAll(uid, email || '').finally(() => {
    running = null;
    announce();
  });
  announce();
  return running;
};

/**
 * After signing up: move the guest's sessions into the new account and say
 * how it went. Nothing to move says nothing.
 */
export const moveGuestSessionsIntoNewAccount = async (
  uid: string,
  email: string | null
): Promise<void> => {
  if (importableGuestSessions().length === 0) return;
  const { imported, failed } = await importGuestSessions(uid, email);
  if (imported > 0) {
    toast.success(
      `Moved ${plural(imported, 'session')} from this browser into your account`
    );
  }
  if (failed > 0) {
    toast.error(
      `Couldn't move ${plural(failed, 'session')} into your account`,
      {
        description: `${failed === 1 ? "It's" : "They're"} still in this browser. Import ${failed === 1 ? 'it' : 'them'} from Sessions.`,
      }
    );
  }
};
