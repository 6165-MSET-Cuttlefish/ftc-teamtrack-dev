import { Timestamp } from 'firebase/firestore';

export interface Session {
  id: string;
  userId: string;
  sessionName: string;
  driverName?: string;
  matchType?: string;
  sessionDuration?: string;
  finalScore?: number;
  createdAt: Timestamp | string;
  autonBasket?: number;
  autonSpeci?: number;
  teleBasket?: number;
  teleSpeci?: number;
  endgameHang?: number;
  [key: string]: unknown;
}