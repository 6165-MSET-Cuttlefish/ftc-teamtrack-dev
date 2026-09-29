import { useRef } from 'react';
import { Check } from 'lucide-react';
import { useSession, useTheme } from '@/contexts';
import { POINTS, calculateScore } from '@/lib';
import type { ScoreEvent } from '@/types';
import { ScoreField } from './ScoreField';

const Section = ({
  title,
  tutorialId,
  children,
}: {
  title: string;
  /** `data-tutorial` hook so the walkthrough can spotlight this section */
  tutorialId?: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="space-y-2" data-tutorial={tutorialId}>
      <h3
        className={`text-lg font-bold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {title}
      </h3>
      {children}
    </div>
  );
};

const FLOWER_INFO = 'Top NECTAR owns the flower; bottom NECTAR gets the bonus.';

/** A large tap-target toggle, used in place of a small checkbox. */
const Toggle = ({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Full name for screen readers when the visible label is abbreviated */
  ariaLabel?: string;
  disabled?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`h-11 px-2 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 select-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 text-gray-500 dark:border-gray-700 dark:bg-gray-800'
          : checked
            ? 'border-team-blue bg-team-blue/15 text-team-blue'
            : isDarkMode
              ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {checked && <Check size={16} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

/**
 * BIOBUZZ scores PARK twice per robot: once for parking by the end of AUTO,
 * once for parking by the end of the match. A robot can leave the loading
 * zone in between and still collect both.
 */
const RobotRow = ({
  label,
  leave,
  parkAuto,
  parkTeleop,
  onLeave,
  onParkAuto,
  onParkTeleop,
  parkTeleopDisabled,
}: {
  label: string;
  leave: boolean;
  parkAuto: boolean;
  parkTeleop: boolean;
  onLeave: (v: boolean) => void;
  onParkAuto: (v: boolean) => void;
  onParkTeleop: (v: boolean) => void;
  parkTeleopDisabled: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr_1fr] items-center gap-2">
      <div
        className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      <Toggle
        checked={leave}
        onChange={onLeave}
        label="Leave"
        ariaLabel={`${label} leave`}
      />
      <Toggle
        checked={parkAuto}
        onChange={onParkAuto}
        label="Auto"
        ariaLabel={`${label} parked at end of auto`}
      />
      <Toggle
        checked={parkTeleop}
        onChange={onParkTeleop}
        label="End"
        ariaLabel={`${label} parked at end of match`}
        disabled={parkTeleopDisabled}
      />
    </div>
  );
};

/**
 * Column headings for the robot rows. The toggles themselves say "Auto" and
 * "End" — short enough to survive a phone-width column once the check mark
 * is added — and this row says what they are.
 */
const RobotHeader = () => {
  const { isDarkMode } = useTheme();
  const cls = `text-xs font-semibold uppercase tracking-wide text-center ${
    isDarkMode ? 'text-gray-400' : 'text-gray-600'
  }`;
  return (
    <div
      className="grid grid-cols-[5rem_1fr_1fr_1fr] items-end gap-2"
      aria-hidden
    >
      <div />
      <div />
      <div className={`${cls} col-span-2`}>Park</div>
    </div>
  );
};

/**
 * All scoring for the current match: Tipping, robot leave/park, scrim
 * penalties and the end-of-match assessment. The running total lives in
 * ScoreBreakdown.
 */
export const MatchEntry = () => {
  const { sessionData, updateSessionData, matchPhase, matchActive, timer } =
    useSession();

  const breakdown = calculateScore(sessionData);
  const isScrim = sessionData.sessionType === 'Scrim';

  /** Timestamp of the last Tipping change, for cycle times */
  const lastActionRef = useRef<number | null>(null);

  /**
   * Tipping is counted while the match runs, so each change is logged with
   * its phase and time for cycle-time analysis. The count is a whole-match
   * total and stays editable after the buzzer, so a miscount can be
   * corrected before the match is saved.
   */
  const record = (field: ScoreEvent['field'], value: number) => {
    const now = Date.now();
    const cycleTime =
      lastActionRef.current !== null
        ? parseFloat(((now - lastActionRef.current) / 1000).toFixed(2))
        : undefined;
    lastActionRef.current = now;

    const entry: ScoreEvent = {
      field,
      value,
      phase: matchPhase,
      timeRemaining: timer,
      cycleTime,
    };

    updateSessionData({
      [field]: value,
      phaseLog: [...(sessionData.phaseLog ?? []), entry],
    });
  };

  /**
   * Flower, hive and garden contents are only knowable once the buzzer sounds, so
   * they stay locked while the clock is still running. Before a match starts
   * they are open, which is what lets a user correct an entry after the fact.
   */
  const matchOver = !matchActive || matchPhase === 'ended';

  /** End-of-match park can't be known while AUTO is still running. */
  const inAuto = matchActive && matchPhase === 'auton';

  return (
    <div className="space-y-4">
      <h2 className="text-team-blue text-xl font-semibold leading-6">
        Match Entry
      </h2>

      <Section title="Robots" tutorialId="robots">
        <ScoreField
          label="Tipping"
          size="large"
          stepper
          value={sessionData.tipping}
          points={breakdown.tipping}
          disabled={!matchActive}
          onChange={v => record('tipping', v)}
        />
        <RobotHeader />
        <RobotRow
          label="Robot 1"
          leave={sessionData.robot1Leave}
          parkAuto={sessionData.robot1ParkAuto}
          parkTeleop={sessionData.robot1ParkTeleop}
          onLeave={v => updateSessionData({ robot1Leave: v })}
          onParkAuto={v => updateSessionData({ robot1ParkAuto: v })}
          onParkTeleop={v => updateSessionData({ robot1ParkTeleop: v })}
          parkTeleopDisabled={inAuto}
        />
        <RobotRow
          label="Robot 2"
          leave={sessionData.robot2Leave}
          parkAuto={sessionData.robot2ParkAuto}
          parkTeleop={sessionData.robot2ParkTeleop}
          onLeave={v => updateSessionData({ robot2Leave: v })}
          onParkAuto={v => updateSessionData({ robot2ParkAuto: v })}
          onParkTeleop={v => updateSessionData({ robot2ParkTeleop: v })}
          parkTeleopDisabled={inAuto}
        />
      </Section>

      {isScrim && (
        <Section title="Penalties" tutorialId="penalties">
          <ScoreField
            label="Minor Penalty"
            size="large"
            stepper
            value={sessionData.minorPenalties}
            points={-(sessionData.minorPenalties * POINTS.MINOR_PENALTY)}
            onChange={v => updateSessionData({ minorPenalties: v })}
          />
          <ScoreField
            label="Major Penalty"
            size="large"
            stepper
            value={sessionData.majorPenalties}
            points={-(sessionData.majorPenalties * POINTS.MAJOR_PENALTY)}
            onChange={v => updateSessionData({ majorPenalties: v })}
          />
        </Section>
      )}

      <Section title="End of Match" tutorialId="end-of-match">
        <ScoreField
          size="large"
          stepper
          label="Flower"
          info={FLOWER_INFO}
          value={sessionData.flower}
          points={breakdown.flower}
          disabled={!matchOver}
          onChange={v => updateSessionData({ flower: v })}
        />
        <ScoreField
          size="large"
          stepper
          label="Flower Bonus"
          info={FLOWER_INFO}
          max={4}
          value={sessionData.flowerBonus}
          points={breakdown.flowerBonus}
          disabled={!matchOver}
          onChange={v => updateSessionData({ flowerBonus: v })}
        />
        <ScoreField
          size="large"
          stepper
          label="Left in Hive"
          value={sessionData.ballsInHive}
          points={breakdown.hive}
          disabled={!matchOver}
          onChange={v => updateSessionData({ ballsInHive: v })}
        />
        <ScoreField
          size="large"
          stepper
          label="Garden"
          value={sessionData.garden}
          points={breakdown.garden}
          disabled={!matchOver}
          onChange={v => updateSessionData({ garden: v })}
        />
      </Section>
    </div>
  );
};
