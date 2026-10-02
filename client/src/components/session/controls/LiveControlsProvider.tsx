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
 * compact layout splits the controls across two panes: the primary action
 * sits in the fixed one-screen area beside the timer and scoring, while the
 * session actions, match extras and match log scroll below it. Mounting
 * those pieces separately must not mean mounting the effects twice — the
 * session-limit query and the leave-page guard each have to run exactly once
 * per page.
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
