/**
 * What the two lifetime pages (Charts and Compare) share: the sessions they
 * analyse, and how a session, a date or a number is written on them.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import {
  calculateScore,
  isAbortError,
  logger,
  readGuestSessions,
  toDate,
} from '@/lib';
import {
  getPendingDeleteIds,
  onSessionDeleted,
  subscribePendingDeletes,
} from '@/lib/pendingSessionDeletes';
import type { Match, ScoreBreakdown, Session } from '@/types';

/**
 * The sessions the signed-in user (or their team, or this browser's guest)
 * has, newest first. Sessions deleted but still inside their undo window are
 * left out, and come back if the delete is undone.
 */
export const useLifetimeSessions = (): {
  sessions: Session[];
  loading: boolean;
} => {
  const { user, isGuest } = useAuth();
  const { team } = useTeam();
  const [loaded, setLoaded] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const hiddenIds = useSyncExternalStore(
    subscribePendingDeletes,
    getPendingDeleteIds
  );

  const uid = user?.uid;
  const teamId = team?.id;

  useEffect(
    () =>
      onSessionDeleted(sessionId =>
        setLoaded(prev => prev.filter(s => s.id !== sessionId))
      ),
    []
  );

  useEffect(() => {
    // A guest's sessions live in this browser.
    if (isGuest) {
      setLoaded(readGuestSessions());
      setLoading(false);
      return;
    }
    if (!uid) return;

    let active = true;
    setLoading(true);
    (async () => {
      try {
        const fetched = teamId
          ? await firebaseService.getTeamSessions(teamId)
          : await firebaseService.getUserSessions(uid);
        if (active) setLoaded(fetched);
      } catch (error) {
        if (!active || isAbortError(error)) return;
        logger.error('Error loading sessions', error);
        toast.error('Failed to load sessions');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, isGuest, teamId]);

  const sessions = useMemo(
    () => loaded.filter(s => !hiddenIds.has(s.id)),
    [loaded, hiddenIds]
  );

  return { sessions, loading };
};

/** Sort comparator: oldest session first. */
export const byDateAscending = (a: Session, b: Session): number =>
  toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime();

/** The name a session is listed under. */
export const sessionTitle = (session: Session): string =>
  session.sessionName || 'Unnamed';

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

const dayOf = (session: Session): string => {
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
    const day = dayOf(session);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return new Map(
    sessions.map(session => {
      const day = dayOf(session);
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
