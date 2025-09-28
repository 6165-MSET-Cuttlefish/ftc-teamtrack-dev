/**
 * Session-related type definitions
 */

export interface SessionInfo {
  sessionName: string;
  driverName: string;
  matchType: string;
}

export interface AutonData {
  lowBasket?: number;
  highBasket?: number;
  netZone?: number;
  lowRung?: number;
  highRung?: number;
}

export interface TeleopData {
  lowBasket?: number;
  highBasket?: number;
}

export interface SessionData {
  id?: string;
  info?: SessionInfo;
  auto?: AutonData;
  teleop?: TeleopData;
  sessionDuration?: string;
  userId?: string;
  userEmail?: string;
  createdAt?: string;
  // Processed fields
  autonBasket?: number;
  autonSpeci?: number;
  autonFloor?: number;
  autonRung?: number;
  autonHighRung?: number;
  teleBasket?: number;
  teleSpeci?: number;
}

export interface SessionCreateRequest {
  info: SessionInfo;
  auto?: AutonData;
  teleop?: TeleopData;
  sessionDuration?: string;
  userId?: string;
  userEmail?: string;
}

export interface SessionResponse extends SessionData {
  id: string;
  createdAt: string;
}
