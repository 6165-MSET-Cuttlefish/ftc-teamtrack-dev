/**
 * What the two lifetime pages (Charts and Compare) share: the sessions they
 * analyse, and how a session, a date or a number is written on them.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth, useTeam } from '@/contexts';
import { calculateScore, toDate } from '@/lib';
import {
  getPendingDeleteIds,
  subscribePendingDeletes,
} from '@/lib/pendingSessionDeletes';
import type { Match, ScoreBreakdown, Session } from '@/types';
import { inSessionScope, SESSION_SCOPES } from './sessionList';
import type { SessionScope } from './sessionList';
import { useSessionList } from './useSessionList';
import type { SessionList } from './useSessionList';

/**
 * The sessions the signed-in user (or their team, or this browser's guest)
 * has, newest first: the newest page to begin with (the same one the
 * Sessions page opens on), and older ones as `loadOlder` and `loadAll`
 * read them. Sessions deleted but still inside their undo window are left
 * out, and come back if the delete is undone.
 */
export const useLifetimeSessions = (): Pick<
  SessionList,
  | 'sessions'
  | 'loading'
  | 'hasMore'
  | 'loadingOlder'
  | 'olderFailed'
  | 'completeAfter'
  | 'loadOlder'
  | 'loadAll'
> => {
  const list = useSessionList();
  const hiddenIds = useSyncExternalStore(
    subscribePendingDeletes,
    getPendingDeleteIds
  );

  const loaded = list.sessions;
  const sessions = useMemo(
    () => loaded.filter(s => !hiddenIds.has(s.id)),
    [loaded, hiddenIds]
  );

  return {
    sessions,
    loading: list.loading,
    hasMore: list.hasMore,
    loadingOlder: list.loadingOlder,
    olderFailed: list.olderFailed,
    completeAfter: list.completeAfter,
    loadOlder: list.loadOlder,
    loadAll: list.loadAll,
  };
};

/**
 * In a team the list is the team's sessions plus the user's own unshared
 * ones. This narrows it to either half and says in words what is on screen.
 * Outside a team there is one list, so no choices and no label. `complete`
 * says the list holds every session; until it does, the choices carry no
 * counts, which would only count the sessions read so far.
 */
export const useSessionScope = (
  sessions: Session[],
  complete = true
): {
  scope: SessionScope;
  setScope: (scope: SessionScope) => void;
  /** Whether a session belongs to the chosen scope */
  inScope: (session: Session) => boolean;
  /** The choices with how many sessions each holds; empty outside a team */
  choices: Array<{ value: SessionScope; label: string; count?: number }>;
  /** 'shared with <team>' and the like; null outside a team */
  scopeLabel: string | null;
} => {
  const { user, isGuest } = useAuth();
  const { team } = useTeam();
  const [picked, setScope] = useState<SessionScope>('all');

  const uid = user?.uid;
  const teamId = isGuest ? undefined : team?.id;
  const teamName = team?.name;
  // Leaving the team takes the choice away with it.
  const scope = teamId ? picked : 'all';

  // The same rule and the same All / Team / Mine as the Sessions page.
  const inScope = useCallback(
    (session: Session): boolean =>
      inSessionScope(session, scope, { teamId, uid }),
    [scope, teamId, uid]
  );

  const choices = useMemo(
    () =>
      teamId
        ? SESSION_SCOPES.map(({ value, label }) => ({
            value,
            label,
            count: complete
              ? sessions.filter(session =>
                  inSessionScope(session, value, { teamId, uid })
                ).length
              : undefined,
          }))
        : [],
    [sessions, complete, teamId, uid]
  );

  const scopeLabel = !teamId
    ? null
    : scope === 'team'
      ? `shared with ${teamName}`
      : scope === 'mine'
        ? 'recorded by you'
        : `${teamName} + your own`;

  return { scope, setScope, inScope, choices, scopeLabel };
};

/** Sort comparator: oldest session first. */
export const byDateAscending = (a: Session, b: Session): number =>
  toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime();

/** The name a session is listed under. */
export const sessionTitle = (session: Session): string =>
  session.sessionName || 'Unnamed';

/** The order match types are offered in, on Charts and on Compare. */
export const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

/** The type a match was run as; one saved without its own has its session's. */
export const matchTypeOf = (match: Match, session: Session): string =>
  match.matchType || session.matchType || 'Full Game';

/**
 * A session cut down to its matches of one type, so an Autonomous run is
 * never averaged in with full games; null when it has none of that type.
 * The copy is new, so the session it came from is never changed.
 */
export const ofMatchType = (session: Session, type: string): Session | null => {
  const matches = session.matches.filter(m => matchTypeOf(m, session) === type);
  return matches.length > 0 ? { ...session, matches, matchType: type } : null;
};

/** Fouls are only recorded against an opponent, so only in a Scrim. */
export const isScrim = (session: Session): boolean =>
  session.sessionType === 'Scrim';

/**
 * A match's score components. A match saved without its own type is scored
 * as its session's type, the same way `matchScore` does it.
 */
export const matchBreakdown = (
  match: Match,
  fallbackMatchType?: string
): ScoreBreakdown =>
  calculateScore(
    match.matchType || !fallbackMatchType
      ? match
      : { ...match, matchType: fallbackMatchType }
  );

/**
 * The day a session was recorded, without the time: 'Sep 25'. What a chart's
 * axis shows; its tooltip names the session in full (`sessionDateLabels`).
 */
export const sessionDay = (session: Session): string => {
  const date = toDate(session.createdAt);
  if (!session.createdAt || isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * A short date for each session, by session id: 'Sep 25'. Sessions that
 * share their day with another one in the list also get the time
 * ('Sep 25, 3:00 PM'), so no two points of a chart read the same.
 */
export const sessionDateLabels = (sessions: Session[]): Map<string, string> => {
  const perDay = new Map<string, number>();
  for (const session of sessions) {
    const day = sessionDay(session);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return new Map(
    sessions.map(session => {
      const day = sessionDay(session);
      if ((perDay.get(day) ?? 0) < 2 || !session.createdAt) {
        return [session.id, day];
      }
      const time = toDate(session.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return [session.id, `${day}, ${time}`];
    })
  );
};

/** A count with its noun: '1 match', '3 matches'. */
export const plural = (
  count: number,
  noun: string,
  pluralNoun = `${noun}s`
): string => `${count} ${count === 1 ? noun : pluralNoun}`;

/** A number as shown: whole numbers as they are, the rest to one decimal. */
export const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** Mean of a list, or null when there is nothing to average. */
export const mean = (values: number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : null;
