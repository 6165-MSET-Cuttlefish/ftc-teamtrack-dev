import type { ReactNode } from 'react';

import {
  LiveControlsContext,
  useLiveControlsState,
  type LiveControlsProps,
} from './liveControlsContext';

/**
 * Everything the match-control buttons need, mounted once per page.
 *
 * The state lives in a context rather than inside one component because the
 * layouts place the controls apart: on a phone the primary action and pause
 * are in the bar fixed to the bottom of the screen, skip and discard sit by
 * the session name, and the session actions and match log scroll with the
 * page. Mounting those pieces separately must not mean mounting the effects
 * twice — the leave-page guard has to run exactly once per page. It is also
 * what lets a question asked by one piece (the discard X) be answered in
 * another (the bar).
 */
export const LiveControlsProvider = ({
  children,
  ...props
}: LiveControlsProps & { children: ReactNode }) => {
  const value = useLiveControlsState(props);
  return (
    <LiveControlsContext.Provider value={value}>
      {children}
    </LiveControlsContext.Provider>
  );
};
