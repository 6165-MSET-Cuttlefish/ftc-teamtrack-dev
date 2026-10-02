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
 * v1 records whole-match totals rather than splitting anything by phase.
 * Tipping is the only action logged as it happens: `phaseLog` keeps its raw
 * timeline so an auton/teleop breakdown of tips can be derived later without
 * a data migration. Everything else is a count entered at the end.
 */
export interface MatchScoringFields {
  /** Hive tips — counted live during the match, 20 pts each in either period */
  tipping: number;
  /** Garden — POLLEN/NECTAR in the GARDEN, counted once at match end */
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
  /**
   * Fouls this alliance committed. Each is credited to the OPPONENT's score
   * (MINOR 5, MAJOR 20) and never subtracted from this alliance's own.
   */
  minorPenalties: number;
  majorPenalties: number;
  /** Timeline of Hive Tips as they were counted, for cycle-time analysis */
  phaseLog?: ScoreEvent[];
}

/** One live scoring action, timestamped against the match clock */
export interface ScoreEvent {
  /**
   * Which live-scored element changed. New matches only log 'tipping';
   * 'garden' is legacy, found in sessions recorded while Garden was still
   * tapped live, and is kept so those logs still type-check.
   */
  field: 'garden' | 'tipping';
  /** Value the field moved to */
  value: number;
  /** Match phase the action happened in */
  phase: MatchPhase;
  /** Seconds remaining on the match clock */
  timeRemaining: number;
  /**
   * Seconds since the previous logged action: the previous tip, or in a
   * legacy log the previous tip or Garden tap. Read cycle times through
   * `cycleTimesOf`, which turns either into time between Hive Tips.
   */
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
  /**
   * Points this alliance's fouls gave the OPPONENT (a positive number).
   * Reported next to the score; not part of `earned` or `total`.
   */
  penalties: number;
  /** Points this alliance scored: the sum of the components above */
  earned: number;
  /** Match score. Equal to `earned` — fouls never reduce it */
  total: number;
}

/** A single recorded match within a session */
export interface Match extends MatchScoringFields {
  id: string;
  matchNumber: number;
  /** Which segment of the game was run: Full Game, Autonomous, or Teleop */
  matchType?: string;
  createdAt?: TimestampValue;
  /**
   * Cached final score. May be stale on older matches (fouls used to be
   * subtracted from it) — read scores with `matchScore`, which recomputes.
   */
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
  /**
   * The type its matches share, or 'Mixed'. Matches carry their own type;
   * derive this with `sessionMatchType` rather than trusting the stored value.
   */
  matchType?: string;
  sessionDuration?: string;
  createdAt: TimestampValue;
  selectedFeature?: string;
  notes?: string;
  /**
   * An archived session is kept (in Firestore, or a guest's browser) and
   * still counts everywhere else; it is only moved out of the default list
   * on My Sessions. Optional: sessions saved before the field read as active.
   */
  archived?: boolean;
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
