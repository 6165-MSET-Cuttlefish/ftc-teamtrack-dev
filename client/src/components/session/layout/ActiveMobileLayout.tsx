import { Fragment } from 'react';

import {
  slotsInRegion,
  type ActiveSlotKey,
  type ActiveSlots,
  type PlacementMap,
} from './activeSlots';

type Region = 'fixed' | 'scroll' | 'hidden';

/**
 * Slots that render loose sibling buttons rather than a self-contained block.
 * The desktop layout gathers these into shared rows; here each needs its own
 * wrapping row so the buttons sit side by side and wrap on a narrow screen.
 */
const BUTTON_GROUPS: ReadonlySet<ActiveSlotKey> = new Set([
  'openSetup',
  'primaryAction',
  'sessionActions',
  'playPause',
  'cancelMatch',
  'matchExtras',
]);

/**
 * Slot pairs that render side by side in one row instead of each getting its
 * own. A slot's presence here is the *only* thing that merges its row with a
 * neighbor — grouping is never inferred from two slots simply landing next
 * to each other in `PLACEMENT`. That keeps it safe to insert a new button
 * slot between, say, `playPause` and `cancelMatch` later without it silently
 * being pulled into their row.
 */
const PAIRED_ROWS: readonly (readonly [ActiveSlotKey, ActiveSlotKey])[] = [
  ['playPause', 'cancelMatch'],
];

/**
 * Where each section sits on a phone.
 *
 * `fixed` is the one-screen area: everything needed to run a match without
 * scrolling. That now includes session setup and its toggle — while setup is
 * open there's nothing to score yet, so it's fine for the pane to grow past
 * one screen for that one pre-match step. Everything else scrolls below.
 *
 * The live counters (Tipping and, in a scrim, the fouls) are the only
 * scoring tapped while the clock runs, so they close out the fixed area,
 * right under the match controls. Robots and the end-of-match assessment
 * are in Match Entry, one scroll down. Anything added to `fixed` above the
 * counters pushes them toward the fold on a short phone: if a new section is
 * not required *while a match is running*, it belongs in `scroll`.
 */
const PLACEMENT: PlacementMap<Region> = {
  title: { region: 'fixed', order: 0 },
  openSetup: { region: 'fixed', order: 1 },
  setup: { region: 'fixed', order: 2 },
  timer: { region: 'fixed', order: 3 },
  status: { region: 'fixed', order: 4 },
  primaryAction: { region: 'fixed', order: 5 },
  playPause: { region: 'fixed', order: 6 },
  cancelMatch: { region: 'fixed', order: 7 },
  liveScoring: { region: 'fixed', order: 8 },

  completedActions: { region: 'scroll', order: 0 },
  completionNotice: { region: 'scroll', order: 1 },
  matchExtras: { region: 'scroll', order: 2 },
  matchEntry: { region: 'scroll', order: 3 },
  breakdown: { region: 'scroll', order: 4 },
  notes: { region: 'scroll', order: 5 },
  matchLog: { region: 'scroll', order: 6 },
  sessionActions: { region: 'scroll', order: 7 },
};

/** A single slot, or a `PAIRED_ROWS` group rendered together. */
type RenderUnit = ActiveSlotKey | readonly [ActiveSlotKey, ActiveSlotKey];

/**
 * Collapses adjacent paired slots (see `PAIRED_ROWS`) into single render
 * units. Pairing only fires when both slots are present *and* the second
 * immediately follows the first in `keys` — if either is missing (e.g.
 * `cancelMatch` hidden while `playPause` shows) they fall back to their own
 * rows instead of one silently rendering alone in a two-slot-wide gap.
 */
const toRenderUnits = (keys: ActiveSlotKey[]): RenderUnit[] => {
  const units: RenderUnit[] = [];
  for (let i = 0; i < keys.length; i++) {
    const pair = PAIRED_ROWS.find(([a]) => a === keys[i]);
    if (pair && keys[i + 1] === pair[1]) {
      units.push(pair);
      i++;
    } else {
      units.push(keys[i]);
    }
  }
  return units;
};

export const ActiveMobileLayout = ({ slots }: { slots: ActiveSlots }) => {
  const fixed = toRenderUnits(
    slotsInRegion(PLACEMENT, 'fixed').filter(key => slots[key] != null)
  );
  const scroll = toRenderUnits(
    slotsInRegion(PLACEMENT, 'scroll').filter(key => slots[key] != null)
  );

  const renderUnit = (unit: RenderUnit) => {
    // `typeof`, not `Array.isArray` — the latter's type guard narrows to
    // `any[]`, which loses the tuple's `ActiveSlotKey` element type.
    if (typeof unit !== 'string') {
      return (
        <div key={unit.join('+')} className="flex flex-wrap items-center gap-2">
          {unit.map(key => (
            <Fragment key={key}>{slots[key]}</Fragment>
          ))}
        </div>
      );
    }
    const key = unit;
    return BUTTON_GROUPS.has(key) ? (
      <div
        key={key}
        className="flex flex-wrap items-center gap-2"
        // The tutorial spotlights the controls by this attribute; on desktop
        // it sits on the whole control block, which has no equivalent here.
        data-tutorial={key === 'primaryAction' ? 'controls' : undefined}
      >
        {slots[key]}
      </div>
    ) : (
      <Fragment key={key}>{slots[key]}</Fragment>
    );
  };

  return (
    <div className="flex flex-col">
      {/*
        No forced height here — the pane is exactly as tall as its content.
        "Fits on one screen" only means this content doesn't *exceed* one
        screen; it was never a requirement that it *fill* one, and forcing
        that with `min-h` stranded whatever a shorter phone or a closed
        setup panel left over as a visible gap before Match Entry.
        On the rare device/zoom combination where this content genuinely
        doesn't fit, the page just scrolls a little further, same as it
        would for any other section — that was already true regardless of
        a forced minimum, since a flex column never clips its children to
        fit a height, it only ever grows past one.

        Children stack from the top (no `justify-between`): that utility
        would divide any leftover space into gaps between every child,
        pulling the primary action button away from the timer — not where a
        hand reaching for "Save Match" expects it.
      */}
      {fixed.length > 0 && (
        <section
          className="flex flex-col gap-3 px-4 pt-2 pb-3"
          data-tutorial="timer"
        >
          {fixed.map(renderUnit)}
        </section>
      )}

      {scroll.length > 0 && (
        <section className="flex flex-col gap-6 px-4 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
          {scroll.map(renderUnit)}
        </section>
      )}
    </div>
  );
};
