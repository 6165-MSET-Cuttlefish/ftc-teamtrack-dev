import { Fragment } from 'react';

import { useTheme } from '@/contexts';

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
  | 'live'
  | 'main'
  | 'side'
  | 'footer'
  | 'hidden';

/**
 * Where each section sits on a full-size screen: headline and controls on
 * top, Live Scoring in its own full-width row, then a split view — Match
 * Entry on the left, the breakdown and match log pinned on the right — so a
 * whole match can be scored without scrolling. Notes sit below the split.
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

  scoring: { region: 'live', order: 0 },

  matchEntry: { region: 'main', order: 0 },

  breakdown: { region: 'side', order: 0 },
  matchLog: { region: 'side', order: 1 },

  notes: { region: 'footer', order: 0 },
  completionNotice: { region: 'footer', order: 1 },
};

/** Thin divider that adapts to the current theme */
const Divider = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`h-px ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`} />
  );
};

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const present = (region: Region) =>
    slotsInRegion(PLACEMENT, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  /** Sections separated by dividers, but only where both sides exist. */
  const divided = (region: Region) =>
    present(region).map((key, i) => (
      <Fragment key={key}>
        {i > 0 && <Divider />}
        {slots[key]}
      </Fragment>
    ));

  const main = present('main');
  const side = present('side');
  const footer = present('footer');

  return (
    <div className="space-y-4">
      <div className="space-y-2 px-4 pt-2" data-tutorial="timer">
        {render('headline')}
      </div>

      <div data-tutorial="controls" className="px-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 w-full">
          {render('actionRow')}
        </div>
        <div className="flex items-center gap-3 flex-wrap empty:hidden">
          {render('matchRow')}
        </div>
      </div>

      {present('setup').length > 0 && (
        <div className="px-4">{render('setup')}</div>
      )}

      {present('live').length > 0 && (
        <>
          <div className="px-4">
            <Divider />
          </div>
          <div className="px-4">{render('live')}</div>
        </>
      )}

      {(main.length > 0 || side.length > 0) && (
        <>
          <div className="px-4">
            <Divider />
          </div>
          <div className="px-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
            {main.length > 0 && (
              <div className="flex flex-col gap-5 min-w-0">
                {divided('main')}
              </div>
            )}
            {side.length > 0 && (
              <div className="flex flex-col gap-4 lg:sticky lg:top-4">
                {render('side')}
              </div>
            )}
          </div>
        </>
      )}

      {footer.length > 0 && (
        <>
          <div className="px-4">
            <Divider />
          </div>
          <div className="px-4 pb-4 flex flex-col gap-6">
            {divided('footer')}
          </div>
        </>
      )}
    </div>
  );
};
