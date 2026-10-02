import { Fragment, useLayoutEffect, useRef } from 'react';

import { useSessionCore, useTheme } from '@/contexts';

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
  | 'side'
  | 'footer'
  | 'hidden';

/**
 * Where each section sits on a full-size screen: headline and controls on
 * top, then a split view — the live counters and Match Entry on the left,
 * the breakdown and match log pinned on the right, so the running total
 * stays in view while the left column scrolls. The live counters come
 * first: they are what gets tapped while the clock runs. Notes continue the
 * left column on a wide screen — a pinned column can't follow the page past
 * the end of the split, so the split has to run to the end of the page —
 * and sit below everything once the split collapses to one column.
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

  liveScoring: { region: 'main', order: 0 },
  matchEntry: { region: 'main', order: 1 },

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

/**
 * Publishes the sticky site header's height as `--header-h` on the layout
 * root, so the pinned side column can stop below the header instead of
 * sliding underneath it. Measured rather than hard-coded because the header
 * changes height with the breakpoint.
 */
const useHeaderHeightVar = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector('header');
    if (!root || !header) return;

    const publish = () =>
      root.style.setProperty('--header-h', `${header.offsetHeight}px`);
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return rootRef;
};

/**
 * The pinned column can be left scrolled down, by hand or by opening a saved
 * match (which scrolls to the editor under the Match Log). This puts it back
 * at the top when a match starts, so the breakdown's rows aren't under its
 * heading while that match is scored. It is left alone between matches,
 * where the log is what is being used.
 */
const useSideColumnReset = () => {
  const { matchActive } = useSessionCore();
  const sideRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (matchActive && sideRef.current) sideRef.current.scrollTop = 0;
  }, [matchActive]);

  return sideRef;
};

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const rootRef = useHeaderHeightVar();
  const sideRef = useSideColumnReset();

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
    <div ref={rootRef} className="space-y-4">
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

      {main.length > 0 || side.length > 0 ? (
        <>
          <div className="px-4">
            <Divider />
          </div>
          <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
            {main.length > 0 && (
              <div className="flex flex-col gap-5 min-w-0">
                {divided('main')}
              </div>
            )}
            {side.length > 0 && (
              // Pinned below the sticky header, and capped to the space left
              // under it so a long match log scrolls inside the column
              // rather than stopping the column from pinning at all. The
              // cap leaves 1rem above and the page's 3.5rem of bottom
              // padding below, so it still fits with the page scrolled to
              // its very end. The cards must not shrink to fit the cap: the
              // match log clips its overflow, so it would be squeezed shut
              // instead of the column scrolling. `--breakdown-head` has the
              // breakdown keep its heading and total stuck to the top of
              // the column while it scrolls.
              <div
                ref={sideRef}
                className="flex flex-col gap-4 *:shrink-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-[calc(var(--header-h,89px)+1rem)] lg:max-h-[calc(100dvh-var(--header-h,89px)-4.5rem)] lg:overflow-y-auto lg:[--breakdown-head:sticky]"
              >
                {render('side')}
              </div>
            )}
            {footer.length > 0 && (
              <div className="flex flex-col gap-6 min-w-0 lg:col-start-1">
                <Divider />
                {divided('footer')}
              </div>
            )}
          </div>
        </>
      ) : (
        footer.length > 0 && (
          <>
            <div className="px-4">
              <Divider />
            </div>
            <div className="px-4 pb-4 flex flex-col gap-6">
              {divided('footer')}
            </div>
          </>
        )
      )}
    </div>
  );
};
