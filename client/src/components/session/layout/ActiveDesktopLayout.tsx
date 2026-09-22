import { Fragment } from 'react';

import { useTheme } from '@/contexts';

import {
  slotsInRegion,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';

type Region = 'headline' | 'actionRow' | 'matchRow' | 'log' | 'body' | 'hidden';

/**
 * Where each section sits on a full-size screen. This reproduces the
 * long-standing single-column page: headline block, action row, in-match
 * controls, match log, then the stacked editing sections.
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

  matchLog: { region: 'log', order: 0 },

  setup: { region: 'body', order: 0 },
  scoring: { region: 'body', order: 1 },
  matchEntry: { region: 'body', order: 2 },
  notes: { region: 'body', order: 3 },
  completionNotice: { region: 'body', order: 4 },
};

/** Thin divider that adapts to the current theme */
const Divider = () => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`h-px mx-4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}
    />
  );
};

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const render = (region: Region) =>
    slotsInRegion(PLACEMENT, region).map(key => (
      <Fragment key={key}>{slots[key]}</Fragment>
    ));

  /** Body sections are separated by dividers, but only where both sides exist. */
  const bodySections = slotsInRegion(PLACEMENT, 'body')
    .filter(key => slots[key] != null)
    .map(key => (
      <Fragment key={key}>
        <Divider />
        <div className="px-4 py-4">{slots[key]}</div>
      </Fragment>
    ));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-4 px-4 py-4" data-tutorial="timer">
        {render('headline')}
      </div>

      <div data-tutorial="controls" className="px-4 py-4">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 w-full">
            {render('actionRow')}
          </div>
          <div className="flex items-center gap-3 flex-wrap empty:hidden">
            {render('matchRow')}
          </div>
          {render('log')}
        </div>
      </div>

      {bodySections}
    </div>
  );
};
