import { Fragment } from 'react';

import {
  slotsInRegion,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';

type Region =
  | 'headline'
  | 'actionRow'
  | 'matchRow'
  | 'setup'
  | 'main'
  | 'footer'
  | 'hidden';

/**
 * Where each section sits on a full-size screen: one column, top to bottom.
 * The centered title, clock and status, then one row of buttons, then the
 * scoring pad across the full width (its breakdown band is part of it), then
 * the match log and notes below the fold.
 *
 * The in-match controls (pause, skip, cancel match) join the button row
 * beside the primary action instead of opening a row of their own, which is
 * what keeps the whole pad on screen while a match runs.
 */
const PLACEMENT: PlacementMap<Region> = {
  title: { region: 'headline', order: 0 },
  timer: { region: 'headline', order: 1 },
  status: { region: 'headline', order: 2 },

  primaryAction: { region: 'actionRow', order: 0 },
  openSetup: { region: 'actionRow', order: 1 },
  sessionActions: { region: 'actionRow', order: 2 },
  completedActions: { region: 'actionRow', order: 3 },

  playPause: { region: 'matchRow', order: 0 },
  matchExtras: { region: 'matchRow', order: 1 },
  cancelMatch: { region: 'matchRow', order: 2 },

  setup: { region: 'setup', order: 0 },

  scoring: { region: 'main', order: 0 },
  matchLog: { region: 'main', order: 1 },

  // The pad carries its own breakdown band and its own counters; the
  // phone layout still uses these.
  breakdown: { region: 'hidden', order: 0 },
  liveScoring: { region: 'hidden', order: 1 },
  matchEntry: { region: 'hidden', order: 2 },

  notes: { region: 'footer', order: 0 },
  completionNotice: { region: 'footer', order: 1 },
};

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const present = (region: Region) =>
    slotsInRegion(PLACEMENT, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  return (
    <div className="flex flex-col gap-5 px-4 pt-1 pb-4">
      <div className="flex flex-col gap-1" data-tutorial="timer">
        {render('headline')}
      </div>

      {/*
        One row: the primary action, then the in-match controls when a match
        is running, then settings and the session buttons. Stretched so the
        smaller match controls take the row's full height. The primary
        action gives up width first; during AUTO, with all three match
        controls showing, it still keeps 6rem.
      */}
      <div
        data-tutorial="controls"
        className="flex w-full items-stretch gap-2 [&>*]:shrink-0 [&>*:first-child]:min-w-24 [&>*:first-child]:shrink"
      >
        {render('actionRow').slice(0, 1)}
        {render('matchRow')}
        {render('actionRow').slice(1)}
      </div>

      {present('setup').length > 0 && <div>{render('setup')}</div>}

      {present('main').length > 0 && (
        <div className="flex min-w-0 flex-col gap-8">
          {render('main')}
        </div>
      )}

      {present('footer').length > 0 && (
        <div className="mt-6 flex min-w-0 flex-col gap-6">
          {render('footer')}
        </div>
      )}
    </div>
  );
};
