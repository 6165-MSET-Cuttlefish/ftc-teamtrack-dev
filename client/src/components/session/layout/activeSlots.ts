import type { ReactNode } from 'react';

/**
 * Every region of the active-session page, named once.
 *
 * Adding a key here is a deliberate change: each layout holds a
 * `SlotPlacement` record keyed by this union, so a new section will not
 * compile until every layout says where it goes — including saying `hidden`.
 * That is the mechanism that stops the compact one-screen layout from
 * quietly acquiring an extra section and pushing the scoring fields off the
 * screen when someone adds a feature months from now.
 *
 * To add a section: add the key here, supply its node in `Active.tsx`, then
 * fix the two type errors the compiler raises in the layouts.
 */
export type ActiveSlotKey =
  | 'title'
  | 'timer'
  | 'status'
  | 'openSetup'
  | 'primaryAction'
  | 'sessionActions'
  | 'playPause'
  | 'cancelMatch'
  | 'matchExtras'
  | 'matchLog'
  | 'setup'
  | 'liveScoring'
  | 'matchEntry'
  | 'breakdown'
  | 'notes'
  | 'completedActions'
  | 'completionNotice';

/**
 * The rendered content for each slot. A slot whose section is not currently
 * applicable supplies `null` — whether a section exists is the page's call,
 * where it goes is the layout's.
 */
export type ActiveSlots = Record<ActiveSlotKey, ReactNode>;

export interface SlotPlacement<Region extends string> {
  region: Region;
  /** Sort position within the region; gaps are fine. */
  order: number;
}

export type PlacementMap<Region extends string> = Record<
  ActiveSlotKey,
  SlotPlacement<Region>
>;

/** Slot keys assigned to `region`, in their declared order. */
export const slotsInRegion = <Region extends string>(
  placement: PlacementMap<Region>,
  region: Region
): ActiveSlotKey[] =>
  (Object.keys(placement) as ActiveSlotKey[])
    .filter(key => placement[key].region === region)
    .sort((a, b) => placement[a].order - placement[b].order);
