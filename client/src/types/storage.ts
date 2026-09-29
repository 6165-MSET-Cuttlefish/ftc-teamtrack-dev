import type { Match, MatchScoringFields, MatchPhase, SessionType } from './session';

/** Shape of session form data persisted to localStorage */
export interface SessionFormData extends MatchScoringFields {
  sessionName: string;
  sessionDuration: string;
  /** Practice or Scrim */
  sessionType: SessionType;
  matchType: string;
  isSessionCompleted: boolean;
  selectedFeature: string;
  notes: string;
  matches: Match[];
}

/** Shape of timer state persisted to localStorage */
export interface SessionTimerState {
  sessionTimer: number;
  matchTimer: number;
  isTimerRunning: boolean;
  hasStarted: boolean;
  hasTransitionedToTeleop: boolean;
  showTeleopTransition: boolean;
  sessionStartTime: number;
  matchStartTime: number;
  matchPhase?: MatchPhase;
  /** Whether a match was in progress (started and not yet saved/discarded) */
  matchActive?: boolean;
}
