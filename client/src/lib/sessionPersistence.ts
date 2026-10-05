/**
 * Session Persistence Utilities
 * Handles persistent storage of active session data in localStorage
 * Allows timers and state to continue running in the background
 */

import type { SessionFormData, SessionTimerState, MatchPhase } from '@/types';
import type { SessionClockState } from '@/types/storage';
import { GAME_TIMING, STORAGE_KEYS } from '@/constants';
import { logger } from './logger';
import { generateId } from './utils';
import { htmlToText } from './htmlText';
import { isDefaultSessionName } from './sessionName';
import {
  advanceClock,
  boundClock,
  clocksEqual,
  idleClock,
  idleMatchClock,
  matchDurationSeconds,
  matchSecondsLeft,
  pickupSecondsLeft,
  resyncClock,
  sessionSeconds,
  type ClockEnv,
} from './matchClock';
import { toast } from 'sonner';

/** Current schema version for stored session data. Bump when SessionFormData shape changes. */
const STORAGE_SCHEMA_VERSION = 2;

/**
 * Revision marker for the stored in-progress session: `{ rev, writerId, savedAt }`.
 * Written last on every save and removed last on every clear, so a tab that
 * sees this key change can read the other keys knowing they are complete.
 */
export const SESSION_REV_KEY = 'teamtrack-session-rev';

/**
 * Epoch ms at which a tab showing the stored session was last known to be
 * open. Clocks are only written when the session changes, so on the next
 * load this is what tells a page closed a moment ago from one closed since
 * yesterday — and tells a tab that has just woken up whether another one
 * kept the session going meanwhile.
 */
const SESSION_SEEN_KEY = 'teamtrack-session-seen-at';

/** Fired in this tab when code outside SessionProvider clears the stored session */
export const SESSION_STORAGE_CLEARED_EVENT =
  'teamtrack-session-storage-cleared';

/** Identifies this tab as the author of the revisions it writes */
const WRITER_ID = generateId();

const MATCH_PHASES: MatchPhase[] = [
  'auton',
  'controller_pickup',
  'teleop',
  'ended',
];

/** Check if the user has ever completed a session */
export const hasCompletedASession = (): boolean =>
  localStorage.getItem(STORAGE_KEYS.HAS_COMPLETED_SESSION) === 'true';

/** Mark that the user has completed at least one session */
export const markSessionCompleted = (): void =>
  localStorage.setItem(STORAGE_KEYS.HAS_COMPLETED_SESSION, 'true');

export type { SessionFormData, SessionTimerState } from '@/types';

/**
 * Whether a session that has not been started holds something the user put
 * there: notes with text in them, or settings changed from a new session's
 * (a name they typed, Scrim, a match type other than Full Game). Such a
 * draft is kept across a reload, but it is not a running session.
 */
export const hasDraftContent = (
  data: Pick<
    Partial<SessionFormData>,
    'notes' | 'sessionName' | 'sessionType' | 'matchType'
  >
): boolean => {
  const name = data.sessionName?.trim() ?? '';
  return (
    htmlToText(data.notes ?? '') !== '' ||
    (name !== '' && !isDefaultSessionName(name)) ||
    (data.sessionType ?? 'Practice') !== 'Practice' ||
    (data.matchType ?? 'Full Game') !== 'Full Game'
  );
};

/**
 * Whether an in-progress session is worth keeping in storage, so that a
 * reload comes back to it: one that was started, has saved matches, or is a
 * draft with something in it (see `hasDraftContent`). The one test for
 * writing the session and for reading it back.
 */
export const isWorthStoring = (
  data: Pick<
    Partial<SessionFormData>,
    'notes' | 'sessionName' | 'sessionType' | 'matchType' | 'matches'
  >,
  hasStarted: boolean
): boolean =>
  hasStarted || (data.matches?.length ?? 0) > 0 || hasDraftContent(data);

/** An in-progress session read back from localStorage, clocks brought up to date */
export interface StoredSession {
  sessionData: SessionFormData;
  timerState: SessionTimerState;
  clock: SessionClockState;
  /**
   * The stored anchors could not be used as they were (time away left out of
   * the session clock, the device clock set back, values out of range), so
   * `clock` should be stored again.
   */
  clockCorrected: boolean;
}

/**
 * The stored session's revision marker, or null when nothing is stored.
 * Two reads returning the same string mean nobody has written in between.
 */
export const readSessionToken = (): string | null => {
  try {
    return localStorage.getItem(SESSION_REV_KEY);
  } catch {
    return null;
  }
};

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Whether the storage-full toast is up for the current run of failed saves. */
let storageFailureShown = false;

/**
 * Save active session data and timers to localStorage.
 * Called when this tab changes the session, never on a clock tick: running
 * clocks are stored as deadlines.
 *
 * Returns the new revision marker, or null if the save failed.
 */
export const saveSessionToStorage = (
  sessionData: SessionFormData,
  timerState: SessionTimerState
): string | null => {
  try {
    const now = Date.now();
    const clock = timerState.clock;

    // Largest write first: if storage is full this is the one that fails,
    // before any of the smaller keys have moved on without it.
    localStorage.setItem(
      STORAGE_KEYS.SESSION_DATA,
      JSON.stringify(sessionData)
    );
    localStorage.setItem(
      STORAGE_KEYS.SESSION_SCHEMA_VERSION,
      String(STORAGE_SCHEMA_VERSION)
    );

    localStorage.setItem(
      STORAGE_KEYS.SESSION_TIMER,
      JSON.stringify({
        value: timerState.sessionTimer,
        timestamp: now,
        isRunning: clock
          ? clock.sessionResumedAt !== null
          : timerState.isTimerRunning,
        ...(clock && {
          accumulatedMs: clock.sessionAccumulatedMs,
          resumedAt: clock.sessionResumedAt,
        }),
      })
    );

    localStorage.setItem(
      STORAGE_KEYS.MATCH_TIMER,
      JSON.stringify({
        value: timerState.matchTimer,
        timestamp: now,
        isRunning: clock ? clock.deadline !== null : timerState.isTimerRunning,
        ...(clock && {
          remainingMs: clock.remainingMs,
          deadline: clock.deadline,
        }),
      })
    );

    localStorage.setItem(
      STORAGE_KEYS.MATCH_STATE,
      JSON.stringify({
        hasStarted: timerState.hasStarted,
        matchPhase: timerState.matchPhase ?? 'auton',
        matchActive: timerState.matchActive ?? false,
        isTimerRunning: timerState.isTimerRunning,
        isPickupPaused: timerState.isPickupPaused ?? false,
        ...(clock && {
          pickupRemainingMs: clock.pickupRemainingMs,
          pickupDeadline: clock.pickupDeadline,
        }),
      })
    );

    localStorage.setItem(
      STORAGE_KEYS.SESSION_START_TIME,
      timerState.sessionStartTime.toString()
    );
    localStorage.setItem(
      STORAGE_KEYS.MATCH_START_TIME,
      timerState.matchStartTime.toString()
    );
    // This save is the latest sign of life; an older one may even predate a
    // change to the device clock.
    localStorage.removeItem(SESSION_SEEN_KEY);

    let previousRev = 0;
    try {
      previousRev = finiteOr(JSON.parse(readSessionToken() ?? 'null')?.rev, 0);
    } catch {
      /* unreadable marker: start counting again */
    }
    const token = JSON.stringify({
      rev: previousRev + 1,
      writerId: WRITER_ID,
      savedAt: now,
    });
    localStorage.setItem(SESSION_REV_KEY, token);
    storageFailureShown = false;
    return token;
  } catch (error) {
    logger.error('Failed to save session to storage:', error);
    // Once per run of failures: every scoring tap saves, and re-raising the
    // toast would keep it over the header for as long as the user scores.
    if (!storageFailureShown) {
      storageFailureShown = true;
      toast.error(
        'Unable to save session data locally. Your browser storage may be full.',
        {
          id: 'storage-full',
        }
      );
    }
    return null;
  }
};

/**
 * Read the stored session data. Data written under another schema version is
 * unusable; `purgeIncompatible` also removes it (and tells the user), which
 * is right on page load but not when peeking at what another tab wrote.
 */
const readSessionData = (
  purgeIncompatible: boolean
): SessionFormData | null => {
  try {
    const storedVersion = localStorage.getItem(
      STORAGE_KEYS.SESSION_SCHEMA_VERSION
    );
    if (storedVersion !== String(STORAGE_SCHEMA_VERSION)) {
      if (!purgeIncompatible) return null;
      const hadData = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
      removeStoredSession();
      if (hadData) {
        setTimeout(() => {
          toast.warning(
            'Your in-progress session was cleared due to an app update. Sorry for the inconvenience!',
            { duration: 8000 }
          );
        }, 1000);
      }
      return null;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    logger.error('Failed to load session from storage:', error);
    return null;
  }
};

/**
 * Read the timer keys and bring every clock up to `now`.
 *
 * Phases are replayed from elapsed wall-clock time (rest of AUTO -> pickup ->
 * TELEOP -> ended) rather than subtracting from one counter, so a match that
 * crossed a phase change while the page was closed comes back in the right
 * phase.
 */
const readTimerState = (
  matchType: string,
  now: number
): { timerState: SessionTimerState; clockCorrected: boolean } | null => {
  const sessionTimerData = localStorage.getItem(STORAGE_KEYS.SESSION_TIMER);
  const matchTimerData = localStorage.getItem(STORAGE_KEYS.MATCH_TIMER);
  const matchStateData = localStorage.getItem(STORAGE_KEYS.MATCH_STATE);
  const sessionStartTime = localStorage.getItem(
    STORAGE_KEYS.SESSION_START_TIME
  );
  const matchStartTime = localStorage.getItem(STORAGE_KEYS.MATCH_START_TIME);

  if (!sessionTimerData || !matchTimerData) {
    return null;
  }

  const sessionTimer = JSON.parse(sessionTimerData) ?? {};
  const matchTimer = JSON.parse(matchTimerData) ?? {};
  const matchState = (matchStateData ? JSON.parse(matchStateData) : null) ?? {};

  const hasStarted: boolean = matchState.hasStarted ?? false;
  const matchActive: boolean = matchState.matchActive ?? false;
  const phase: MatchPhase = MATCH_PHASES.includes(matchState.matchPhase)
    ? matchState.matchPhase
    : 'auton';

  let stored: SessionClockState;
  if (typeof matchTimer.remainingMs === 'number') {
    stored = {
      phase,
      running: Boolean(matchState.isTimerRunning),
      remainingMs: finiteOr(
        matchTimer.remainingMs,
        matchDurationSeconds(matchType) * 1000
      ),
      deadline: finiteOrNull(matchTimer.deadline),
      pickupRemainingMs: finiteOr(matchState.pickupRemainingMs, 0),
      pickupDeadline: finiteOrNull(matchState.pickupDeadline),
      pickupPaused: Boolean(matchState.isPickupPaused),
      sessionAccumulatedMs: finiteOr(sessionTimer.accumulatedMs, 0),
      sessionResumedAt: finiteOrNull(sessionTimer.resumedAt),
    };
  } else {
    // Stored before deadlines were recorded: a value in seconds, the moment
    // it was written, and whether the match clock was running then.
    const savedAt = finiteOr(matchTimer.timestamp, now);
    const remainingMs =
      finiteOr(matchTimer.value, matchDurationSeconds(matchType)) * 1000;
    const counting =
      Boolean(matchTimer.isRunning) &&
      (phase === 'auton' || phase === 'teleop');
    const inPickup = phase === 'controller_pickup';
    stored = {
      phase,
      running: Boolean(matchTimer.isRunning),
      remainingMs,
      deadline: counting ? savedAt + remainingMs : null,
      // The pickup countdown itself was never stored; give it its full length
      pickupRemainingMs: inPickup
        ? GAME_TIMING.CONTROLLER_PICKUP_SECONDS * 1000
        : 0,
      pickupDeadline: inPickup
        ? savedAt + GAME_TIMING.CONTROLLER_PICKUP_SECONDS * 1000
        : null,
      pickupPaused: false,
      sessionAccumulatedMs: finiteOr(sessionTimer.value, 0) * 1000,
      sessionResumedAt: hasStarted
        ? finiteOr(sessionTimer.timestamp, now)
        : null,
    };
  }

  // No match in progress means no match clock to resume
  if (!matchActive) {
    stored = { ...stored, ...idleMatchClock(matchType) };
  }

  // The page was last known to be open at the later of the last save and the
  // last time a tab was hidden or closed with the session in it.
  const lastAliveAt =
    Math.max(
      finiteOr(sessionTimer.timestamp, 0),
      finiteOr(Number(localStorage.getItem(SESSION_SEEN_KEY)), 0)
    ) || now;

  const env: ClockEnv = {
    matchType,
    completed: false,
    sessionRunning: hasStarted,
  };
  const usable = boundClock(resyncClock(stored, lastAliveAt, now), env, now);
  const clock = advanceClock(usable, env, now);

  const timerState: SessionTimerState = {
    sessionTimer: sessionSeconds(clock, now),
    matchTimer: matchSecondsLeft(clock, now),
    isTimerRunning: clock.running,
    hasStarted,
    sessionStartTime: parseInt(sessionStartTime || '0', 10) || 0,
    matchStartTime: parseInt(matchStartTime || '0', 10) || 0,
    matchPhase: clock.phase,
    matchActive,
    phaseTimer: pickupSecondsLeft(clock, now),
    isPickupPaused: clock.pickupPaused,
    clock,
  };
  return { timerState, clockCorrected: !clocksEqual(usable, stored) };
};

/**
 * Load the in-progress session a reload should come back to: one worth
 * storing (started, with saved matches, or a draft with notes or changed
 * settings) and not completed. Returns null when storage holds nothing
 * worth restoring.
 */
export const loadStoredSession = (
  purgeIncompatible = true
): StoredSession | null => {
  try {
    const sessionData = readSessionData(purgeIncompatible);
    if (!sessionData || sessionData.isSessionCompleted) return null;

    const matchType = sessionData.matchType ?? 'Full Game';
    const now = Date.now();
    const timers = readTimerState(matchType, now);
    const timerState = timers?.timerState;
    if (!isWorthStoring(sessionData, timerState?.hasStarted ?? false)) {
      return null;
    }

    if (timers && timerState?.clock) {
      return {
        sessionData,
        timerState,
        clock: timerState.clock,
        clockCorrected: timers.clockCorrected,
      };
    }

    // No timer keys: restore what was saved with a fresh clock
    const clock = idleClock(matchType);
    return {
      sessionData,
      clock,
      clockCorrected: false,
      timerState: {
        sessionTimer: 0,
        matchTimer: matchSecondsLeft(clock, now),
        isTimerRunning: false,
        hasStarted: false,
        sessionStartTime: 0,
        matchStartTime: 0,
        matchPhase: clock.phase,
        matchActive: false,
        phaseTimer: 0,
        isPickupPaused: false,
        clock,
      },
    };
  } catch (error) {
    logger.error('Failed to load stored session:', error);
    return null;
  }
};

/**
 * Remove every key of the stored in-progress session.
 * For SessionProvider, which already knows it is clearing; everything else
 * goes through clearSessionFromStorage so the provider hears about it.
 */
export const removeStoredSession = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TIMER);
    localStorage.removeItem(STORAGE_KEYS.MATCH_TIMER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_START_TIME);
    localStorage.removeItem(STORAGE_KEYS.MATCH_START_TIME);
    localStorage.removeItem(STORAGE_KEYS.MATCH_STATE);
    localStorage.removeItem(STORAGE_KEYS.SESSION_SCHEMA_VERSION);
    localStorage.removeItem(SESSION_SEEN_KEY);
    // Last, so other tabs react once everything else is already gone
    localStorage.removeItem(SESSION_REV_KEY);
  } catch (error) {
    logger.error('Failed to clear session from storage:', error);
  }
};

/**
 * Record that the stored session is open in a tab right now, without
 * changing what is stored. For the moment a tab is hidden or closed, and
 * every so often while its clock is running.
 */
export const markStoredSessionSeen = (): void => {
  try {
    localStorage.setItem(SESSION_SEEN_KEY, String(Date.now()));
  } catch {
    /* storage unavailable: the last save stands in */
  }
};

/**
 * When a tab last said the stored session was open in it, or null if none
 * has since the session was last saved.
 */
export const readStoredSessionSeenAt = (): number | null => {
  try {
    const seenAt = Number(localStorage.getItem(SESSION_SEEN_KEY));
    return Number.isFinite(seenAt) && seenAt > 0 ? seenAt : null;
  } catch {
    return null;
  }
};

/**
 * Clear all session data from localStorage
 * Call when session is completed and saved
 */
export const clearSessionFromStorage = (): void => {
  removeStoredSession();
  window.dispatchEvent(new Event(SESSION_STORAGE_CLEARED_EVENT));
};

/** Clear the "has completed a session" flag (call on logout to avoid cross-user bleed) */
export const clearHasCompletedSession = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.HAS_COMPLETED_SESSION);
  } catch (error) {
    logger.error('Failed to clear hasCompletedSession flag:', error);
  }
};

/**
 * Check if there's an active session in storage: one that has been started
 * or has saved matches. A draft that only holds notes or settings is stored
 * too (see `isWorthStoring`), but it is not an active session.
 */
export const hasActiveSession = (): boolean => {
  try {
    const sessionDataStr = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    if (!sessionDataStr) return false;

    const sessionData = JSON.parse(sessionDataStr);

    const hasMatches = sessionData.matches && sessionData.matches.length > 0;

    const matchStateStr = localStorage.getItem(STORAGE_KEYS.MATCH_STATE);
    const matchState = matchStateStr ? JSON.parse(matchStateStr) : null;
    const hasStarted = matchState?.hasStarted ?? false;

    return hasMatches || hasStarted;
  } catch (error) {
    logger.error('Failed to check for active session:', error);
    return false;
  }
};
