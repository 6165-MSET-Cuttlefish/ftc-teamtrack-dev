/**
 * Edits to the matches of a saved session, applied to what is stored now.
 *
 * Analysis holds a copy of the session that can be minutes old, and another
 * tab or device may have changed it since. Writing the page's whole array
 * back would silently undo those changes, so every add, update, delete and
 * undo is described as one operation on one match and applied to a fresh
 * read: inside a Firestore transaction for saved sessions, and to a re-read
 * of localStorage for guest ones.
 */

import type { Match } from '@/types';
import { isGuestSessionId, readGuestSessions, writeGuestSessions } from '@/lib';
import { firebaseService } from './firebaseService';

/** Limits enforced by firestore.rules (matches) and by Firestore itself (1 MiB) */
const MAX_MATCHES_PER_SESSION = 200;
const MAX_MATCHES_BYTES = 900 * 1024;

export type MatchEdit =
  /** Append a match; it is numbered one past the highest stored number */
  | { kind: 'add'; match: Omit<Match, 'matchNumber'> }
  | { kind: 'update'; matchId: string; changes: Partial<Match> }
  | { kind: 'delete'; matchId: string }
  /** Put a deleted match back where it was (the Undo of a delete) */
  | { kind: 'restore'; match: Match; index: number };

/** An edit refused for a reason worth showing the user as it is. */
export class MatchEditError extends Error {}

/** Number matches 1..n in list order, so a delete never leaves a gap. */
const renumber = (matches: Match[]): Match[] =>
  matches.map((match, index) =>
    match.matchNumber === index + 1
      ? match
      : { ...match, matchNumber: index + 1 }
  );

/**
 * The stored matches with one edit applied. Pure: Firestore may run it more
 * than once for a single edit.
 */
export const applyMatchEdit = (current: Match[], edit: MatchEdit): Match[] => {
  switch (edit.kind) {
    case 'add': {
      if (current.some(match => match.id === edit.match.id)) return current;
      const highest = current.reduce(
        (max, match) => Math.max(max, match.matchNumber || 0),
        0
      );
      return [...current, { ...edit.match, matchNumber: highest + 1 }];
    }
    case 'update': {
      if (!current.some(match => match.id === edit.matchId)) {
        throw new MatchEditError(
          'This match was deleted somewhere else, so there is nothing to update.'
        );
      }
      return current.map(match =>
        match.id === edit.matchId
          ? {
              ...match,
              ...edit.changes,
              id: match.id,
              matchNumber: match.matchNumber,
            }
          : match
      );
    }
    case 'delete':
      return renumber(current.filter(match => match.id !== edit.matchId));
    case 'restore': {
      if (current.some(match => match.id === edit.match.id)) return current;
      const matches = [...current];
      matches.splice(Math.min(edit.index, matches.length), 0, edit.match);
      return renumber(matches);
    }
  }
};

/** Refuse a list Firestore would reject, with a message that says why. */
const assertFits = (matches: Match[]): void => {
  if (matches.length > MAX_MATCHES_PER_SESSION) {
    throw new MatchEditError(
      `A session can hold up to ${MAX_MATCHES_PER_SESSION} matches. Delete one before adding another.`
    );
  }
  const bytes = new Blob([JSON.stringify(matches)]).size;
  if (bytes > MAX_MATCHES_BYTES) {
    throw new MatchEditError(
      `This session is too large to save (${Math.round(bytes / 1024)} KB of about ${Math.round(MAX_MATCHES_BYTES / 1024)} KB). Delete some matches first.`
    );
  }
};

/** What an edit wrote. */
export interface MatchEditResult {
  /** The session's matches as they are stored now */
  matches: Match[];
  /**
   * For a delete: the match exactly as it was stored and where it sat, which
   * is what an Undo has to put back. Absent if it was already gone.
   */
  removed?: { match: Match; index: number };
}

/**
 * Apply one edit to a session's stored matches. Throws, writing nothing,
 * when the session can't be read (missing, denied, offline) or the edit is
 * refused.
 */
export const saveMatchEdit = async (
  sessionId: string,
  edit: MatchEdit
): Promise<MatchEditResult> => {
  let removed: MatchEditResult['removed'];
  const apply = (current: Match[]): Match[] => {
    if (edit.kind === 'delete') {
      const index = current.findIndex(match => match.id === edit.matchId);
      removed = index === -1 ? undefined : { match: current[index], index };
    }
    return applyMatchEdit(current, edit);
  };

  if (isGuestSessionId(sessionId)) {
    const sessions = readGuestSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new MatchEditError(
        'This session is no longer saved in this browser.'
      );
    }
    const matches = apply(session.matches);
    writeGuestSessions(
      sessions.map(s => (s.id === sessionId ? { ...s, matches } : s))
    );
    return { matches, removed };
  }

  const matches = await firebaseService.mutateSessionMatches(
    sessionId,
    current => {
      const next = apply(current);
      // A delete only ever shrinks the session, so it is never refused.
      if (edit.kind !== 'delete') assertFits(next);
      return next;
    }
  );
  return { matches, removed };
};

/** A fresh ID for a match added after the session was recorded. */
export const newMatchId = (): string =>
  `match_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

/** Firestore error code ('permission-denied', 'unavailable', ...), or '' */
const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code).replace(/^firestore\//, '')
    : '';

/**
 * Why a match edit failed, in words for a toast description, or undefined
 * when there is nothing more specific to say than "it failed".
 */
export const matchEditFailure = (error: unknown): string | undefined => {
  if (error instanceof MatchEditError) return error.message;
  switch (errorCode(error)) {
    case 'permission-denied':
    case 'unauthenticated':
      return "You don't have permission to change this session.";
    case 'unavailable':
    case 'deadline-exceeded':
      return "Couldn't reach the server, so nothing was changed. Check your connection and try again.";
    case 'invalid-argument':
      return 'The server rejected this session as too large or malformed.';
    case 'resource-exhausted':
      return 'The server is over its usage limit right now. Try again later.';
  }
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') {
      return "This browser's storage is full, so the change wasn't saved.";
    }
    if (error.message === 'Session not found') {
      return 'This session no longer exists.';
    }
  }
  return undefined;
};
