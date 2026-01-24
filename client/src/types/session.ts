import type { Timestamp } from 'firebase/firestore';

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/** Union type for timestamp values from Firebase */
export type TimestampValue = Timestamp | FirebaseTimestamp | string | Date;

export interface ScoringFields {
  finalScore: number;
  autonomousScore: number;
  teleOpScore: number;
  endGameScore: number;
  /** Classified Artifact (3 pts each) */
  autonClassifiedArtifact: number;
  /** Overflow Artifact (1 pt each) */
  autonOverflowArtifact: number;
  /** Motif (2 pts each) */
  autonMotif: number;
  /** Leave (3 pts) */
  autonLeave: number;
  /** Classified Artifact (3 pts each) */
  teleClassifiedArtifact: number;
  /** Overflow Artifact (1 pt each) */
  teleOverflowArtifact: number;
  /** Motif (2 pts each) */
  teleMotif: number;
  endgameHang: number;
  cycleTimes: number[];
}

export interface Match {
  id: string;
  matchNumber: number;
  matchType?: string;
  createdAt?: TimestampValue;
  // Scoring fields
  finalScore?: number;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
  autonClassifiedArtifact?: number;
  autonOverflowArtifact?: number;
  autonMotif?: number;
  autonLeave?: number;
  teleClassifiedArtifact?: number;
  teleOverflowArtifact?: number;
  teleMotif?: number;
  endgameHang?: number;
  cycleTimes?: number[];
}

/**
 * Represents a practice/training session that can contain multiple matches.
 * 
 * Data Model:
 * - A Session contains metadata (name, driver, duration) and an array of Match objects
 * - Individual scoring fields on Session are DEPRECATED - they exist for backwards compatibility
 * - New sessions should store scoring data only in the matches array
 * - When displaying session totals, aggregate from the matches array
 */
export interface Session {
  id: string;
  userId: string;
  userEmail?: string;
  sessionName: string;
  driverName?: string;
  matchType?: string;
  sessionDuration?: string;
  createdAt: TimestampValue;
  selectedFeature?: string;
  notes?: string;
  matches?: Match[];
  // Scoring fields are optional on Session to support legacy data
  finalScore?: number;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
  autonClassifiedArtifact?: number;
  autonOverflowArtifact?: number;
  autonMotif?: number;
  autonLeave?: number;
  teleClassifiedArtifact?: number;
  teleOverflowArtifact?: number;
  teleMotif?: number;
  endgameHang?: number;
  cycleTimes?: number[];
  [key: string]: unknown;
}

/** Session data for creating new sessions (without id and createdAt) */
export type CreateSessionData = Omit<Session, 'id' | 'createdAt'>;

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ChartDataPoint {
  name?: string;
  value?: number;
  category?: string;
  fullMark?: number;
  [key: string]: string | number | undefined;
}
