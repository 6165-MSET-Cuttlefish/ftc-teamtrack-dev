/**
 * Session deletes that are still inside their undo window.
 *
 * Deleting a session hides it at once and only removes it for real when the
 * window closes. The waiting deletes are held here, at module scope, rather
 * than in the page that started them, so that:
 *
 * - Undo keeps working from whichever page the toast is still showing on;
 * - leaving the page, closing the tab or reloading finishes the delete
 *   instead of quietly cancelling it;
 * - every list (Sessions, Charts, Compare) can leave out the same sessions.
 *
 * The app can be open in more than one window. The window that made a
 * delete owns its Undo; the others read the stored list, hide the same
 * session, and only finish the delete themselves if the owner never does.
 *
 * Import this module by its path, not through `@/lib`: it depends on the
 * Firestore service, which itself imports `@/lib`.
 */

import { toast } from 'sonner';
import type { Session } from '@/types';
import { STORAGE_KEYS, UI_TIMING } from '@/constants';
import { firebaseService } from '@/services';
import { getFirebase } from './firebase';
import {
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from './guestSessions';
import { logger } from './logger';
import { formatDate } from './utils';

/** What is remembered across a reload for one waiting delete. */
interface StoredDelete {
  id: string;
  name: string;
  /** Account the delete was made from; null for a guest's session */
  uid: string | null;
  /**
   * When the undo window closes, in ms since the epoch. 0 once the delete
   * has started (or when it was never recorded): there is no Undo to wait
   * for.
   */
  expiresAt: number;
  /**
   * Only on the last write before the entry is dropped: tells the other
   * windows the session is gone for good rather than brought back.
   */
  deleted?: true;
}

interface PendingDelete extends StoredDelete {
  timer: ReturnType<typeof setTimeout> | null;
  /** Set once the delete has started; settles when it has finished */
  running: Promise<void> | null;
  /** Whether this window made the delete, and so is the one offering Undo */
  owned: boolean;
}

/**
 * How long past the end of its undo window another window's delete is left
 * alone before this one finishes it. Covers the owner being a little late,
 * and a delete of its that is still on its way to the server.
 */
const ORPHAN_GRACE = 5000;

const pending = new Map<string, PendingDelete>();

/**
 * Deletes found in storage that belong to an account other than the one
 * signed in. They stay stored, untouched, until that account loads the app.
 */
const parked: StoredDelete[] = [];

/**
 * False once the list could not be stored. Storage then says nothing about
 * what other windows have done.
 */
let storageWorks = true;

/** Immutable copy of the waiting IDs; replaced whenever they change. */
let pendingIds: ReadonlySet<string> = new Set();

const changeListeners = new Set<() => void>();
const deletedListeners = new Set<(sessionId: string) => void>();

const toastId = (sessionId: string) => `session-delete-${sessionId}`;

const publish = (): void => {
  pendingIds = new Set(pending.keys());
  changeListeners.forEach(listener => listener());
};

/** Store the waiting deletes; `deletedId` is marked as deleted for good. */
const persist = (deletedId?: string): void => {
  const stored: StoredDelete[] = [
    ...[...pending.values()].map(({ id, name, uid, expiresAt }) => ({
      id,
      name,
      uid,
      expiresAt,
      ...(id === deletedId ? { deleted: true as const } : {}),
    })),
    ...parked,
  ];
  try {
    if (stored.length > 0) {
      localStorage.setItem(
        STORAGE_KEYS.PENDING_SESSION_DELETES,
        JSON.stringify(stored)
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SESSION_DELETES);
    }
    storageWorks = true;
  } catch (error) {
    storageWorks = false;
    // Without storage the delete still happens; it just can't be picked up
    // again if the page goes away first.
    logger.warn('Could not remember pending session deletes', {
      error: String(error),
    });
  }
};

const parseStored = (raw: string | null): StoredDelete[] => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> & { id: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { id?: unknown }).id === 'string' &&
          (entry as { id: string }).id !== ''
      )
      .map(entry => ({
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name : 'Untitled Session',
        uid: typeof entry.uid === 'string' ? entry.uid : null,
        expiresAt:
          typeof entry.expiresAt === 'number' &&
          Number.isFinite(entry.expiresAt)
            ? entry.expiresAt
            : 0,
        ...(entry.deleted === true ? { deleted: true as const } : {}),
      }));
  } catch {
    return [];
  }
};

const readStored = (): StoredDelete[] => {
  try {
    return parseStored(
      localStorage.getItem(STORAGE_KEYS.PENDING_SESSION_DELETES)
    );
  } catch {
    return [];
  }
};

/**
 * Delete the session for real. A guest session is removed before this
 * returns, with nothing awaited on the way, so it is safe to call while the
 * page is being torn down.
 */
const run = async (entry: PendingDelete): Promise<void> => {
  let deleted = false;
  try {
    if (isGuestSessionId(entry.id)) {
      writeGuestSessions(readGuestSessions().filter(s => s.id !== entry.id));
    } else {
      // Stored as started first, so a reload picks the delete straight back
      // up and no other window offers to undo it.
      persist();
      await firebaseService.deleteSession(entry.id);
    }
    deleted = true;
  } catch (error) {
    logger.error('Error deleting session', error);
    toast.error(`Failed to delete "${entry.name}"`);
  } finally {
    // Other windows drop the session from their lists on this write, and
    // stop hiding it on the next.
    if (deleted) persist(entry.id);
    pending.delete(entry.id);
    persist();
    // Lists drop the session before it stops being hidden, in one update.
    if (deleted) deletedListeners.forEach(listener => listener(entry.id));
    publish();
  }
};

/** Close one delete's undo window now. Resolves when the delete settles. */
const commit = (sessionId: string): Promise<void> => {
  const entry = pending.get(sessionId);
  if (!entry) return Promise.resolve();
  if (entry.running) return entry.running;

  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  entry.expiresAt = 0;
  // The toast's Undo can't do anything any more.
  toast.dismiss(toastId(sessionId));
  entry.running = run(entry);
  return entry.running;
};

/**
 * Hide a session whose delete another window made, or a page that has gone
 * away left unfinished. Whoever made it may still be offering Undo, so it
 * is only finished here if it is still stored once that window has had its
 * chance.
 */
const adopt = (stored: StoredDelete): void => {
  const untilExpiry = Math.min(
    Math.max(stored.expiresAt - Date.now(), 0),
    UI_TIMING.UNDO_WINDOW
  );
  const previous = pending.get(stored.id);
  if (previous?.timer) clearTimeout(previous.timer);
  pending.set(stored.id, {
    id: stored.id,
    name: stored.name,
    uid: stored.uid,
    expiresAt: stored.expiresAt,
    owned: false,
    running: null,
    timer: setTimeout(() => {
      syncWithStorage();
      void commit(stored.id);
    }, untilExpiry + ORPHAN_GRACE),
  });
};

/**
 * Bring this window in line with the list as another window stored it:
 * hide the deletes made there, and let go of the ones settled there.
 */
const reconcile = (stored: StoredDelete[]): void => {
  const theirs = new Map(stored.map(entry => [entry.id, entry]));
  let changed = false;

  // Lists drop a deleted session before it stops being hidden.
  for (const entry of stored) {
    if (entry.deleted) deletedListeners.forEach(listener => listener(entry.id));
  }

  for (const entry of [...pending.values()]) {
    if (entry.running) continue;
    const other = theirs.get(entry.id);
    if (!other || other.deleted) {
      // Settled elsewhere: brought back, or deleted for good.
      if (entry.timer) clearTimeout(entry.timer);
      pending.delete(entry.id);
      toast.dismiss(toastId(entry.id));
      changed = true;
    } else if (other.expiresAt === 0 && entry.expiresAt !== 0) {
      // Another window has started the delete: nothing is left to undo.
      toast.dismiss(toastId(entry.id));
      adopt(other);
    }
  }

  for (const entry of stored) {
    if (entry.deleted || pending.has(entry.id)) continue;
    if (parked.some(other => other.id === entry.id)) continue;
    adopt(entry);
    changed = true;
  }

  if (changed) publish();
};

/** Catch up on anything another window stored that hasn't reached here yet. */
const syncWithStorage = (): void => {
  if (storageWorks) reconcile(readStored());
};

/**
 * IDs of the sessions that are deleted but can still be brought back. Lists
 * leave these out. The same set object is returned until it changes.
 */
export const getPendingDeleteIds = (): ReadonlySet<string> => pendingIds;

/** Be told whenever `getPendingDeleteIds` changes. Returns an unsubscribe. */
export const subscribePendingDeletes = (listener: () => void): (() => void) => {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
};

/**
 * Be told when a session has been deleted for good, just before its ID
 * leaves `getPendingDeleteIds`. Returns an unsubscribe.
 */
export const onSessionDeleted = (
  listener: (sessionId: string) => void
): (() => void) => {
  deletedListeners.add(listener);
  return () => {
    deletedListeners.delete(listener);
  };
};

/**
 * Bring a session back while its undo window is open. Returns false when
 * there is nothing to undo: the window has closed, or it was never deleted.
 */
export const undoSessionDelete = (sessionId: string): boolean => {
  // Another window may have finished the delete a moment ago.
  if (pending.has(sessionId)) syncWithStorage();
  const entry = pending.get(sessionId);
  if (!entry || entry.running || entry.expiresAt === 0) return false;

  if (entry.timer) clearTimeout(entry.timer);
  pending.delete(sessionId);
  persist();
  publish();
  toast.dismiss(toastId(sessionId));
  return true;
};

/**
 * Hide a session now and delete it once the undo window has passed, with a
 * toast that offers Undo until then. `uid` is the signed-in account, or null
 * for a guest.
 */
export const scheduleSessionDelete = (
  session: Pick<Session, 'id' | 'sessionName' | 'createdAt'>,
  uid: string | null
): void => {
  if (pending.has(session.id)) return;
  // What is stored next must not leave out another window's deletes.
  syncWithStorage();

  const name = session.sessionName || 'Untitled Session';
  pending.set(session.id, {
    id: session.id,
    name,
    uid,
    expiresAt: Date.now() + UI_TIMING.UNDO_WINDOW,
    owned: true,
    timer: setTimeout(() => void commit(session.id), UI_TIMING.UNDO_WINDOW),
    running: null,
  });
  persist();
  publish();

  toast.success(`Deleted "${name}"`, {
    id: toastId(session.id),
    description: formatDate(session.createdAt),
    duration: UI_TIMING.UNDO_WINDOW,
    action: {
      label: 'Undo',
      onClick: () => {
        if (undoSessionDelete(session.id)) toast.success(`Restored "${name}"`);
      },
    },
  });
};

/**
 * Finish every waiting delete now, closing its undo window — including the
 * ones made in other windows, which are signed out along with this one.
 * Resolves once they have all settled; a delete that fails reports itself
 * and never rejects this. Call it before signing out — a signed-in user's
 * sessions can't be deleted once they are signed out.
 */
export const flushPendingDeletes = async (): Promise<void> => {
  await Promise.all([...pending.keys()].map(commit));
};

/**
 * Finish the deletes this window made, because it is going away. Another
 * window's deletes are left to that window, which may still undo them.
 */
const flushOwnDeletes = (): void => {
  for (const entry of [...pending.values()]) {
    if (entry.owned) void commit(entry.id);
  }
};

/**
 * Pick up the signed-in user's deletes that a previous page load left
 * unfinished, once Firebase knows who is signed in.
 */
const resumeForSignedInUser = async (
  entries: StoredDelete[]
): Promise<void> => {
  let uid: string | null = null;
  try {
    const firebase = await getFirebase();
    await firebase?.auth.authStateReady();
    uid = firebase?.auth.currentUser?.uid ?? null;
  } catch (error) {
    logger.warn('Could not resume pending session deletes', {
      error: String(error),
    });
  }

  for (const entry of entries) {
    // Settled by the window that made it while Firebase was starting up.
    const waiting = pending.get(entry.id);
    if (!waiting || waiting.running) continue;
    if (uid === null || entry.uid !== uid) {
      // Not this account's to delete, or to hide. Kept for the account it
      // belongs to.
      if (waiting.timer) clearTimeout(waiting.timer);
      pending.delete(entry.id);
      parked.push(entry);
    } else if (waiting.expiresAt <= Date.now()) {
      void commit(entry.id);
    } else {
      // Still inside its undo window, so the window that made it may be
      // open and offering Undo.
      adopt(waiting);
    }
  }
  persist();
  publish();
};

/**
 * Deletes that are stored when the app loads. One whose undo window has
 * closed was left by a page that went away: the toast said "Deleted", so it
 * is finished rather than dropped. One still inside its window may belong
 * to another window that is open and offering Undo, so it is only hidden.
 */
const resume = (): void => {
  const stored = readStored().filter(entry => !entry.deleted);
  if (stored.length === 0) return;

  const now = Date.now();
  const signedIn: StoredDelete[] = [];
  for (const entry of stored) {
    if (!isGuestSessionId(entry.id)) {
      // Hidden until Firebase says whose it is.
      pending.set(entry.id, {
        ...entry,
        owned: false,
        timer: null,
        running: null,
      });
      signedIn.push(entry);
    } else if (entry.expiresAt > now) {
      adopt(entry);
    } else {
      // Guest sessions live in this browser, so they can go straight away —
      // before any list has read them.
      pending.set(entry.id, {
        ...entry,
        owned: false,
        timer: null,
        running: null,
      });
      void commit(entry.id);
    }
  }
  publish();

  if (signedIn.length > 0) void resumeForSignedInUser(signedIn);
};

if (typeof window !== 'undefined') {
  resume();

  // Deletes made, undone or finished in another window.
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEYS.PENDING_SESSION_DELETES) {
      reconcile(parseStored(event.newValue));
    } else if (event.key === null) {
      // Storage was cleared as a whole.
      reconcile(readStored());
    }
  });

  // A page that is going away can't keep its timers. `visibilitychange` is
  // the last event a phone reliably delivers; `pagehide` covers the rest.
  window.addEventListener('pagehide', flushOwnDeletes);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOwnDeletes();
  });
}
