import { Timestamp } from 'firebase/firestore';

export interface Session {
  id: string;
  userId: string;
  sessionName: string;
  driverName?: string;
  matchType?: string;
  sessionDuration?: string;
  finalScore?: number;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
  createdAt: Timestamp | string;
  // New scoring system - removed separate basket/specimen scores
  autonClassifiedArtifact?: number;   // Classified Artifact (3 pts each)
  autonOverflowArtifact?: number;     // Overflow Artifact (1 pt each)
  autonMotif?: number;                // Motif (2 pts each)
  autonLeave?: number;                // Leave (3 pts)
  teleClassifiedArtifact?: number;    // Classified Artifact (3 pts each)
  teleOverflowArtifact?: number;      // Overflow Artifact (1 pt each)
  teleMotif?: number;                 // Motif (2 pts each)
  endgameHang?: number;
  // Features and cycle times
  selectedFeature?: string;
  cycleTimes?: number[];
  [key: string]: unknown;
}
