import { createContext, useContext } from 'react';

/** The session's live sharing, as the scoring page sees it */
export interface LiveHost {
  /** Sharing is possible: signed in, and in a team */
  available: boolean;
  /** Why it isn't, for the menu */
  unavailableReason: string | null;
  /** The session is being shared with the team right now */
  live: boolean;
  /** Going live or stopping is under way */
  busy: boolean;
  /** Who is scoring Robot 2 from their own device, if anyone */
  robot2Scorer: string | null;
  goLive: () => Promise<void>;
  stopLive: () => Promise<void>;
}

const OFF: LiveHost = {
  available: false,
  unavailableReason: null,
  live: false,
  busy: false,
  robot2Scorer: null,
  goLive: async () => {},
  stopLive: async () => {},
};

export const LiveHostContext = createContext<LiveHost>(OFF);

/** Off (nothing shared) anywhere outside the scoring page */
export const useLiveHost = (): LiveHost => useContext(LiveHostContext);

/** Why Robot 2's toggles take nothing while a teammate scores it */
export const robot2ScoredBy = (name: string): string =>
  `Robot 2 is being scored live by ${name}`;
