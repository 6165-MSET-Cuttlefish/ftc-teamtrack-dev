/**
 * Session Persistence Utilities
 * Handles persistent storage of active session data in localStorage
 * Allows timers and state to continue running in the background
 */

import type { SessionFormData, SessionTimerState } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import { logger } from './logger';
import { toast } from 'sonner';

/** Current schema version for stored session data. Bump when SessionFormData shape changes. */
const STORAGE_SCHEMA_VERSION = 1;

/** Check if the user has ever completed a session */
export const hasCompletedASession = (): boolean =>
  localStorage.getItem(STORAGE_KEYS.HAS_COMPLETED_SESSION) === 'true';

/** Mark that the user has completed at least one session */
export const markSessionCompleted = (): void =>
  localStorage.setItem(STORAGE_KEYS.HAS_COMPLETED_SESSION, 'true');

export type { SessionFormData, SessionTimerState } from '@/types';

/**
 * Save active session data and timers to localStorage
 * Called whenever session data or timer state changes
 */
export const saveSessionToStorage = (
  sessionData: SessionFormData,
  timerState: SessionTimerState
): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessionData));
    localStorage.setItem(STORAGE_KEYS.SESSION_SCHEMA_VERSION, String(STORAGE_SCHEMA_VERSION));

    localStorage.setItem(
      STORAGE_KEYS.SESSION_TIMER,
      JSON.stringify({
        value: timerState.sessionTimer,
        timestamp: Date.now(),
        isRunning: timerState.isTimerRunning,
      })
    );

    localStorage.setItem(
      STORAGE_KEYS.MATCH_TIMER,
      JSON.stringify({
        value: timerState.matchTimer,
        timestamp: Date.now(),
        isRunning: timerState.isTimerRunning,
      })
    );

    localStorage.setItem(
      STORAGE_KEYS.MATCH_STATE,
      JSON.stringify({
        hasStarted: timerState.hasStarted,
        hasTransitionedToTeleop: timerState.hasTransitionedToTeleop,
        showTeleopTransition: timerState.showTeleopTransition,
        matchPhase: timerState.matchPhase ?? 'auton',
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
  } catch (error) {
    logger.error('Failed to save session to storage:', error);
    toast.error('Unable to save session data locally. Your browser storage may be full.');
  }
};

/**
 * Load session data from localStorage if it exists
 * Returns null if no session is stored
 */
export const loadSessionFromStorage = (): SessionFormData | null => {
  try {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.SESSION_SCHEMA_VERSION);
    if (storedVersion !== String(STORAGE_SCHEMA_VERSION)) {
      const hadData = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
      clearSessionFromStorage();
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
 * Load timer state from localStorage
 * Calculates how much time has elapsed since the timer was paused
 * Only adds elapsed time if the timer was actively running
 */
export const loadTimerStateFromStorage = (): SessionTimerState | null => {
  try {
    const sessionTimerData = localStorage.getItem(STORAGE_KEYS.SESSION_TIMER);
    const matchTimerData = localStorage.getItem(STORAGE_KEYS.MATCH_TIMER);
    const matchStateData = localStorage.getItem(STORAGE_KEYS.MATCH_STATE);
    const sessionStartTime = localStorage.getItem(STORAGE_KEYS.SESSION_START_TIME);
    const matchStartTime = localStorage.getItem(STORAGE_KEYS.MATCH_START_TIME);

    if (!sessionTimerData || !matchTimerData) {
      return null;
    }

    const sessionData = JSON.parse(sessionTimerData);
    const matchData = JSON.parse(matchTimerData);
    const matchState = matchStateData ? JSON.parse(matchStateData) : {};

    const now = Date.now();
    const sessionElapsed = sessionData.isRunning
      ? Math.floor((now - sessionData.timestamp) / 1000)
      : 0;
    const matchElapsed = matchData.isRunning
      ? Math.floor((now - matchData.timestamp) / 1000)
      : 0;

    return {
      sessionTimer: sessionData.value + sessionElapsed,
      matchTimer: Math.max(0, matchData.value - matchElapsed),
      isTimerRunning: sessionData.isRunning,
      hasStarted: matchState.hasStarted ?? false,
      hasTransitionedToTeleop: matchState.hasTransitionedToTeleop ?? false,
      showTeleopTransition: matchState.showTeleopTransition ?? false,
      sessionStartTime: parseInt(sessionStartTime || '0', 10),
      matchStartTime: parseInt(matchStartTime || '0', 10),
      matchPhase: matchState.matchPhase ?? 'auton',
    };
  } catch (error) {
    logger.error('Failed to load timer state from storage:', error);
    return null;
  }
};

/**
 * Clear all session data from localStorage
 * Call when session is completed and saved
 */
export const clearSessionFromStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TIMER);
    localStorage.removeItem(STORAGE_KEYS.MATCH_TIMER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_START_TIME);
    localStorage.removeItem(STORAGE_KEYS.MATCH_START_TIME);
    localStorage.removeItem(STORAGE_KEYS.MATCH_STATE);
    localStorage.removeItem(STORAGE_KEYS.SESSION_SCHEMA_VERSION);
  } catch (error) {
    logger.error('Failed to clear session from storage:', error);
  }
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
 * Check if there's an active session in storage
 * A session is only considered "active" if it has been started or has meaningful data
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


