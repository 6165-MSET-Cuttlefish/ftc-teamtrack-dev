import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { useSessionCore, useTheme } from '@/contexts';

import {
  isPrimarySlotConfirm,
  useLiveControls,
} from '../controls/liveControlsContext';
import { revealInView, visibleBand } from '../controls/scrollUnderHeader';

import {
  slotsInRegion,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';
import { useHeaderHeightVar } from './useHeaderHeightVar';

type Region =
  | 'headline'
  | 'bar'
  | 'barTools'
  | 'barEnd'
  | 'completed'
  | 'setup'
  | 'main'
  | 'footer'
  | 'hidden';

/**
 * Where each section sits on a full-size screen: one column, top to bottom.
 * The centered title, clock and status, then one row of controls, then the
 * scoring pad across the full width (Hive Tips, the robots and a scrim's
 * fouls in one band, the end-of-match fields under it, its breakdown band
 * last), then the match log and notes below the fold.
 *
 * The controls are one row, as tall as its buttons in every state (a
 * question asked there included), so the scoring fields below it stay
 * where they are from idle to the buzzer and still start high enough to be
 * on a short laptop screen:
 *
 * - `bar` is pause and the one button that drives the match (start, end
 *   early, save), and takes the row's spare width.
 * - `barTools` is skip (while it applies) and the settings toggle (between
 *   matches).
 * - `barEnd`, past a divider, is discarding the match while one runs.
 *
 * A question about the match takes the row's full width: the tools and
 * the divider give up their places to it, and its safe answer reaches the
 * row's end.
 *
 * The session's own buttons (Complete, Discard Session) are at the end of
 * the page under the Match Log, as on a phone: never in the row, so Start
 * is one width for every match and nothing beside it throws the session
 * away.
 */
const PLACEMENT: PlacementMap<Region> = {
  title: { region: 'headline', order: 0 },
  timer: { region: 'headline', order: 1 },
  status: { region: 'headline', order: 2 },

  playPause: { region: 'bar', order: 0 },
  primaryAction: { region: 'bar', order: 1 },
  matchExtras: { region: 'barTools', order: 0 },
  openSetup: { region: 'barTools', order: 1 },
  cancelMatch: { region: 'barEnd', order: 0 },

  completionNotice: { region: 'completed', order: 0 },
  completedActions: { region: 'completed', order: 1 },
  completedLinks: { region: 'completed', order: 2 },

  setup: { region: 'setup', order: 0 },

  scoring: { region: 'main', order: 0 },
  matchLog: { region: 'main', order: 1 },

  // The pad carries its own counters and breakdown band; the phone layout
  // still uses these.
  liveScoring: { region: 'hidden', order: 1 },
  matchEntry: { region: 'hidden', order: 2 },
  breakdown: { region: 'hidden', order: 3 },

  notes: { region: 'footer', order: 0 },
  sessionActions: { region: 'footer', order: 1 },
};

/** Thin divider that adapts to the current theme */
const Divider = ({ vertical = false }: { vertical?: boolean }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      aria-hidden={vertical || undefined}
      className={`${vertical ? 'w-px h-8 shrink-0' : 'h-px'} ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}
    />
  );
};

/**
 * After the buzzer the scorer counts the end-of-match fields, which can be
 * further down than a short laptop screen reaches from the controls, and
 * then saves. So the controls row (Save, from then on) stays pinned under
 * the site header until the match is saved, rather than costing a scroll
 * back up for every match.
 */
const usePinnedControls = () => {
  const { matchActive, matchPhase } = useSessionCore();
  return matchActive && matchPhase === 'ended';
};

/**
 * Whether the pinned row is actually stuck under the header, rather than
 * pinned but still in its own place (the page not scrolled that far): only
 * then does it need an edge between it and what scrolls under it.
 */
const useStuck = (
  rowRef: RefObject<HTMLDivElement | null>,
  pinned: boolean
): boolean => {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const row = rowRef.current;
    if (!pinned || !row) return;
    let observer: IntersectionObserver | null = null;
    // Stuck, its top is at `top`: watch for it to cross a line just under
    // that. Rebuilt when the window resizes, which can change the header.
    const observe = () => {
      observer?.disconnect();
      const top = parseFloat(getComputedStyle(row).top) || 0;
      observer = new IntersectionObserver(
        ([entry]) =>
          setStuck(
            entry.intersectionRatio < 1 &&
              entry.boundingClientRect.top <= top + 1
          ),
        { threshold: [1], rootMargin: `-${Math.ceil(top) + 1}px 0px 0px 0px` }
      );
      observer.observe(row);
    };
    observe();
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, [rowRef, pinned]);
  return pinned && stuck;
};

/**
 * As the match is saved (or discarded) the row stops being pinned and goes
 * back to its place at the top of the page, which may be well above the
 * screen if the end-of-match fields were further down. The page follows
 * it, before anything is drawn, so Start Match lands where Save was.
 */
const useFollowUnpinnedRow = (
  rowRef: RefObject<HTMLDivElement | null>,
  pinned: boolean
) => {
  const wasPinnedRef = useRef(pinned);
  useLayoutEffect(() => {
    const unpinned = wasPinnedRef.current && !pinned;
    wasPinnedRef.current = pinned;
    const row = rowRef.current;
    if (!unpinned || !row) return;
    if (row.getBoundingClientRect().top < visibleBand().top) {
      revealInView(row);
    }
  }, [rowRef, pinned]);
};

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const { isDarkMode } = useTheme();
  const { matchActive, editingMatchId } = useSessionCore();
  const { pendingConfirm } = useLiveControls();
  const rootRef = useHeaderHeightVar();
  const rowRef = useRef<HTMLDivElement>(null);
  const pinned = usePinnedControls();
  const stuck = useStuck(rowRef, pinned);
  useFollowUnpinnedRow(rowRef, pinned);
  // A question about the match is asked in the row: the tools give up
  // their places to it (see `MatchControls`), and the divider goes with
  // them, so the question spans the row.
  const rowQuestion = isPrimarySlotConfirm(pendingConfirm, false);

  const present = (region: Region) =>
    slotsInRegion(PLACEMENT, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  /**
   * The footer's sections, apart by its gap alone: Notes and the Match Log
   * above it have their own edges, and a rule between boxes only piles up.
   */
  const footerSections = () =>
    present('footer').map(key => (
      <Fragment key={key}>
        {key === 'sessionActions' ? (
          // A run of buttons rather than a section: laid out as a row. A
          // question asked in place of them takes the whole row, so its
          // go-ahead is never where Discard Session or Complete Session was
          // pressed (see `SessionActions` for where the safe choice goes).
          <div className="flex items-center gap-3 flex-wrap [&>[data-confirm-inline]]:flex-1">
            {slots[key]}
          </div>
        ) : (
          slots[key]
        )}
      </Fragment>
    ));

  const main = present('main');
  const footer = present('footer');
  const barEnd = present('barEnd');
  const hasControls =
    present('bar').length > 0 ||
    present('barTools').length > 0 ||
    barEnd.length > 0;
  // Discard is only there while a match runs (and isn't one being edited)
  const discardShown =
    barEnd.length > 0 && matchActive && editingMatchId === null;

  return (
    // A laptop screen is often under 760px tall: the spacing tightens there
    // so the robot rows still start above the fold.
    <div
      ref={rootRef}
      className="space-y-4 [@media(max-height:760px)]:space-y-3"
    >
      <div
        className="space-y-2 px-4 pt-2 [@media(max-height:760px)]:space-y-1"
        data-tutorial="timer"
      >
        {render('headline')}
      </div>

      {present('completed').length > 0 && (
        <div className="px-4 flex flex-col gap-6">{render('completed')}</div>
      )}

      {hasControls && (
        <div
          ref={rowRef}
          data-tutorial="controls"
          className={`px-4 flex flex-wrap items-center gap-3 ${
            pinned
              ? // Stops a band's depth under the header: the page shows
                // through nowhere around it, as the band of background
                // reaches the gaps above and below the row too. It is the
                // page's own colour, so it only shows once it is stuck and
                // things scroll under it: then it spans the screen like the
                // header and ends in the header's rule and a soft shadow.
                // The colours are inherited, so the themes that recolour the
                // page recolour them.
                `sticky top-[calc(var(--header-h,89px)+0.5rem)] z-20 before:absolute before:inset-x-0 before:-inset-y-2 before:-z-10 before:bg-inherit ${
                  isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
                } ${
                  stuck
                    ? `before:shadow-[0_0_0_100vmax_hsl(var(--background))] before:[clip-path:inset(0_-100vmax)] after:absolute after:inset-x-0 after:-bottom-2 after:h-px after:bg-current after:shadow-[0_0_0_100vmax_currentColor] after:[clip-path:inset(0_-100vmax)] ${
                        isDarkMode
                          ? 'after:text-team-white-20 [filter:drop-shadow(0_6px_6px_rgb(0_0_0/0.45))]'
                          : 'after:text-team-blue/60 [filter:drop-shadow(0_6px_6px_rgb(0_0_0/0.12))]'
                      }`
                    : ''
                }`
              : ''
          }`}
        >
          {/* One line, so the fields under the row never move: a question
              asked here keeps to the row's height. A size container: Pause
              drops its label beside a question when this is short (a
              tablet held upright). */}
          <div className="flex-1 min-w-48 flex items-center gap-2 [container-type:inline-size]">
            {render('bar')}
          </div>
          {render('barTools')}
          {discardShown && (
            <>
              {!rowQuestion && (
                <div className="flex self-center">
                  <Divider vertical />
                </div>
              )}
              {render('barEnd')}
            </>
          )}
        </div>
      )}

      {present('setup').length > 0 && (
        <div className="px-4">{render('setup')}</div>
      )}

      {main.length > 0 && (
        // No divider above: the pad starts right under the controls. The
        // match log follows it after a gap.
        <div className="px-4 flex flex-col gap-8 min-w-0">{render('main')}</div>
      )}

      {footer.length > 0 && (
        // As far below the Match Log as its own sections are apart, as on
        // a phone
        <div className="px-4 pt-2 pb-4 flex flex-col gap-6 min-w-0">
          {footerSections()}
        </div>
      )}
    </div>
  );
};
