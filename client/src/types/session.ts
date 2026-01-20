import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// Firebase Timestamp Types
// ============================================================================

/** Firebase Firestore timestamp structure */
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/** Union type for timestamp values from Firebase */
export type TimestampValue = Timestamp | FirebaseTimestamp | string | Date;

// ============================================================================
// Scoring Types
// ============================================================================

/** Common scoring fields shared between Session and Match */
export interface ScoringFields {
  finalScore?: number;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
  /** Classified Artifact (3 pts each) */
  autonClassifiedArtifact?: number;
  /** Overflow Artifact (1 pt each) */
  autonOverflowArtifact?: number;
  /** Motif (2 pts each) */
  autonMotif?: number;
  /** Leave (3 pts) */
  autonLeave?: number;
  /** Classified Artifact (3 pts each) */
  teleClassifiedArtifact?: number;
  /** Overflow Artifact (1 pt each) */
  teleOverflowArtifact?: number;
  /** Motif (2 pts each) */
  teleMotif?: number;
  endgameHang?: number;
  cycleTimes?: number[];
}

// ============================================================================
// Match Types
// ============================================================================

export interface Match extends ScoringFields {
  id: string;
  matchNumber: number;
  matchType?: string;
  createdAt?: TimestampValue;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session extends ScoringFields {
  id: string;
  userId: string;
  sessionName: string;
  driverName?: string;
  matchType?: string;
  sessionDuration?: string;
  createdAt: TimestampValue;
  selectedFeature?: string;
  matches?: Match[];
  [key: string]: unknown;
}

/** Session data for creating new sessions (without id and createdAt) */
export type CreateSessionData = Omit<Session, 'id' | 'createdAt'>;

// ============================================================================
// User Types
// ============================================================================

/** Simplified user type for authentication */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ============================================================================
// Chart Types
// ============================================================================

/** Generic chart data point for recharts */
export interface ChartDataPoint {
  name?: string;
  value?: number;
  category?: string;
  fullMark?: number;
  [key: string]: string | number | undefined;
}
