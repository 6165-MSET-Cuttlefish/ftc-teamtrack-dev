import type {
  Match,
  MatchScoringFields,
  MatchPhase,
  SessionType,
} from './session';

/** Shape of session form data persisted to localStorage */
export interface SessionFormData extends MatchScoringFields {
  sessionName: string;
  /**
   * The name was typed by the user (Rename), so it is theirs even where it
   * reads like one the app gives ("Practice 1"): never numbered afresh.
   */
  sessionNameTyped?: boolean;
  sessionDuration: string;
  /** Practice or Scrim */
  sessionType: SessionType;
  matchType: string;
  isSessionCompleted: boolean;
  selectedFeature: string;
  notes: string;
  matches: Match[];
}

/**
 * Wall-clock anchors for the match, controller-pickup and session clocks.
 *
 * A clock that is counting is stored as the moment it ends (or started), not
 * as a number of seconds, so time that passes while the page is frozen,
 * backgrounded or closed is still accounted for.
 */
export interface SessionClockState {
  phase: MatchPhase;
  /** The match clock is meant to be counting (false during pickup and after the buzzer) */
  running: boolean;
  /** Milliseconds left on the match clock while it is stopped */
  remainingMs: number;
  /** Epoch ms at which the match clock reaches 0:00; null while it is stopped */
  deadline: number | null;
  /** Milliseconds left of controller pickup while that countdown is stopped */
  pickupRemainingMs: number;
  /** Epoch ms at which controller pickup ends; null while it is not counting */
  pickupDeadline: number | null;
  /** Controller pickup is frozen by the user */
  pickupPaused: boolean;
  /** Session time banked before `sessionResumedAt`, in milliseconds */
  sessionAccumulatedMs: number;
  /** Epoch ms the session clock last started counting; null while it is stopped */
  sessionResumedAt: number | null;
}

/** Shape of timer state persisted to localStorage */
export interface SessionTimerState {
  sessionTimer: number;
  matchTimer: number;
  isTimerRunning: boolean;
  hasStarted: boolean;
  /** Epoch ms the session was first started (0 if it has not been) */
  sessionStartTime: number;
  /** Epoch ms the in-progress match was started (0 between matches) */
  matchStartTime: number;
  matchPhase?: MatchPhase;
  /** Whether a match was in progress (started and not yet saved/discarded) */
  matchActive?: boolean;
  /** Seconds left of controller pickup */
  phaseTimer?: number;
  /** Whether the controller-pickup countdown is frozen */
  isPickupPaused?: boolean;
  /** Wall-clock anchors; absent on data stored before they were recorded */
  clock?: SessionClockState;
}
