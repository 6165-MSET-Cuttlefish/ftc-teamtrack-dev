/**
 * Session Storage Utilities
 * Handles persistent storage of active session data in localStorage
 * Allows timers and state to continue running in the background
 */

import type { Match, ScoringFields } from '@/types';
import { logger } from './logger';

const HAS_COMPLETED_SESSION_KEY = 'teamtrack-has-completed-session';

/** Current schema version for stored session data. Bump when SessionFormData shape changes. */
const STORAGE_SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = 'teamtrack-session-schema-version';

/** Check if the user has ever completed a session */
export const hasCompletedASession = (): boolean =>
  localStorage.getItem(HAS_COMPLETED_SESSION_KEY) === 'true';

/** Mark that the user has completed at least one session */
export const markSessionCompleted = (): void =>
  localStorage.setItem(HAS_COMPLETED_SESSION_KEY, 'true');

const SESSION_DATA = 'teamtrack-session-data';
const SESSION_TIMER = 'teamtrack-session-timer';
const MATCH_TIMER = 'teamtrack-match-timer';
const SESSION_START_TIME = 'teamtrack-session-start-time';
const MATCH_START_TIME = 'teamtrack-match-start-time';
const MATCH_STATE = 'teamtrack-match-state';

export interface SessionFormData extends ScoringFields {
  sessionName: string;
  sessionDuration: string;
  matchType: string;
  isSessionCompleted: boolean;
  selectedFeature: string;
  notes: string;
  matches: Match[];
}

export interface SessionTimerState {
  sessionTimer: number;
  matchTimer: number;
  isTimerRunning: boolean;
  hasStarted: boolean;
  hasTransitionedToTeleop: boolean;
  showTeleopTransition: boolean;
  sessionStartTime: number;
  matchStartTime: number;
  matchPhase?: 'auton' | 'controller_pickup' | 'prepare' | 'teleop' | 'ended';
}

export interface MatchState {
  hasStarted: boolean;
  hasTransitionedToTeleop: boolean;
  showTeleopTransition: boolean;
  matchPhase?: 'auton' | 'controller_pickup' | 'prepare' | 'teleop' | 'ended';
}

/**
 * Save active session data and timers to localStorage
 * Called whenever session data or timer state changes
 */
export const saveSessionToStorage = (
  sessionData: SessionFormData,
  timerState: SessionTimerState
): void => {
  try {
    // Save session data (all scoring data, matches, etc.)
    localStorage.setItem(SESSION_DATA, JSON.stringify(sessionData));
    localStorage.setItem(SCHEMA_VERSION_KEY, String(STORAGE_SCHEMA_VERSION));

    // Save timer states with timestamps so we can calculate elapsed time
    localStorage.setItem(
      SESSION_TIMER,
      JSON.stringify({
        value: timerState.sessionTimer,
        timestamp: Date.now(),
        isRunning: timerState.isTimerRunning,
      })
    );

    localStorage.setItem(
      MATCH_TIMER,
      JSON.stringify({
        value: timerState.matchTimer,
        timestamp: Date.now(),
        isRunning: timerState.isTimerRunning,
      })
    );

    // Save match state flags
    localStorage.setItem(
      MATCH_STATE,
      JSON.stringify({
        hasStarted: timerState.hasStarted,
        hasTransitionedToTeleop: timerState.hasTransitionedToTeleop,
        showTeleopTransition: timerState.showTeleopTransition,
        matchPhase: timerState.matchPhase ?? 'auton',
      })
    );

    // Save session meta info
    localStorage.setItem(
      SESSION_START_TIME,
      timerState.sessionStartTime.toString()
    );
    localStorage.setItem(
      MATCH_START_TIME,
      timerState.matchStartTime.toString()
    );
  } catch (error) {
    logger.error('Failed to save session to storage:', error);
    // Notify user if localStorage write fails (e.g. storage full)
    try {
      const { toast } = require('sonner') as { toast: { error: (msg: string) => void } };
      toast.error('Unable to save session data locally. Your browser storage may be full.');
    } catch { /* sonner not yet loaded */ }
  }
};

/**
 * Load session data from localStorage if it exists
 * Returns null if no session is stored
 */
export const loadSessionFromStorage = (): SessionFormData | null => {
  try {
    // Check schema version — discard stale data from older app versions
    const storedVersion = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (storedVersion !== String(STORAGE_SCHEMA_VERSION)) {
      // If there was actual session data, warn the user
      const hadData = localStorage.getItem(SESSION_DATA);
      clearSessionFromStorage();
      if (hadData) {
        // Defer toast so it fires after the app has mounted
        setTimeout(() => {
          try {
            const { toast } = require('sonner') as { toast: { warning: (msg: string, opts?: Record<string, unknown>) => void } };
            toast.warning(
              'Your in-progress session was cleared due to an app update. Sorry for the inconvenience!',
              { duration: 8000 }
            );
          } catch { /* sonner not yet loaded */ }
        }, 1000);
      }
      return null;
    }
    const stored = localStorage.getItem(SESSION_DATA);
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
    const sessionTimerData = localStorage.getItem(SESSION_TIMER);
    const matchTimerData = localStorage.getItem(MATCH_TIMER);
    const matchStateData = localStorage.getItem(MATCH_STATE);
    const sessionStartTime = localStorage.getItem(SESSION_START_TIME);
    const matchStartTime = localStorage.getItem(MATCH_START_TIME);

    if (!sessionTimerData || !matchTimerData) {
      return null;
    }

    const sessionData = JSON.parse(sessionTimerData);
    const matchData = JSON.parse(matchTimerData);
    const matchState = matchStateData ? JSON.parse(matchStateData) : {};

    // Calculate elapsed time based on how long the storage has been sitting
    // BUT only if the timer was actually running - if it was paused, don't add elapsed time
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
    localStorage.removeItem(SESSION_DATA);
    localStorage.removeItem(SESSION_TIMER);
    localStorage.removeItem(MATCH_TIMER);
    localStorage.removeItem(SESSION_START_TIME);
    localStorage.removeItem(MATCH_START_TIME);
    localStorage.removeItem(MATCH_STATE);
    localStorage.removeItem(SCHEMA_VERSION_KEY);
  } catch (error) {
    logger.error('Failed to clear session from storage:', error);
  }
};

/**
 * Check if there's an active session in storage
 * A session is only considered "active" if it has been started or has meaningful data
 */
export const hasActiveSession = (): boolean => {
  try {
    const sessionDataStr = localStorage.getItem(SESSION_DATA);
    if (!sessionDataStr) return false;

    const sessionData = JSON.parse(sessionDataStr);

    // Check if the session has actually been started or has meaningful content
    // A session is active if:
    // 1. It has a session name (user has configured it)
    // 2. It has matches recorded
    // 3. It has any scoring data (not all zeros)
    const hasName =
      sessionData.sessionName && sessionData.sessionName.trim() !== '';
    const hasMatches = sessionData.matches && sessionData.matches.length > 0;
    const hasScoring =
      (sessionData.finalScore && sessionData.finalScore > 0) ||
      (sessionData.autonomousScore && sessionData.autonomousScore > 0) ||
      (sessionData.teleopScore && sessionData.teleopScore > 0);

    return hasName || hasMatches || hasScoring;
  } catch (error) {
    logger.error('Failed to check for active session:', error);
    return false;
  }
};

/**
 * Save only the match state (without full session data)
 * Used when you only need to persist UI state flags
 */
export const saveMatchStateToStorage = (state: MatchState): void => {
  try {
    localStorage.setItem(MATCH_STATE, JSON.stringify({
      hasStarted: state.hasStarted,
      hasTransitionedToTeleop: state.hasTransitionedToTeleop,
      showTeleopTransition: state.showTeleopTransition,
      matchPhase: state.matchPhase ?? 'auton',
    }));
  } catch (error) {
    logger.error('Failed to save match state to storage:', error);
  }
};
