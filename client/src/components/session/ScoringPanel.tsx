import { FIELD_HINTS, FIELD_LIMITS, POINTS } from '@/lib';
import { ScoreField } from './ScoreField';
import { useLiveCounters } from './LiveCounters';
import { RobotRow, useMatchEntry } from './MatchEntry';

/**
 * Every scoring input for the current match in one compact block, sized so
 * the whole thing fits on one screen beside the breakdown on a laptop.
 *
 * Counters are tiles: label and points on one line, stepper under it. The
 * rules reminders sit behind each tile's (i) icon instead of under it. The
 * groups keep their `data-tutorial` hooks (live, penalties, end-of-match,
 * robots) so the walkthrough can still spotlight each one.
 *
 * The phone layout still uses LiveCounters and MatchEntry, which share
 * their logic with this through `useLiveCounters` and `useMatchEntry`.
 */
export const ScoringPanel = () => {
  const live = useLiveCounters();
  const entry = useMatchEntry();
  const { sessionData, set, breakdown, entryKey, endDisabled } = entry;

  const tipping = (
    <ScoreField
      label="Tipping"
      layout="tile"
      stepper
      info={FIELD_HINTS.tipping}
      max={FIELD_LIMITS.tipping}
      value={sessionData.tipping}
      points={live.breakdown.tipping}
      disabled={!live.tippingEnabled}
      resetKey={live.entryKey}
      onChange={live.handleTipping}
    />
  );

  const endOfMatch = (
    <div
      className="col-span-4 grid grid-cols-4 gap-2.5"
      data-tutorial="end-of-match"
    >
      <ScoreField
        label="Flower"
        layout="tile"
        stepper
        info={FIELD_HINTS.flower}
        max={FIELD_LIMITS.flower}
        value={sessionData.flower}
        points={breakdown.flower}
        disabled={endDisabled}
        resetKey={entryKey}
        onChange={set.flower}
      />
      <ScoreField
        label="Flower Bonus"
        layout="tile"
        stepper
        info={FIELD_HINTS.flowerBonus}
        max={FIELD_LIMITS.flowerBonus}
        value={sessionData.flowerBonus}
        points={breakdown.flowerBonus}
        disabled={endDisabled}
        resetKey={entryKey}
        onChange={set.flowerBonus}
      />
      <ScoreField
        label="Left in Hive"
        layout="tile"
        stepper
        info={FIELD_HINTS.ballsInHive}
        max={FIELD_LIMITS.ballsInHive}
        value={sessionData.ballsInHive}
        points={breakdown.hive}
        disabled={endDisabled}
        resetKey={entryKey}
        onChange={set.ballsInHive}
      />
      <ScoreField
        label="Garden"
        layout="tile"
        stepper
        info={FIELD_HINTS.garden}
        max={FIELD_LIMITS.garden}
        value={sessionData.garden}
        points={breakdown.garden}
        disabled={endDisabled}
        resetKey={entryKey}
        onChange={set.garden}
      />
    </div>
  );

  return (
    <section className="space-y-2.5" aria-labelledby="scoring-heading">
      <h2
        id="scoring-heading"
        className="text-team-blue text-xl font-semibold leading-6"
      >
        Scoring
      </h2>

      {live.isScrim ? (
        // Seven counters: the live ones get a row of their own.
        <div className="grid grid-cols-4 gap-2.5">
          <div
            className="col-span-4 grid grid-cols-3 gap-2.5"
            data-tutorial="live"
          >
            {tipping}
            <div
              className="col-span-2 grid grid-cols-2 gap-2.5"
              data-tutorial="penalties"
            >
              <ScoreField
                label="Minor Penalty"
                layout="tile"
                stepper
                info={FIELD_HINTS.minorPenalties}
                max={FIELD_LIMITS.minorPenalties}
                value={sessionData.minorPenalties}
                opponentPoints={
                  sessionData.minorPenalties * POINTS.MINOR_PENALTY
                }
                resetKey={live.entryKey}
                onChange={live.handleMinorPenalties}
              />
              <ScoreField
                label="Major Penalty"
                layout="tile"
                stepper
                info={FIELD_HINTS.majorPenalties}
                max={FIELD_LIMITS.majorPenalties}
                value={sessionData.majorPenalties}
                opponentPoints={
                  sessionData.majorPenalties * POINTS.MAJOR_PENALTY
                }
                resetKey={live.entryKey}
                onChange={live.handleMajorPenalties}
              />
            </div>
          </div>
          {endOfMatch}
        </div>
      ) : (
        // Five counters fit on one row.
        <div className="grid grid-cols-5 gap-2.5">
          <div data-tutorial="live">{tipping}</div>
          {endOfMatch}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6" data-tutorial="robots">
        <RobotRow
          label="Robot 1"
          leave={sessionData.robot1Leave}
          parkAuto={sessionData.robot1ParkAuto}
          parkTeleop={sessionData.robot1ParkTeleop}
          onLeave={set.robot1Leave}
          onParkAuto={set.robot1ParkAuto}
          onParkTeleop={set.robot1ParkTeleop}
          autoDisabledReason={entry.autoDisabledReason}
          parkTeleopDisabledReason={entry.parkTeleopDisabledReason}
          dense
        />
        <RobotRow
          label="Robot 2"
          leave={sessionData.robot2Leave}
          parkAuto={sessionData.robot2ParkAuto}
          parkTeleop={sessionData.robot2ParkTeleop}
          onLeave={set.robot2Leave}
          onParkAuto={set.robot2ParkAuto}
          onParkTeleop={set.robot2ParkTeleop}
          autoDisabledReason={entry.autoDisabledReason}
          parkTeleopDisabledReason={entry.parkTeleopDisabledReason}
          dense
        />
      </div>
    </section>
  );
};
