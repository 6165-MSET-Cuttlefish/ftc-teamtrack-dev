import type { Timestamp } from 'firebase/firestore';

/** Match phase during active gameplay */
export type MatchPhase = 'auton' | 'controller_pickup' | 'teleop' | 'ended';

/** How a session was run */
export type SessionType = 'Practice' | 'Scrim';

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/** Union type for timestamp values from Firebase */
export type TimestampValue = Timestamp | FirebaseTimestamp | string | Date;

/**
 * Every BIOBUZZ scoring input for one match.
 *
 * v1 records whole-match totals rather than splitting garden/tipping by
 * phase. `phaseLog` keeps the raw timeline so an auton/teleop breakdown can
 * be derived later without a data migration.
 */
export interface MatchScoringFields {
  /** Hive tips — counted live during the match, 20 pts each in either period */
  tipping: number;
  /** Garden — counted live during the match, assessed at match end */
  garden: number;
  /** Flower — POLLEN/NECTAR placed in a FLOWER this alliance owns */
  flower: number;
  /** Flower — Bottom NECTAR Bonus achieved, up to once per FLOWER (max 4) */
  flowerBonus: number;
  /** Balls left in the hive's upward-facing cell when the match ends */
  ballsInHive: number;
  /** Autonomous leave, per robot */
  robot1Leave: boolean;
  robot2Leave: boolean;
  /**
   * Park, per robot. BIOBUZZ scores parking twice per robot: once if parked
   * at the end of AUTO, once if parked at the end of the match.
   */
  robot1ParkAuto: boolean;
  robot1ParkTeleop: boolean;
  robot2ParkAuto: boolean;
  robot2ParkTeleop: boolean;
  /** Penalties charged against this alliance */
  minorPenalties: number;
  majorPenalties: number;
  /** Timeline of live scoring actions, for cycle-time analysis */
  phaseLog?: ScoreEvent[];
}

/** One live scoring action, timestamped against the match clock */
export interface ScoreEvent {
  /** Which live-scored element changed */
  field: 'garden' | 'tipping';
  /** Value the field moved to */
  value: number;
  /** Match phase the action happened in */
  phase: MatchPhase;
  /** Seconds remaining on the match clock */
  timeRemaining: number;
  /** Seconds since the previous scoring action */
  cycleTime?: number;
}

/** Component-by-component point totals for one match */
export interface ScoreBreakdown {
  tipping: number;
  garden: number;
  flower: number;
  flowerBonus: number;
  hive: number;
  leave: number;
  park: number;
  /** Positive magnitude of points lost to penalties */
  penalties: number;
  /** Points scored before penalties */
  earned: number;
  /** Final match score, floored at zero */
  total: number;
}

/** A single recorded match within a session */
export interface Match extends MatchScoringFields {
  id: string;
  matchNumber: number;
  /** Which segment of the game was run: Full Game, Autonomous, or Teleop */
  matchType?: string;
  createdAt?: TimestampValue;
  /** Cached final score; always re-derivable via calculateScore */
  finalScore?: number;
}

/**
 * A practice or scrim session containing multiple matches.
 *
 * All scoring data lives in the `matches` array — aggregate from it when
 * displaying session totals rather than storing duplicate rollups.
 */
export interface Session {
  id: string;
  userId: string;
  userEmail?: string;
  teamId?: string;
  sessionName: string;
  /** Practice or Scrim */
  sessionType?: SessionType;
  matchType?: string;
  sessionDuration?: string;
  createdAt: TimestampValue;
  selectedFeature?: string;
  notes?: string;
  matches: Match[];
  /** Game season the session was recorded in (absent on pre-tag sessions) */
  season?: string;
}

/** Session data for creating new sessions (without id and createdAt) */
export type CreateSessionData = Omit<Session, 'id' | 'createdAt'>;

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** Primary auth provider ID (e.g. 'password', 'google.com') */
  providerId?: string;
  /** Whether the user's email address has been verified */
  emailVerified?: boolean;
}

export interface ChartDataPoint {
  name?: string;
  value?: number;
  category?: string;
  fullMark?: number;
  [key: string]: string | number | undefined;
}
