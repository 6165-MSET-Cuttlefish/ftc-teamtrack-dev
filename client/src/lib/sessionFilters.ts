/**
 * Archive view and ordering for the sessions list.
 *
 * Kept out of the page so the rules stay pure: nothing here mutates the list
 * it is given (it is React state), ties always fall back to the same order,
 * and an archived session can't leak into the default view.
 */

import type { Session } from '@/types';
import { matchScore } from './scoring';
import { toDate } from './utils';

/** Sort options, in the order they're offered to the user. */
export type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'name-asc'
  | 'name-desc'
  | 'score-desc'
  | 'score-asc'
  | 'matches-desc';

export const SORT_LABELS: Record<SortOption, string> = {
  'date-desc': 'Newest first',
  'date-asc': 'Oldest first',
  'name-asc': 'Name (A–Z)',
  'name-desc': 'Name (Z–A)',
  'score-desc': 'Highest score',
  'score-asc': 'Lowest score',
  'matches-desc': 'Most matches',
};

export const DEFAULT_SORT: SortOption = 'date-desc';

/** The order an address names (`?sort=score-desc`); the default otherwise. */
export const sortFromParam = (param: string | null): SortOption =>
  (Object.keys(SORT_LABELS) as SortOption[]).find(option => option === param) ??
  DEFAULT_SORT;

/**
 * Whether a session has been archived by its author. Only a stored `true`
 * counts, so a session saved before the field existed reads as active. What
 * a list shows goes by `archivedFor`, which asks who is looking.
 */
export const isArchived = (session: Pick<Session, 'archived'>): boolean =>
  session.archived === true;

/**
 * A session's best match score — the figure on its card — or 0 with no
 * matches. Recomputed from each match's fields like every other score:
 * the cached `finalScore` can be stale.
 */
export const bestScore = (session: Session): number =>
  (session.matches ?? []).reduce(
    (max, match) => Math.max(max, matchScore(match, session.matchType)),
    0
  );

/** When a session was recorded, in ms; 0 when it has no readable date. */
const recordedAt = (session: Session): number => {
  if (!session.createdAt) return 0;
  const time = toDate(session.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** What a session is ordered by, worked out once per sort. */
interface SortKeys {
  session: Session;
  name: string;
  date: number;
  score: number;
  matches: number;
}

const byDate = (a: SortKeys, b: SortKeys) => a.date - b.date;

const byName = (a: SortKeys, b: SortKeys) =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

/** Ties fall back to newest first, so equal sessions keep a stable order. */
const COMPARATORS: Record<SortOption, (a: SortKeys, b: SortKeys) => number> = {
  'date-desc': (a, b) => byDate(b, a),
  'date-asc': byDate,
  'name-asc': (a, b) => byName(a, b) || byDate(b, a),
  'name-desc': (a, b) => byName(b, a) || byDate(b, a),
  'score-desc': (a, b) => b.score - a.score || byDate(b, a),
  'score-asc': (a, b) => a.score - b.score || byDate(b, a),
  'matches-desc': (a, b) => b.matches - a.matches || byDate(b, a),
};

/** A sorted copy of `sessions`; the list passed in is left as it was. */
export const sortSessions = (
  sessions: readonly Session[],
  sortBy: SortOption
): Session[] => {
  const byScore = sortBy === 'score-desc' || sortBy === 'score-asc';
  return sessions
    .map(
      (session): SortKeys => ({
        session,
        name: session.sessionName || '',
        date: recordedAt(session),
        // Scoring every match is the only costly key; skip it when unused.
        score: byScore ? bestScore(session) : 0,
        matches: session.matches?.length ?? 0,
      })
    )
    .sort(COMPARATORS[sortBy])
    .map(keys => keys.session);
};

/** Who is looking at a list of sessions. */
export interface ArchiveViewer {
  uid?: string;
  /** A guest's sessions are all their own: none carries their account. */
  isGuest?: boolean;
}

/**
 * Whether a session is archived for the person looking at it. Archiving is
 * the author's own tidying up: a teammate archiving a team session never
 * moves it out of anyone else's list (only the author can change it, so
 * nobody else could bring it back either).
 */
export const archivedFor = (
  session: Pick<Session, 'archived' | 'userId'>,
  viewer: ArchiveViewer
): boolean =>
  isArchived(session) &&
  (viewer.isGuest === true || (!!viewer.uid && session.userId === viewer.uid));

/**
 * The sessions one view of the list holds: the ones the viewer archived, or
 * the rest.
 */
export const inArchiveView = (
  sessions: readonly Session[],
  showArchived: boolean,
  viewer: ArchiveViewer
): Session[] =>
  sessions.filter(session => archivedFor(session, viewer) === showArchived);
