import type { Timestamp } from 'firebase/firestore';

/** Match phase during active gameplay */
export type MatchPhase =
  | 'auton'
  | 'controller_pickup'
  | 'teleop'
  | 'ended';

/** Color options for 3-ball motif pattern */
export type MotifColor = 'purple' | 'green' | 'empty';

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/** Union type for timestamp values from Firebase */
export type TimestampValue = Timestamp | FirebaseTimestamp | string | Date;

/** Individual shot record with balls shot and balls made */
export interface ShotEntry {
  ballsShot: number;
  ballsMade: number;
  /** Elapsed seconds since the previous scoring action (cycle time) */
  cycleTime?: number;
  /** Balls classified into the gate (3 pts each) */
  classified?: number;
  /** Overflow balls beyond gate capacity (1 pt each) */
  overflow?: number;
}

export interface ScoringFields {
  finalScore: number;
  autonomousScore: number;
  teleopScore: number;
  endGameScore: number;
  /** Classified Artifact (3 pts each) */
  autonClassifiedArtifact: number;
  /** Overflow Artifact (1 pt each) */
  autonOverflowArtifact: number;
  /** Motif (2 pts each) */
  autonMotif: number;
  /** Leave (3 pts) */
  autonLeave: number;
  /** Balls Missed in Autonomous */
  autonBallsMissed: number;
  /** Classified Artifact (3 pts each) */
  teleClassifiedArtifact: number;
  /** Overflow Artifact (1 pt each) */
  teleOverflowArtifact: number;
  /** Motif (2 pts each) */
  teleMotif: number;
  /** Balls Missed in Teleop */
  teleBallsMissed: number;
  /** Robot 1 parking status */
  robot1Park: 'none' | 'partial' | 'full';
  /** Robot 2 parking status */
  robot2Park: 'none' | 'partial' | 'full';
  /** Current number of balls in the gate (0-9) */
  gateBallCount: number;
  /** Gate add-back mode active (UI state) */
  gateAddBackMode?: boolean;
  /** How many balls to keep when releasing gate (UI state) */
  gateAddBackCount?: number;
  /** 3-ball motif pattern set at match start (purple or green per slot) */
  motifPattern?: MotifColor[];
  cycleTimes: number[];
  /** Individual shot records for Autonomous phase */
  autonShots?: ShotEntry[];
  /** Individual shot records for TeleOp phase */
  teleopShots?: ShotEntry[];
  /** Whether gate scoring (classified/overflow) is enabled */
  gateEnabled?: boolean;
}

export interface Match {
  id: string;
  matchNumber: number;
  matchType?: string;
  createdAt?: TimestampValue;
  finalScore?: number;
  autonomousScore?: number;
  teleopScore?: number;
  endGameScore?: number;
  autonClassifiedArtifact?: number;
  autonOverflowArtifact?: number;
  autonMotif?: number;
  autonLeave?: number;
  autonBallsMissed?: number;
  teleClassifiedArtifact?: number;
  teleOverflowArtifact?: number;
  teleMotif?: number;
  teleBallsMissed?: number;
  robot1Park?: 'none' | 'partial' | 'full';
  robot2Park?: 'none' | 'partial' | 'full';
  gateBallCount?: number;
  motifPattern?: MotifColor[];
  cycleTimes?: number[];
  autonShots?: ShotEntry[];
  teleopShots?: ShotEntry[];
  gateEnabled?: boolean;
}

/**
 * Represents a practice/training session that can contain multiple matches.
 *
 * Data Model:
 * - A Session contains metadata (name, duration) and an array of Match objects
 * - All scoring data is stored in the matches array
 * - Aggregate from the matches array when displaying session totals
 */
export interface Session {
  id: string;
  userId: string;
  userEmail?: string;
  teamId?: string;
  sessionName: string;
  matchType?: string;
  sessionDuration?: string;
  createdAt: TimestampValue;
  selectedFeature?: string;
  notes?: string;
  matches: Match[];
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
