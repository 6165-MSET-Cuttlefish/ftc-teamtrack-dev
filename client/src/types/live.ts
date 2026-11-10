import type { MatchScoringFields, ShotVolley } from './session';
import type { SessionClockState } from './storage';

/**
 * Robot 2 as a teammate scores it from their own device in a live session.
 * Only they write it (and the host, to clear it for the next match).
 */
export interface LiveRobot2 {
  /** Who is scoring Robot 2; null when nobody is */
  scorerId: string | null;
  scorerName: string;
  /**
   * The match these values belong to (`LiveSession.matchKey`). Values left
   * over from an earlier match, or written after the host moved on, are
   * ignored.
   */
  match: string;
  leave: boolean;
  parkAuto: boolean;
  parkTeleop: boolean;
  /** Robot 2's volleys, in order (stored without `robot`) */
  shots: Omit<ShotVolley, 'robot'>[];
}

/** Where the host's match stands, for a spectator's clock and locks */
export interface LiveMatchState {
  /** A match is open (started and not yet saved or cancelled) */
  matchActive: boolean;
  /** The host has opened a saved match to fix it: the fields aren't live */
  editing: boolean;
  completed: boolean;
}

/**
 * liveSessions/{hostId}: a session its host shares with their team while
 * scoring it, so teammates can watch along or score Robot 2. One per host;
 * deleted when the host stops sharing or the session ends.
 */
export interface LiveSession {
  hostId: string;
  hostName: string;
  teamId: string;
  sessionName: string;
  sessionType: string;
  matchType: string;
  /** 1-based number of the match being played */
  matchNumber: number;
  /** Names the match being played; changes when one is saved */
  matchKey: string;
  clock: SessionClockState;
  state: LiveMatchState;
  /** The host's fields for the match being played */
  fields: MatchScoringFields;
  /** Final scores of the matches saved so far */
  savedScores: number[];
  robot2: LiveRobot2 | null;
  /** Epoch ms of the host's last write or heartbeat (server time) */
  updatedAt: number;
}
