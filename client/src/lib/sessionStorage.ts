/**
 * Session Storage Utilities
 * Handles persistent storage of active session data in localStorage
 * Allows timers and state to continue running in the background
 */

import type { Match, ScoringFields } from '@/types';

const SESSION_DATA = 'teamtrack-session-data';
const SESSION_TIMER = 'teamtrack-session-timer';
const MATCH_TIMER = 'teamtrack-match-timer';
const SESSION_START_TIME = 'teamtrack-session-start-time';
const MATCH_START_TIME = 'teamtrack-match-start-time';
const MATCH_STATE = 'teamtrack-match-state';

export interface SessionFormData extends ScoringFields {
  sessionName: string;
  driverName: string;
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
  hasTransitionedToTeleOp: boolean;
  showTeleOpTransition: boolean;
  sessionStartTime: number;
  matchStartTime: number;
}

export interface MatchState {
  hasStarted: boolean;
  hasTransitionedToTeleOp: boolean;
  showTeleOpTransition: boolean;
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
        hasTransitionedToTeleOp: timerState.hasTransitionedToTeleOp,
        showTeleOpTransition: timerState.showTeleOpTransition,
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
    console.error('Failed to save session to storage:', error);
  }
};

/**
 * Load session data from localStorage if it exists
 * Returns null if no session is stored
 */
export const loadSessionFromStorage = (): SessionFormData | null => {
  try {
    const stored = localStorage.getItem(SESSION_DATA);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load session from storage:', error);
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
    const sessionElapsed = sessionData.isRunning ? Math.floor((now - sessionData.timestamp) / 1000) : 0;
    const matchElapsed = matchData.isRunning ? Math.floor((now - matchData.timestamp) / 1000) : 0;

    return {
      sessionTimer: sessionData.value + sessionElapsed,
      matchTimer: matchData.value + matchElapsed,
      isTimerRunning: sessionData.isRunning,
      hasStarted: matchState.hasStarted ?? false,
      hasTransitionedToTeleOp: matchState.hasTransitionedToTeleOp ?? false,
      showTeleOpTransition: matchState.showTeleOpTransition ?? false,
      sessionStartTime: parseInt(sessionStartTime || '0', 10),
      matchStartTime: parseInt(matchStartTime || '0', 10),
    };
  } catch (error) {
    console.error('Failed to load timer state from storage:', error);
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
  } catch (error) {
    console.error('Failed to clear session from storage:', error);
  }
};

/**
 * Check if there's an active session in storage
 */
export const hasActiveSession = (): boolean => {
  try {
    return localStorage.getItem(SESSION_DATA) !== null;
  } catch (error) {
    console.error('Failed to check for active session:', error);
    return false;
  }
};

/**
 * Save only the match state (without full session data)
 * Used when you only need to persist UI state flags
 */
export const saveMatchStateToStorage = (state: MatchState): void => {
  try {
    localStorage.setItem(MATCH_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save match state to storage:', error);
  }
};
