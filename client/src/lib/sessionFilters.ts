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

/**
 * Whether a session has been archived. Only a stored `true` counts, so a
 * session saved before the field existed reads as active.
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

/**
 * The sessions one view of the list holds: the archived ones, or the rest.
 */
export const inArchiveView = (
  sessions: readonly Session[],
  showArchived: boolean
): Session[] =>
  sessions.filter(session => isArchived(session) === showArchived);
