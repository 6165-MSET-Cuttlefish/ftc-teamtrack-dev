import { ELEMENT_LABELS, FIELD_LIMITS } from '@/lib';
import { ScoreField } from './ScoreField';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';

/**
 * The counter tapped while the match is running: Tipping. It gets a block of
 * its own — outside Match Entry's Robots section — so the phone layout can
 * keep it next to the clock. A Scrim's fouls are not timed and sit under the
 * robot rows instead (see `PenaltyCounters`).
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

  return (
    // `gap`, not `space-y`: the heading is visually hidden on a phone and
    // must not leave its margin behind on the first counter.
    <div className="flex flex-col gap-2" data-tutorial="live">
      <h2 className="sr-only md:not-sr-only md:text-team-blue md:text-xl md:font-semibold md:leading-6">
        Live Scoring
      </h2>
      {/* Room for the line saying why Hive Tips is locked (the 56px row,
          then 20px for the line) is kept for the whole match: the line goes
          when AUTO starts, and the robot rows under it must not jump up
          just as the scorer reaches for Leave. */}
      <div className="min-h-[4.75rem]">
        <ScoreField
          label={ELEMENT_LABELS.tipping}
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
          lockedReason={lockedReason}
          resetKey={entryKey}
          onChange={handleTipping}
        />
      </div>
    </div>
  );
};
