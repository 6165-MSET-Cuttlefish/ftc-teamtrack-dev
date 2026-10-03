import type { ReactNode } from 'react';

import {
  LiveControlsContext,
  useLiveControlsState,
  type LiveControlsProps,
} from './liveControlsContext';
import { SessionLimitBanner } from './SessionLimitBanner';

/**
 * Everything the match-control buttons need, mounted once per page.
 *
 * The state lives in a context rather than inside one component because the
 * layouts place the controls apart: on a phone the primary action and pause
 * are in the bar fixed to the bottom of the screen, skip and discard sit by
 * the session name, and the session actions and match log scroll with the
 * page. Mounting those pieces separately must not mean mounting the effects
 * twice — the session-limit query and the leave-page guard each have to run
 * exactly once per page. It is also what lets a question asked by one piece
 * (the discard X) be answered in another (the bar).
 *
 * The session-limit banner is rendered here, above whichever layout the page
 * uses, so it shows on every screen size without either layout knowing.
 */
export const LiveControlsProvider = ({
  children,
  ...props
}: LiveControlsProps & { children: ReactNode }) => {
  const value = useLiveControlsState(props);
  return (
    <LiveControlsContext.Provider value={value}>
      <SessionLimitBanner />
      {children}
    </LiveControlsContext.Provider>
  );
};
