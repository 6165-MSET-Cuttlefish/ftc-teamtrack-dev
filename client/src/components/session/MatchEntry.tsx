import { memo, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import { FIELD_HINTS, FIELD_LIMITS, calculateScore } from '@/lib';
import { ScoreField } from './ScoreField';
import { useScoringLocks } from './useScoringLocks';

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

/** A large tap-target toggle, used in place of a small checkbox. */
const Toggle = ({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  disabledReason,
  dense = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Full name for screen readers when the visible label is abbreviated */
  ariaLabel?: string;
  disabled?: boolean;
  /** Why the toggle is disabled, as a tooltip */
  disabledReason?: string;
  /** Shorter, for the desktop scoring panel */
  dense?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onChange(!checked)}
      className={`${dense ? 'h-9' : 'h-11'} px-2 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 select-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 text-gray-500 dark:border-gray-700 dark:bg-gray-800'
          : checked
            ? // The tinted fill leaves team-blue text under 4.5:1 on the light
              // theme, so light uses the solid fill instead.
              isDarkMode
              ? 'border-team-blue bg-team-blue/15 text-team-blue'
              : 'border-team-blue bg-team-blue text-white'
            : isDarkMode
              ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {/* No room for the check mark beside the label in a phone-width column */}
      {checked && <Check size={16} className="hidden shrink-0 sm:block" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

/** Name column, then Leave / Park: Auto / Park: End. Narrower on a phone. */
const ROBOT_GRID =
  'grid grid-cols-[3.5rem_1fr_1fr_1fr] md:grid-cols-[5rem_1fr_1fr_1fr] gap-2';

/**
 * BIOBUZZ scores PARK twice per robot: once for parking by the end of AUTO,
 * once for parking by the end of the match. A robot can leave the loading
 * zone in between and still collect both.
 */
export const RobotRow = memo(function RobotRow({
  label,
  leave,
  parkAuto,
  parkTeleop,
  onLeave,
  onParkAuto,
  onParkTeleop,
  autoDisabledReason,
  parkTeleopDisabledReason,
  dense = false,
}: {
  label: string;
  leave: boolean;
  parkAuto: boolean;
  parkTeleop: boolean;
  onLeave: (v: boolean) => void;
  onParkAuto: (v: boolean) => void;
  onParkTeleop: (v: boolean) => void;
  /** Set when Leave and Auto park can't be scored; says why */
  autoDisabledReason?: string;
  /** Set when End park can't be scored (yet); says why */
  parkTeleopDisabledReason?: string;
  /**
   * Shorter toggles that name themselves in full ("Park Auto"), so no
   * header row is needed. For the desktop scoring panel.
   */
  dense?: boolean;
}) {
  const { isDarkMode } = useTheme();
  return (
    <div className={`${ROBOT_GRID} items-center`}>
      <div
        className={`text-sm ${dense ? '' : 'md:text-lg'} font-semibold whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      <Toggle
        checked={leave}
        onChange={onLeave}
        label="Leave"
        ariaLabel={`${label} leave`}
        dense={dense}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
      />
      <Toggle
        checked={parkAuto}
        onChange={onParkAuto}
        label={dense ? 'Park Auto' : 'Auto'}
        dense={dense}
        ariaLabel={`${label} parked at end of auto`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
      />
      <Toggle
        checked={parkTeleop}
        onChange={onParkTeleop}
        label={dense ? 'Park End' : 'End'}
        dense={dense}
        ariaLabel={`${label} parked at end of match`}
        disabled={parkTeleopDisabledReason !== undefined}
        disabledReason={parkTeleopDisabledReason}
      />
    </div>
  );
});

/**
 * Column headings for the robot rows. The toggles themselves say "Auto" and
 * "End" — short enough to survive a phone-width column — and this row says
 * what they are. Screen readers get the full name from each toggle instead.
 */
export const RobotHeader = () => {
  const { isDarkMode } = useTheme();
  const cls = `text-xs font-semibold uppercase tracking-wide text-center whitespace-nowrap ${
    isDarkMode ? 'text-gray-400' : 'text-gray-600'
  }`;
  return (
    <div className={`${ROBOT_GRID} items-end`} aria-hidden>
      <div />
      <div className={cls}>Leave</div>
      <div className={cls}>Park: Auto</div>
      <div className={cls}>Park: End</div>
    </div>
  );
};

/**
 * Everything about the current match that isn't tapped live: robot leave and
 * park, and the end-of-match assessment. Tipping and the scrim fouls are in
 * LiveCounters; the running total is in ScoreBreakdown.
 */
/**
 * Setters and locks for the robot and end-of-match fields, shared by the
 * phone layout's MatchEntry and the desktop ScoringPanel.
 */
export const useMatchEntry = () => {
  const { sessionData, updateSessionData } = useSessionCore();
  const {
    scoring,
    entryKey,
    endOfMatchUnlocked,
    endParkLocked,
    hasAuto,
    hasTeleop,
  } = useScoringLocks();

  // One setter per field, each keeping its identity between renders: the
  // rows and fields below are memoized, so changing one field re-renders
  // that one alone.
  const set = useMemo(() => {
    const setter =
      <K extends keyof MatchScoringFields>(field: K) =>
      (value: MatchScoringFields[K]) =>
        updateSessionData({ [field]: value });
    return {
      robot1Leave: setter('robot1Leave'),
      robot1ParkAuto: setter('robot1ParkAuto'),
      robot1ParkTeleop: setter('robot1ParkTeleop'),
      robot2Leave: setter('robot2Leave'),
      robot2ParkAuto: setter('robot2ParkAuto'),
      robot2ParkTeleop: setter('robot2ParkTeleop'),
      flower: setter('flower'),
      flowerBonus: setter('flowerBonus'),
      ballsInHive: setter('ballsInHive'),
      garden: setter('garden'),
    };
  }, [updateSessionData]);

  const breakdown = calculateScore(scoring);

  /**
   * Flower, hive and garden contents are only knowable once play has
   * stopped, so they stay locked while the clock is running. They open at
   * the buzzer, whenever the match is paused (a match that ends early still
   * has to be scored before it is saved) and before a match starts.
   */
  const endDisabled = !endOfMatchUnlocked;

  // A period the match never runs can't be scored, for the whole match.
  const autoDisabledReason = hasAuto
    ? undefined
    : 'A Teleop match has no autonomous period';
  const parkTeleopDisabledReason = !hasTeleop
    ? 'An Autonomous match has no end-of-match park'
    : endParkLocked
      ? 'Opens when autonomous ends'
      : undefined;

  return {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    autoDisabledReason,
    parkTeleopDisabledReason,
  };
};

export const MatchEntry = () => {
  const {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    autoDisabledReason,
    parkTeleopDisabledReason,
  } = useMatchEntry();

  return (
    <div className="space-y-4">
      <h2 className="text-team-blue text-xl font-semibold leading-6">
        Match Entry
      </h2>

      <Section title="Robots" tutorialId="robots">
        <RobotHeader />
        <RobotRow
          label="Robot 1"
          leave={sessionData.robot1Leave}
          parkAuto={sessionData.robot1ParkAuto}
          parkTeleop={sessionData.robot1ParkTeleop}
          onLeave={set.robot1Leave}
          onParkAuto={set.robot1ParkAuto}
          onParkTeleop={set.robot1ParkTeleop}
          autoDisabledReason={autoDisabledReason}
          parkTeleopDisabledReason={parkTeleopDisabledReason}
        />
        <RobotRow
          label="Robot 2"
          leave={sessionData.robot2Leave}
          parkAuto={sessionData.robot2ParkAuto}
          parkTeleop={sessionData.robot2ParkTeleop}
          onLeave={set.robot2Leave}
          onParkAuto={set.robot2ParkAuto}
          onParkTeleop={set.robot2ParkTeleop}
          autoDisabledReason={autoDisabledReason}
          parkTeleopDisabledReason={parkTeleopDisabledReason}
        />
      </Section>

      <Section title="End of Match" tutorialId="end-of-match">
        <ScoreField
          size="large"
          stepper
          label="Flower"
          hint={FIELD_HINTS.flower}
          max={FIELD_LIMITS.flower}
          value={sessionData.flower}
          points={breakdown.flower}
          disabled={endDisabled}
          resetKey={entryKey}
          onChange={set.flower}
        />
        <ScoreField
          size="large"
          stepper
          label="Flower Bonus"
          hint={FIELD_HINTS.flowerBonus}
          max={FIELD_LIMITS.flowerBonus}
          value={sessionData.flowerBonus}
          points={breakdown.flowerBonus}
          disabled={endDisabled}
          resetKey={entryKey}
          onChange={set.flowerBonus}
        />
        <ScoreField
          size="large"
          stepper
          label="Left in Hive"
          hint={FIELD_HINTS.ballsInHive}
          max={FIELD_LIMITS.ballsInHive}
          value={sessionData.ballsInHive}
          points={breakdown.hive}
          disabled={endDisabled}
          resetKey={entryKey}
          onChange={set.ballsInHive}
        />
        <ScoreField
          size="large"
          stepper
          label="Garden"
          hint={FIELD_HINTS.garden}
          max={FIELD_LIMITS.garden}
          value={sessionData.garden}
          points={breakdown.garden}
          disabled={endDisabled}
          resetKey={entryKey}
          onChange={set.garden}
        />
      </Section>
    </div>
  );
};
