import { useId } from 'react';
import { ELEMENT_LABELS, FIELD_LIMITS } from '@/lib';
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
  const reasonId = useId();
  /**
   * Why Hive Tips is locked (before Start, and in the 3-2-1) is read out,
   * not shown: the locked look and the lock on +1 Tip say it is locked, and
   * Start, the one filled button, says what unlocks it. No line is kept for
   * it either, so the robot rows sit right under the counter in every
   * state and nothing moves when it unlocks.
   */
  const silentReason = tippingEnabled ? undefined : lockedReason;

  return (
    // `gap`, not `space-y`: the heading is visually hidden and must not
    // leave its margin behind on the first counter.
    <div className="flex flex-col gap-2" data-tutorial="live">
      {/* For screen readers only, on every layout this is used in (a phone
          either way up): on a phone on its side a visible heading here
          pushed Robot 2 to the bottom edge. */}
      <h2 className="sr-only">Live scoring</h2>
      <div>
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
