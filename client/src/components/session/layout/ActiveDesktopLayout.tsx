import { Fragment } from 'react';

import { useSessionCore, useTheme } from '@/contexts';

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
 * The controls are one row, as tall as its buttons in every state, so the
 * scoring fields below it stay where they are from idle to the buzzer and
 * still start high enough to be on a short laptop screen:
 *
 * - `bar` is pause and the one button that drives the match (start, end
 *   early, save), and takes the row's spare width.
 * - `barTools` is skip (while it applies) and the settings toggle.
 * - `barEnd`, past a divider, is what is not part of playing the match:
 *   discard while one runs, the session's own buttons between matches.
 *
 * The session's buttons are never in the row with Save, the match's or a
 * saved match's being edited (see `placementFor`).
 */
const PLACEMENT: PlacementMap<Region> = {
  title: { region: 'headline', order: 0 },
  timer: { region: 'headline', order: 1 },
  status: { region: 'headline', order: 2 },
  // The match log is a short scroll below the fields
  lastMatch: { region: 'hidden', order: 0 },

  playPause: { region: 'bar', order: 0 },
  primaryAction: { region: 'bar', order: 1 },
  matchExtras: { region: 'barTools', order: 0 },
  openSetup: { region: 'barTools', order: 1 },
  sessionActions: { region: 'barEnd', order: 0 },
  cancelMatch: { region: 'barEnd', order: 1 },

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
};

/**
 * While a match runs, completing or discarding the session is not something
 * to have next to the buttons being pressed: they go to the end of the page
 * until the match is saved. The same goes while a saved match is open for
 * editing, whose Save and Discard changes would otherwise be squeezed past
 * their labels by the session's two wide buttons on a tablet. Nothing else
 * belongs past the divider then (there is no match in play to discard), so
 * the row ends at the settings toggle.
 */
const placementFor = ({
  matchActive,
  editing,
}: {
  matchActive: boolean;
  editing: boolean;
}): PlacementMap<Region> =>
  editing
    ? {
        ...PLACEMENT,
        sessionActions: { region: 'footer', order: 1 },
        cancelMatch: { region: 'hidden', order: 0 },
      }
    : matchActive
      ? { ...PLACEMENT, sessionActions: { region: 'footer', order: 1 } }
      : PLACEMENT;

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

export const ActiveDesktopLayout = ({ slots }: { slots: ActiveSlots }) => {
  const { isDarkMode } = useTheme();
  const { matchActive, editingMatchId } = useSessionCore();
  const rootRef = useHeaderHeightVar();
  const pinned = usePinnedControls();
  const placement = placementFor({
    matchActive,
    editing: editingMatchId !== null,
  });

  const present = (region: Region) =>
    slotsInRegion(placement, region).filter(key => slots[key] != null);

  const render = (region: Region) =>
    present(region).map(key => <Fragment key={key}>{slots[key]}</Fragment>);

  /** Sections separated by dividers, but only where both sides exist. */
  const divided = (region: Region) =>
    present(region).map((key, i) => (
      <Fragment key={key}>
        {i > 0 && <Divider />}
        {key === 'sessionActions' ? (
          // A run of buttons rather than a section: laid out as a row
          <div className="flex items-center gap-3 flex-wrap">{slots[key]}</div>
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
  // While a saved match is open the row is Save, Discard changes and the
  // settings toggle, all one height, and the warning about unsaved changes
  // can wrap under the first two: the toggle stays level with the buttons
  // rather than centring on the pair and the warning.
  const controlsAlign =
    editingMatchId !== null ? 'items-start' : 'items-center';

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
          data-tutorial="controls"
          className={`px-4 flex flex-wrap ${controlsAlign} gap-3 ${
            pinned
              ? // The page shows through nowhere around it: the band of
                // background reaches the gaps above and below the row too,
                // and ends in a rule like the header's. Both are inherited,
                // so the themes that recolour the page recolour them.
                `sticky top-[var(--header-h,89px)] z-20 before:absolute before:inset-x-0 before:-inset-y-2 before:-z-10 before:border-b before:bg-inherit before:border-inherit ${
                  isDarkMode
                    ? 'bg-team-dark border-team-white-20'
                    : 'bg-[#FEFEFE] border-team-blue/60'
                }`
              : ''
          }`}
        >
          {/* Wraps the rest of the row under it rather than being squeezed
              past its labels; only a question asked here makes it wrap. */}
          <div className="flex-1 min-w-48 flex flex-wrap items-center gap-2">
            {render('bar')}
          </div>
          {render('barTools')}
          {barEnd.length > 0 && (
            <>
              <Divider vertical />
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
        <div className="px-4 pb-4 flex flex-col gap-6 min-w-0">
          <Divider />
          {divided('footer')}
        </div>
      )}
    </div>
  );
};
