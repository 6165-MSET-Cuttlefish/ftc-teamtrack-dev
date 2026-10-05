/**
 * What the Sessions page lists and counts: which sessions pass its search,
 * match-type filter and team scope, and the numbers and wording that Quick
 * Stats, the cards and the export take from them.
 */

import { MIXED_MATCH_TYPE, matchScore, sessionMatchType, toDate } from '@/lib';
import type { Session } from '@/types';

/** Filter value that lets every match type through. */
export const ALL_MATCH_TYPES = 'all';

/** Match types offered by the filter, as the lower-case values it stores. */
export const MATCH_TYPE_FILTERS = [
  { value: 'full game', label: 'Full Game' },
  { value: 'autonomous', label: 'Autonomous' },
  { value: 'teleop', label: 'Teleop' },
  { value: MIXED_MATCH_TYPE.toLowerCase(), label: MIXED_MATCH_TYPE },
] as const;

/** Whose sessions someone in a team is looking at. */
export type SessionScope = 'all' | 'team' | 'mine';

export const SESSION_SCOPES: ReadonlyArray<{
  value: SessionScope;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'team', label: 'Team' },
  { value: 'mine', label: 'Mine' },
];

/** Everything that narrows the list. */
export interface SessionListFilters {
  /** Search text, as typed */
  searchTerm: string;
  /** A `MATCH_TYPE_FILTERS` value, or `ALL_MATCH_TYPES` */
  matchType: string;
  scope: SessionScope;
}

/** `2 sessions`, `1 match`. */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** The type one match of a session was run as, lower-cased. */
const matchTypeOf = (match: { matchType?: string }, session: Session): string =>
  (match.matchType || session.matchType || 'Full Game').toLowerCase();

/** The type each of a session's matches was run as, lower-cased. */
export const matchTypesOf = (session: Session): string[] =>
  (session.matches || []).map(match => matchTypeOf(match, session));

/** A session's own label: the type its matches share, or 'Mixed'. */
export const matchTypeLabel = (session: Session): string =>
  sessionMatchType(session.matches, session.matchType);

/** Every match score in a session, recomputed from the match's fields. */
export const scoresOf = (session: Session): number[] =>
  (session.matches || []).map(match => matchScore(match, session.matchType));

/** Whether anything is narrowing the list. */
export const hasActiveFilters = (filters: SessionListFilters): boolean =>
  filters.searchTerm.trim() !== '' ||
  filters.matchType !== ALL_MATCH_TYPES ||
  filters.scope !== 'all';

/**
 * Whether a session is in a scope: Team is what is filed under the viewer's
 * team, Mine what the viewer recorded. Sessions, Charts and Compare all
 * narrow by this one rule.
 */
export const inSessionScope = (
  session: Session,
  scope: SessionScope,
  viewer: { teamId?: string; uid?: string }
): boolean =>
  scope === 'team'
    ? session.teamId === viewer.teamId
    : scope === 'mine'
      ? session.userId === viewer.uid
      : true;

/**
 * The sessions the list shows. `viewer` says whose team and account the
 * Team and Mine scopes mean.
 */
export const filterSessions = (
  sessions: Session[],
  { searchTerm, matchType, scope }: SessionListFilters,
  viewer: { teamId?: string; uid?: string }
): Session[] => {
  let filtered = sessions.filter(session =>
    inSessionScope(session, scope, viewer)
  );

  const term = searchTerm.trim().toLowerCase();
  if (term) {
    filtered = filtered.filter(
      session =>
        session.sessionName?.toLowerCase().includes(term) ||
        matchTypeLabel(session).toLowerCase().includes(term) ||
        matchTypesOf(session).some(type => type.includes(term))
    );
  }

  if (matchType !== ALL_MATCH_TYPES) {
    // A session belongs under every type any of its matches was run as,
    // and under 'Mixed' when they weren't all the same.
    filtered = filtered.filter(
      session =>
        matchTypeLabel(session).toLowerCase() === matchType ||
        matchTypesOf(session).includes(matchType)
    );
  }

  return filtered;
};

/**
 * The label of the one match type a filter value names, e.g. `Autonomous`.
 * Undefined for every type and for 'Mixed', which count all of a session's
 * matches.
 */
export const oneMatchTypeLabel = (matchType: string): string | undefined =>
  matchType === MIXED_MATCH_TYPE.toLowerCase()
    ? undefined
    : MATCH_TYPE_FILTERS.find(f => f.value === matchType)?.label;

/**
 * The matches of a session that a match-type filter counts: under a filter
 * that names one type, only the matches run as that type, so a 30-second
 * Autonomous run inside a Mixed session doesn't drag a Teleop average down.
 */
const countedMatches = (session: Session, matchType: string) => {
  const matches = session.matches || [];
  return oneMatchTypeLabel(matchType)
    ? matches.filter(match => matchTypeOf(match, session) === matchType)
    : matches;
};

/**
 * A session with only the matches a match-type filter counts: the same
 * session under every type and 'Mixed', a copy when one type is named.
 */
export const withCountedMatches = (
  session: Session,
  matchType: string
): Session =>
  oneMatchTypeLabel(matchType)
    ? { ...session, matches: countedMatches(session, matchType) }
    : session;

/**
 * The shown sessions as the export writes them: each with the matches Quick
 * Stats counts, so under an Autonomous filter the file holds the Autonomous
 * matches and the two give the same match count.
 */
export const sessionsToExport = (
  sessions: Session[],
  matchType: string
): Session[] =>
  oneMatchTypeLabel(matchType)
    ? sessions.map(session => withCountedMatches(session, matchType))
    : sessions;

/** How many matches a list of sessions holds. */
export const matchCountOf = (sessions: Session[]): number =>
  sessions.reduce(
    (count, session) => count + (session.matches || []).length,
    0
  );

export interface QuickStats {
  sessionCount: number;
  matchCount: number;
  /** Null when no match was counted: nothing has an average or a best */
  averageScore: number | null;
  bestScore: number | null;
}

/**
 * Quick Stats over the sessions on screen, counting the matches a match-type
 * filter lets through (see `countedMatches`).
 */
export const quickStatsOf = (
  sessions: Session[],
  matchType: string
): QuickStats => {
  const scores = sessions.flatMap(session =>
    countedMatches(session, matchType).map(match =>
      matchScore(match, session.matchType)
    )
  );

  return {
    sessionCount: sessions.length,
    matchCount: scores.length,
    averageScore:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
  };
};

/**
 * What a number on the page is counted over, in words: `8 sessions`,
 * `2 Teleop sessions`, `3 of your sessions`, `1 team session matching “auto”`,
 * and under the Archived view `4 archived sessions`.
 */
export const scopeLabel = (
  count: number,
  { searchTerm, matchType, scope }: SessionListFilters,
  archived = false
): string => {
  const type = MATCH_TYPE_FILTERS.find(f => f.value === matchType)?.label;
  const words = [
    scope === 'mine' ? `${count} of your` : String(count),
    archived ? 'archived' : undefined,
    type,
    scope === 'team' ? 'team' : undefined,
    count === 1 && scope !== 'mine' ? 'session' : 'sessions',
  ].filter(Boolean);

  const term = searchTerm.trim();
  return `${words.join(' ')}${term ? ` matching “${term}”` : ''}`;
};

/** Words as they go in a URL or a file name: `full game` -> `full-game`. */
const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A match-type filter value as the address bar holds it (`full-game`). */
export const matchTypeParam = (matchType: string): string | null =>
  matchType === ALL_MATCH_TYPES ? null : slug(matchType);

/** The match-type filter an address names; every type for anything else. */
export const matchTypeFromParam = (param: string | null): string =>
  MATCH_TYPE_FILTERS.find(f => slug(f.value) === param)?.value ??
  ALL_MATCH_TYPES;

/** The scope an address names; All for anything else. */
export const scopeFromParam = (param: string | null): SessionScope =>
  SESSION_SCOPES.find(s => s.value === param)?.value ?? 'all';

/**
 * The name an export is saved under, before its date: `sessions-export`
 * for a whole view, and for a narrowed one what narrowed it
 * (`sessions-autonomous-export`, `sessions-mine-export`,
 * `archived-sessions-matching-auto-export`), so it never lands as a
 * "(1)" copy beside the full one.
 */
export const exportFileBase = (
  { searchTerm, matchType, scope }: SessionListFilters,
  archived: boolean,
  narrowed: boolean
): string => {
  const parts = [archived ? 'archived-sessions' : 'sessions'];
  if (narrowed) {
    if (scope !== 'all') parts.push(scope);
    const type = matchTypeParam(matchType);
    if (type) parts.push(type);
    // Short enough that csvFileName's 60 characters keep the '-export'
    const term = slug(searchTerm).slice(0, 10).replace(/-+$/, '');
    if (term) parts.push('matching', term);
  }
  return [...parts, 'export'].join('-');
};

/**
 * When a session was recorded, short enough for a card: `Sep 30, 4:10 PM`,
 * with the year once it isn't this one. Empty for a session with no date.
 */
export const sessionDateLabel = (createdAt: unknown): string => {
  if (!createdAt) return '';
  const date = toDate(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
};
