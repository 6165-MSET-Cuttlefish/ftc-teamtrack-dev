import { Fragment, useLayoutEffect, useRef, useState } from 'react';

import { useSessionCore, useTheme } from '@/contexts';

import {
  slotsInRegion,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';
import { useActiveShortStacked, useActiveSideBySide } from './useActiveCompact';
import { useHeaderHeightVar } from './useHeaderHeightVar';

type Region =
  | 'titleRow'
  | 'setup'
  | 'clock'
  | 'live'
  | 'scroll'
  | 'bar'
  | 'hidden';

/**
 * Where each section sits on a phone.
 *
 * The goal is one view while a match runs: the clock and its phase, the
 * scoring controls and the button that moves the match forward, all on
 * screen together, and none of it changing position as the match goes from
 * idle to the buzzer.
 *
 * - `titleRow` is one row of constant height: the session name, then the
 *   in-match extras (skip, discard) and the settings toggle. The extras come
 *   and go inside that row, so nothing below it moves when they do.
 * - `setup` is the settings panel, under the toggle that opens it. It only
 *   exists before a match, when there is nothing to score yet.
 * - `clock` is the match clock, its status line and the last saved match.
 * - `live` is what gets tapped while the clock runs. Match Entry — the first
 *   thing in `scroll` — follows it closely, so the robot rows sit right
 *   under the live counters.
 * - `bar` is pinned to the bottom of the screen, in thumb reach: pause, and
 *   the one button that drives the match (start, end early, save). Discard
 *   is deliberately not in it.
 *
 * Anything added above `live` pushes the scoring controls toward the fold on
 * a short phone: if a new section is not required *while a match is
 * running*, it belongs in `scroll`.
 */
const PLACEMENT: PlacementMap<Region> = {
  title: { region: 'titleRow', order: 0 },
  matchExtras: { region: 'titleRow', order: 1 },
  cancelMatch: { region: 'titleRow', order: 2 },
  openSetup: { region: 'titleRow', order: 3 },

  setup: { region: 'setup', order: 0 },

  timer: { region: 'clock', order: 0 },
  status: { region: 'clock', order: 1 },
  lastMatch: { region: 'clock', order: 2 },

  liveScoring: { region: 'live', order: 0 },

  completionNotice: { region: 'scroll', order: 0 },
  completedActions: { region: 'scroll', order: 1 },
  completedLinks: { region: 'scroll', order: 2 },
  matchEntry: { region: 'scroll', order: 3 },
  breakdown: { region: 'scroll', order: 4 },
  matchLog: { region: 'scroll', order: 5 },
  notes: { region: 'scroll', order: 6 },
  sessionActions: { region: 'scroll', order: 7 },

  playPause: { region: 'bar', order: 0 },
  primaryAction: { region: 'bar', order: 1 },

  // The desktop's scoring pad: a phone keeps Hive Tips by the clock and the
  // rest of the fields one scroll down instead.
  scoring: { region: 'hidden', order: 0 },
};

/**
 * A phone on its side that is too narrow to put the clock beside the
 * scoring controls (an iPhone SE): stacked, the clock and its two lines would
 * leave the live counters under the bar. The lines go, from idle on so
 * nothing moves when a match starts. The header and the bar already say
 * which match is next, running or being edited, and the Match Log has the
 * last one.
 */
const SHORT_STACKED_PLACEMENT: PlacementMap<Region> = {
  ...PLACEMENT,
  status: { region: 'hidden', order: 0 },
  lastMatch: { region: 'hidden', order: 1 },
};

/** Space kept between the live counters and the bar over them, in px */
const LIVE_GAP = 8;

/**
 * The bar has just grown by `grew` px (a question took the place of its
 * buttons) while the clock may still be running. On a screen as short as a
 * phone on its side that puts it over +1 Tip, still needed while the
 * question waits: scroll the page by as much as keeps the live counters'
 * buttons above it, but never so far that they go under the header. Only
 * if they were clear of the bar before it grew: otherwise the page is where
 * the user scrolled it. Returns how far the page moved, in px, for the
 * scroll back once the question is answered.
 */
const keepLiveClear = (bar: HTMLElement, grew: number): number => {
  const live = document.querySelector('[data-tutorial="live"]');
  if (!live) return 0;
  const buttons = [...live.querySelectorAll('button')].map(button =>
    button.getBoundingClientRect()
  );
  if (buttons.length === 0) return 0;
  const barRect = bar.getBoundingClientRect();
  // Side by side the bar is under the clock's column, not this one.
  const left = Math.min(...buttons.map(b => b.left));
  const right = Math.max(...buttons.map(b => b.right));
  if (right <= barRect.left || left >= barRect.right) return 0;

  const top = Math.min(...buttons.map(b => b.top));
  const bottom = Math.max(...buttons.map(b => b.bottom));
  const overlap = bottom + LIVE_GAP - barRect.top;
  if (overlap <= 0 || overlap > grew + LIVE_GAP) return 0;
  const headerBottom =
    document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
  const by = Math.min(overlap, top - headerBottom - LIVE_GAP);
  if (by <= 0) return 0;
  const before = window.scrollY;
  window.scrollBy({ top: by, behavior: 'instant' });
  return window.scrollY - before;
};

export const ActiveMobileLayout = ({ slots }: { slots: ActiveSlots }) => {
  const { isDarkMode } = useTheme();
  const { matchActive, matchPhase, isTutorialActive } = useSessionCore();
  const rootRef = useHeaderHeightVar();
  /**
   * True while the live counters are in use: a match before its buzzer, and
   * not the walkthrough's, which moves the page itself. Kept in step before
   * the bar is measured, so the bar growing at the buzzer is not taken for
   * a question.
   */
  const scoringLiveRef = useRef(false);
  useLayoutEffect(() => {
    scoringLiveRef.current =
      matchActive && matchPhase !== 'ended' && !isTutorialActive;
  }, [matchActive, matchPhase, isTutorialActive]);
  // A phone on its side has no height to stack everything in, but has the
  // width to put the clock beside the scoring controls.
  const sideBySide = useActiveSideBySide();
  const placement = useActiveShortStacked()
    ? SHORT_STACKED_PLACEMENT
    : PLACEMENT;
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);

  // The bar covers the bottom of the page, and its height follows what is in
  // it (a hint line after the buzzer, a question instead of the buttons), so
  // the page's bottom padding is measured rather than guessed.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!barEl) {
      root.style.removeProperty('--bar-h');
      return;
    }

    let height = barEl.offsetHeight;
    /** A scroll made for the live counters, and where it left the page */
    let lifted: { by: number; at: number } | null = null;
    const publish = () => {
      const grew = barEl.offsetHeight - height;
      height = barEl.offsetHeight;
      root.style.setProperty('--bar-h', `${height}px`);
      if (grew > 0 && scoringLiveRef.current) {
        const by = keepLiveClear(barEl, grew);
        if (by > 0) lifted = { by, at: window.scrollY };
      } else if (grew < 0 && lifted) {
        // The question is answered: the rows it scrolled away (skip,
        // discard, settings) come back, unless the page has been moved
        // since.
        if (Math.abs(window.scrollY - lifted.at) <= 1) {
          window.scrollBy({ top: -lifted.by, behavior: 'instant' });
        }
        lifted = null;
      }
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(barEl);
    return () => observer.disconnect();
  }, [barEl, rootRef]);

  const present = (region: Region) =>
    slotsInRegion(placement, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  const [title, ...titleRowRest] = slotsInRegion(PLACEMENT, 'titleRow');

  return (
    // Stacked, the two groups below are `contents`: their children are laid
    // out by this column directly and put in reading order with `order-*`
    // (title row, settings, clock, live counters, the rest). Side by side
    // they are the two columns. Either way it is the same tree, so turning
    // the phone doesn't remount the scoring fields and lose what is in them.
    <div
      ref={rootRef}
      className={`px-4 pt-2 ${
        sideBySide
          ? // The first column is never narrower than the bar's buttons need
            'grid grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)] items-start gap-x-4'
          : 'flex flex-col gap-3'
      }`}
    >
      <div
        className={
          sideBySide
            ? // Stays beside the scoring fields as they scroll. The header is
              // only pinned while a match runs (see Header), which is when
              // this has to stop below it.
              `sticky flex flex-col gap-2 ${matchActive ? 'top-[calc(var(--header-h,3.25rem)+0.25rem)]' : 'top-1'}`
            : 'contents'
        }
      >
        <div className="order-1 flex items-center gap-2 min-h-12">
          <div className="flex-1 min-w-0">{slots[title]}</div>
          {titleRowRest
            .filter(key => slots[key] != null)
            .map(key => (
              <Fragment key={key}>{slots[key]}</Fragment>
            ))}
        </div>

        {present('clock').length > 0 && (
          <div className="order-3 flex flex-col gap-2" data-tutorial="timer">
            {render('clock')}
          </div>
        )}
      </div>

      {/*
        Pinned to the bottom of the screen, so where it sits in the tree
        only decides when the keyboard reaches it: after the clock, before
        the scoring fields. Nothing above it may be transformed, or it would
        be pinned to that element instead of the screen. It is not inside
        the group above either: side by side that group is pinned, which
        makes it a layer of its own, and the scoring fields (later in the
        page) would be drawn over a bar that belonged to it.

        Side by side it only spans the clock's column (the same width as the
        grid gives that column, plus the gutters), under the clock: a screen
        that short has no height to give up across the scoring fields.
      */}
      {present('bar').length > 0 && (
        <div
          ref={setBarEl}
          data-tutorial="controls"
          className={`fixed left-0 bottom-0 z-30 flex flex-wrap items-center gap-2 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${
            sideBySide
              ? 'w-[calc(max(20rem,(100%-3rem)*0.4)+2rem)]'
              : 'right-0 border-t'
          } ${
            isDarkMode
              ? 'bg-team-dark border-team-white-20'
              : 'bg-[#FEFEFE] border-team-blue/60'
          }`}
        >
          {render('bar')}
        </div>
      )}

      <div className={sideBySide ? 'flex flex-col gap-3 min-w-0' : 'contents'}>
        {present('setup').length > 0 && (
          <div className="order-2">{render('setup')}</div>
        )}

        {present('live').length > 0 && (
          <div className="order-4">{render('live')}</div>
        )}

        {present('scroll').length > 0 && (
          <section
            className={`order-5 flex flex-col gap-6 ${
              // Side by side the bar is beside this column, not over it
              sideBySide
                ? 'pb-[calc(env(safe-area-inset-bottom)+2rem)]'
                : 'pb-[calc(var(--bar-h,env(safe-area-inset-bottom))+2rem)]'
            }`}
          >
            {render('scroll')}
          </section>
        )}
      </div>
    </div>
  );
};
