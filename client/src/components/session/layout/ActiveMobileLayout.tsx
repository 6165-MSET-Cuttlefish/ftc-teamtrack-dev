import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useSessionCore, useTheme } from '@/contexts';

import { useLiveControls } from '../controls/liveControlsContext';
import { visibleBand } from '../controls/scrollUnderHeader';
import {
  slotsInRegion,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';
import { useActiveShortStacked, useActiveSideBySide } from './useActiveCompact';
import { useHeaderHeightVar } from './useHeaderHeightVar';

type Region =
  | 'notice'
  | 'titleRow'
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
 * - `notice` asks about a session left open since an earlier day, above
 *   everything; on any other day it takes no room.
 * - `titleRow` is one row of constant height: the session name (only for a
 *   screen reader while a match runs), then the in-match extras (skip,
 *   discard) and the session menu, always last. The extras come and go
 *   inside that row, so nothing below it moves when they do.
 * - `clock` is the match clock and the one line under it (session time and
 *   the last saved match).
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
  staleNotice: { region: 'notice', order: 0 },

  title: { region: 'titleRow', order: 0 },
  matchExtras: { region: 'titleRow', order: 1 },
  cancelMatch: { region: 'titleRow', order: 2 },
  sessionMenu: { region: 'titleRow', order: 3 },

  timer: { region: 'clock', order: 0 },
  status: { region: 'clock', order: 1 },

  liveScoring: { region: 'live', order: 0 },

  matchEntry: { region: 'scroll', order: 3 },
  breakdown: { region: 'scroll', order: 4 },
  matchLog: { region: 'scroll', order: 5 },
  notes: { region: 'scroll', order: 6 },

  playPause: { region: 'bar', order: 0 },
  primaryAction: { region: 'bar', order: 1 },

  // The desktop's scoring pad: a phone keeps Hive Tips by the clock and the
  // rest of the fields one scroll down instead.
  scoring: { region: 'hidden', order: 0 },
};

/**
 * A phone on its side that is too narrow to put the clock beside the
 * scoring controls (an iPhone SE): stacked, the clock and its line would
 * leave the robot rows under the bar. The line goes, and the clock moves up
 * into the title row (see `ShortStackedTitleRow`), from idle on so nothing
 * moves when a match starts. The header and the bar already say which
 * match is next, running or being edited, and the Match Log has the last
 * one.
 */
const SHORT_STACKED_PLACEMENT: PlacementMap<Region> = {
  ...PLACEMENT,
  status: { region: 'hidden', order: 0 },
};

/** Space kept between the bar and what is kept clear of it, in px */
const LIVE_GAP = 8;

/** What can be pressed or typed in */
const CONTROLS =
  'button, a[href], input, select, textarea, [role="button"], [role="checkbox"]';

const headerBottom = () =>
  document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;

/** True while the page is scrolled to its very end */
const atPageEnd = () =>
  window.scrollY + window.innerHeight >=
  document.documentElement.scrollHeight - 1;

/** Scroll the page down by `by` px, and say how far it actually went */
const scrollDown = (by: number): number => {
  if (by <= 0) return 0;
  const before = window.scrollY;
  window.scrollBy({ top: by, behavior: 'instant' });
  return window.scrollY - before;
};

/** The live counters' buttons, where they are on screen */
const liveButtons = (): DOMRect[] => {
  const live = document.querySelector('[data-tutorial="live"]');
  return live
    ? [...live.querySelectorAll('button')].map(button =>
        button.getBoundingClientRect()
      )
    : [];
};

/**
 * The bar has just grown by `grew` px (a question took the place of its
 * buttons) while the clock may still be running. On a screen as short as a
 * phone on its side that puts it over +1 Tip, still needed while the
 * question waits: scroll the page by as much as keeps the live counters'
 * buttons above it, but never so far that they go under the header. Only
 * if they were clear of the bar before it grew: otherwise the page is where
 * the user scrolled it. Returns how far the page moved, in px, for the
 * scroll back once the question is answered; null when the live counters
 * are not where the bar grew (see `keepControlsClear`).
 */
const keepLiveClear = (bar: HTMLElement, grew: number): number | null => {
  const buttons = liveButtons();
  if (buttons.length === 0) return null;
  const barRect = bar.getBoundingClientRect();
  // Side by side the bar is under the clock's column, not this one.
  const left = Math.min(...buttons.map(b => b.left));
  const right = Math.max(...buttons.map(b => b.right));
  if (right <= barRect.left || left >= barRect.right) return null;

  const top = Math.min(...buttons.map(b => b.top));
  const bottom = Math.max(...buttons.map(b => b.bottom));
  const overlap = bottom + LIVE_GAP - barRect.top;
  if (overlap <= 0 || overlap > grew + LIVE_GAP) return null;
  return scrollDown(Math.min(overlap, top - headerBottom() - LIVE_GAP));
};

/**
 * The bar has just grown by `grew` px over the page, and the question in it
 * must not hide anything that can be pressed: the end of the page, the End
 * of Match (i) buttons at the buzzer. If a control that
 * was on screen above the bar is now under it (or touching it), the page
 * scrolls it clear: at the end of the page by all the bar grew, so the page
 * still ends above the bar as it did; elsewhere by the least that clears
 * it. While the clock runs, never so far that the live counters go under
 * the header. The bar itself doesn't move, so its safe answer stays under
 * the finger. Returns how far the page moved, in px.
 */
const keepControlsClear = (
  bar: HTMLElement,
  grew: number,
  atEnd: boolean,
  scoringLive: boolean
): number => {
  const barRect = bar.getBoundingClientRect();
  const topBefore = barRect.top + grew;
  const bandTop = headerBottom();
  let need = 0;
  for (const control of document.querySelectorAll(CONTROLS)) {
    if (bar.contains(control)) continue;
    const r = control.getBoundingClientRect();
    // On screen above the bar before it grew (a visually hidden one is 1px)
    if (r.width <= 1 || r.height <= 1) continue;
    if (r.top < bandTop || r.bottom > topBefore + 1) continue;
    if (r.right <= barRect.left || r.left >= barRect.right) continue;
    need = Math.max(need, r.bottom + LIVE_GAP - barRect.top);
  }
  if (need <= 0) return 0;

  let by = atEnd ? grew : need;
  const live = scoringLive ? liveButtons() : [];
  if (live.length > 0) {
    const liveTop = Math.min(...live.map(b => b.top));
    if (liveTop >= bandTop) by = Math.min(by, liveTop - bandTop - LIVE_GAP);
  }
  return scrollDown(by);
};

/**
 * The title row of a phone on its side too narrow for two columns, with the
 * clock in the middle of it: [name, or Skip in a match] [digits] [phase ...
 * discard, settings]. The row is no taller than its buttons: the height of
 * a separate clock row is what keeps the robot rows clear of the bar.
 *
 * The clock row (`data-clock-row`) spans the whole row and lays its digits
 * and phase out on this row's three tracks (a subgrid), the digits in the
 * middle one. The outer tracks are equal, so the digits stay in the middle
 * of the screen whatever is beside them; the name gets all of the first
 * track, up to the digits, and the phase starts the third track, with
 * discard and settings at its end. Those two groups are drawn over the
 * clock row (`relative`), which is under them across the whole row.
 */
const ShortStackedTitleRow = ({
  slots,
  clock,
}: {
  slots: ActiveSlots;
  clock: ReactNode;
}) => (
  <div className="order-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 min-h-12">
    <div className="relative col-start-1 row-start-1 flex min-w-0 items-center gap-2">
      {slots.title}
      {slots.matchExtras}
    </div>
    {clock}
    <div className="relative col-start-3 row-start-1 flex min-w-0 items-center justify-end gap-2 justify-self-end">
      {slots.cancelMatch}
      {slots.sessionMenu}
    </div>
  </div>
);

export const ActiveMobileLayout = ({ slots }: { slots: ActiveSlots }) => {
  const { isDarkMode } = useTheme();
  const { matchActive, matchPhase, isTutorialActive } = useSessionCore();
  const { pendingConfirm, editingMatchId } = useLiveControls();
  const rootRef = useHeaderHeightVar();
  // A phone on its side has no height to stack everything in, but has the
  // width to put the clock beside the scoring controls.
  const sideBySide = useActiveSideBySide();
  const shortStacked = useActiveShortStacked();
  /**
   * What decides how the page makes room when the bar grows, kept in step
   * before the bar is measured. `scoringLive`: the live counters are in use
   * (a match before its buzzer, and not the walkthrough's), so the bar
   * growing at the buzzer is not taken for a question. `pageMoves`: the
   * page may scroll for the bar at all; not for the walkthrough, which
   * moves the page itself, nor side by side, where the bar is beside the
   * scrolling column rather than over it.
   */
  const pageRef = useRef({
    scoringLive: false,
    pageMoves: true,
  });
  useLayoutEffect(() => {
    pageRef.current = {
      scoringLive: matchActive && matchPhase !== 'ended' && !isTutorialActive,
      pageMoves: !isTutorialActive && !sideBySide,
    };
  }, [matchActive, matchPhase, isTutorialActive, sideBySide]);

  // A match starts with the page where the last one left it: scrolled down
  // to End of Match at the buzzer, or further, to the Match Log. +1 Tip and
  // the robot toggles would be above the screen when AUTO starts. If they
  // are, the page goes back to the top, as for the first match, as the
  // match starts (during the 3-2-1), so nothing moves once play is on. The
  // walkthrough moves the page itself.
  const wasActiveRef = useRef(matchActive);
  useLayoutEffect(() => {
    const started = matchActive && !wasActiveRef.current;
    wasActiveRef.current = matchActive;
    if (!started || isTutorialActive) return;
    const live = document.querySelector('[data-tutorial="live"]');
    if (live && live.getBoundingClientRect().top < visibleBand().top) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [matchActive, isTutorialActive]);

  // Saving a match (or the changes to a logged one, or dropping them)
  // reshapes the page above its end: the scoring fields empty, the score
  // breakdown folds away, the Match Log gains a row. The browser keeps
  // something in the middle of the screen where it was, which can leave
  // the end of the page (Session Notes) under the bar. A page that was at
  // its end stays there. Where it is is followed as it scrolls and as it
  // changes size, so it is known as of just before the change.
  const atEndRef = useRef(false);
  useEffect(() => {
    const root = rootRef.current;
    const follow = () => {
      atEndRef.current = atPageEnd();
    };
    follow();
    window.addEventListener('scroll', follow, { passive: true });
    const observer = new ResizeObserver(follow);
    if (root) observer.observe(root);
    return () => {
      window.removeEventListener('scroll', follow);
      observer.disconnect();
    };
  }, [rootRef]);
  const editing = editingMatchId !== null;
  const finishingRef = useRef({ matchActive, editing, isTutorialActive });
  useLayoutEffect(() => {
    const was = finishingRef.current;
    finishingRef.current = { matchActive, editing, isTutorialActive };
    const finished =
      (was.matchActive && !matchActive) || (was.editing && !editing);
    // The walkthrough moves the page itself.
    if (!finished || was.isTutorialActive || isTutorialActive) return;
    if (atEndRef.current && !atPageEnd()) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant',
      });
    }
  }, [matchActive, editing, isTutorialActive]);

  const placement = shortStacked ? SHORT_STACKED_PLACEMENT : PLACEMENT;
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  const publishRef = useRef<(() => void) | null>(null);

  // The bar covers the bottom of the page, and its height follows what is in
  // it (a question instead of the buttons), so the page's bottom padding is
  // measured rather than guessed.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!barEl) {
      root.style.removeProperty('--bar-h');
      return;
    }

    let height = barEl.offsetHeight;
    /** A scroll made to keep the page clear of the bar, and where it left it */
    let lifted: { by: number; at: number } | null = null;
    const publish = () => {
      const grew = barEl.offsetHeight - height;
      if (grew === 0) return;
      // Measured before the padding follows the bar
      const atEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 1;
      height = barEl.offsetHeight;
      root.style.setProperty('--bar-h', `${height}px`);
      const { scoringLive, pageMoves } = pageRef.current;
      if (grew > 0 && pageMoves) {
        // While the clock runs the page only moves to keep the live counters
        // out from under the bar: a scorer's thumb may be on +1 Tip, so
        // nothing else is worth moving it for.
        const by = scoringLive
          ? (keepLiveClear(barEl, grew) ?? 0)
          : keepControlsClear(barEl, grew, atEnd, false);
        if (by > 0) lifted = { by, at: window.scrollY };
      } else if (grew < 0 && lifted) {
        // The question is answered: what it scrolled away comes back,
        // unless the page has been moved since.
        if (Math.abs(window.scrollY - lifted.at) <= 1) {
          window.scrollBy({ top: -lifted.by, behavior: 'instant' });
        }
        lifted = null;
      }
    };
    root.style.setProperty('--bar-h', `${height}px`);
    publishRef.current = publish;

    const observer = new ResizeObserver(publish);
    observer.observe(barEl);
    return () => {
      observer.disconnect();
      publishRef.current = null;
    };
  }, [barEl, rootRef]);

  // A question opening or closing changes the bar in the same commit:
  // measured now, before anything is drawn, and before what the answer does
  // next (Count them first scrolls to End of Match on the next frame) reads
  // the page. The observer would only see it after that.
  useLayoutEffect(() => publishRef.current?.(), [pendingConfirm]);

  const present = (region: Region) =>
    slotsInRegion(placement, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  const [title, ...titleRowRest] = slotsInRegion(PLACEMENT, 'titleRow');

  const clock = present('clock').length > 0 && (
    <div
      className={
        shortStacked
          ? // Across the title row, on its tracks (see ShortStackedTitleRow)
            'col-[1/-1] row-start-1 grid grid-cols-subgrid items-center [&>[data-clock-row]]:col-[1/-1] [&>[data-clock-row]]:grid-cols-subgrid'
          : 'order-3 flex flex-col gap-2'
      }
      data-tutorial="timer"
    >
      {render('clock')}
    </div>
  );

  return (
    // Stacked, the two groups below are `contents`: their children are laid
    // out by this column directly and put in reading order with `order-*`
    // (notice, title row, clock, live counters, the rest). Side by side
    // they are the two columns. Either way it is the same tree, so turning
    // the phone doesn't remount the scoring fields and lose what is in them.
    <div
      ref={rootRef}
      className={`px-4 ${shortStacked ? 'pt-1' : 'pt-2'} ${
        sideBySide
          ? // The first column is never narrower than the bar's buttons need
            'grid grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)] items-start gap-x-4'
          : // A phone on its side has no height to spare between sections:
            // stacked, Robot 2 has to clear the bar
            `flex flex-col ${shortStacked ? 'gap-1' : 'gap-3'}`
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
        {present('notice').length > 0 && (
          <div className="order-0 empty:hidden">{render('notice')}</div>
        )}
        {shortStacked ? (
          <ShortStackedTitleRow slots={slots} clock={clock} />
        ) : (
          <>
            <div className="order-1 flex items-center gap-2 min-h-12">
              {/* In a match the name is only for a screen reader: what
                  follows it starts the row, and Discard (pushed to the end)
                  ends it */}
              <div className={matchActive ? 'contents' : 'flex-1 min-w-0'}>
                {slots[title]}
              </div>
              {titleRowRest
                .filter(key => slots[key] != null)
                .map(key => (
                  <Fragment key={key}>{slots[key]}</Fragment>
                ))}
            </div>

            {clock}
          </>
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
          // A rule along its top edge in both layouts: what scrolls under it
          // goes under an edge, rather than being cut off mid-line.
          className={`fixed left-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${
            sideBySide ? 'w-[calc(max(20rem,(100%-3rem)*0.4)+2rem)]' : 'right-0'
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
