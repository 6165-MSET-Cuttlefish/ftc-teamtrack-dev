import type { Match, ScoringFields, MatchPhase } from './session';

/** Shape of session form data persisted to localStorage */
export interface SessionFormData extends ScoringFields {
  sessionName: string;
  sessionDuration: string;
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
}
