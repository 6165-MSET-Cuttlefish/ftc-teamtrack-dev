import type { Session } from '@/types';
import { toDate } from './utils';

/**
 * Filtering and sorting for the sessions list.
 *
 * Kept out of the page component so the rules are pure and testable — the list
 * page is ~900 lines and the ordering logic is easy to get subtly wrong
 * (mutating state with .sort(), unstable ties, archived leaking into the
 * default view).
 */

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

/** A session's best match score; 0 when it has no matches. */
export const bestScore = (session: Session): number =>
  (session.matches ?? []).reduce(
    (max, m) => Math.max(max, m.finalScore || 0),
    0
  );

const byName = (a: Session, b: Session) =>
  (a.sessionName || '').localeCompare(b.sessionName || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });

const byDate = (a: Session, b: Session) =>
  toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime();

export const sessionComparators: Record<
  SortOption,
  (a: Session, b: Session) => number
> = {
  'date-desc': (a, b) => byDate(b, a),
  'date-asc': byDate,
  'name-asc': byName,
  'name-desc': (a, b) => byName(b, a),
  // Ties fall back to newest-first so equal scores keep a stable, sensible order.
  'score-desc': (a, b) => bestScore(b) - bestScore(a) || byDate(b, a),
  'score-asc': (a, b) => bestScore(a) - bestScore(b) || byDate(b, a),
  'matches-desc': (a, b) =>
    (b.matches?.length ?? 0) - (a.matches?.length ?? 0) || byDate(b, a),
};

export interface SessionListOptions {
  searchTerm: string;
  /** 'all', or a match type to filter to (compared case-insensitively). */
  matchType: string;
  sortBy: SortOption;
  /** true shows only archived sessions; false shows only active ones. */
  showArchived: boolean;
}

/**
 * Apply the archive view, search, match-type filter and sort.
 * Returns a new array — never mutates the input, since it's React state.
 */
export const filterAndSortSessions = (
  sessions: Session[],
  { searchTerm, matchType, sortBy, showArchived }: SessionListOptions
): Session[] => {
  // `archived` is optional, so sessions predating the field read as active.
  let out = sessions.filter(session =>
    showArchived ? session.archived === true : session.archived !== true
  );

  const term = searchTerm.trim().toLowerCase();
  if (term) {
    out = out.filter(
      session =>
        session.sessionName?.toLowerCase().includes(term) ||
        session.matchType?.toLowerCase().includes(term)
    );
  }

  if (matchType !== 'all') {
    out = out.filter(
      session => session.matchType?.toLowerCase() === matchType.toLowerCase()
    );
  }

  return [...out].sort(sessionComparators[sortBy]);
};
