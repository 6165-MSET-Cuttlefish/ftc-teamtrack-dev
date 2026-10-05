import { useId } from 'react';
import { ELEMENT_LABELS, FIELD_LIMITS } from '@/lib';
import { useActiveShortStacked } from './layout/useActiveCompact';
import { ScoreField } from './ScoreField';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';

/**
 * The counter tapped while the match is running: Tipping. It gets a block of
 * its own — outside Match Entry's Robots section — so the phone layout can
 * keep it next to the clock. A Scrim's fouls are not timed and sit under the
 * robot rows instead (see `MatchEntry`).
 */
export const LiveCounters = () => {
  const {
    sessionData,
    breakdown,
    entryKey,
    tippingEnabled,
    tippingLive,
    handleTipping,
    liveActionFilled,
    lockedReason,
  } = useLiveCounters();
  /**
   * An iPhone SE on its side, where every line counts: Robot 1 has to be
   * above the bar during AUTO. The line saying why Hive Tips is locked is
   * neither shown nor kept there, in any state (so nothing moves at Start):
   * the dimmed counter says it is locked, and screen readers still hear why.
   */
  const shortStacked = useActiveShortStacked();
  const reasonId = useId();
  const silentReason =
    shortStacked && !tippingEnabled ? lockedReason : undefined;

  return (
    // `gap`, not `space-y`: the heading is visually hidden and must not
    // leave its margin behind on the first counter.
    <div className="flex flex-col gap-2" data-tutorial="live">
      {/* For screen readers only, on every layout this is used in (a phone
          either way up): on a phone on its side a visible heading here
          pushed Robot 2 to the bottom edge. */}
      <h2 className="sr-only">Live scoring</h2>
      {/* Room for the line saying why Hive Tips is locked (the 56px row,
          then 20px for the line) is kept for the whole match: the line goes
          when AUTO starts, and the robot rows under it must not jump up
          just as the scorer reaches for Leave. Not on an iPhone SE on its
          side, which has no line to keep (see above). */}
      <div className={shortStacked ? undefined : 'min-h-[4.75rem]'}>
        <ScoreField
          label={ELEMENT_LABELS.tipping}
          // The phone's size on a phone on its side too: the wide-screen
          // size wrapped "Hive Tips" onto two lines there.
          labelClassName="whitespace-nowrap text-sm font-semibold leading-4"
          name="tipping"
          size="large"
          layout="compact"
          stepper
          liveActionLabel="+1 Tip"
          live={tippingLive}
          liveActionFilled={liveActionFilled}
          liveShortcut={TIP_SHORTCUT}
          max={FIELD_LIMITS.tipping}
          value={sessionData.tipping}
          points={breakdown.tipping}
          disabled={!tippingEnabled}
          lockedReason={shortStacked ? undefined : lockedReason}
          lockedReasonId={silentReason ? reasonId : undefined}
          resetKey={entryKey}
          onChange={handleTipping}
        />
        {silentReason && (
          <span id={reasonId} className="sr-only">
            {silentReason}
          </span>
        )}
      </div>
    </div>
  );
};
