import { memo } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '@/contexts';
import { ELEMENT_LABELS, FIELD_HINTS, FIELD_LIMITS } from '@/lib';
import { PenaltyCounters } from './PenaltyCounters';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { useMatchEntry } from './useMatchEntry';

const Section = ({
  title,
  tutorialId,
  aside,
  caption,
  highlight = false,
  sectionRef,
  children,
}: {
  title: string;
  /** `data-tutorial` hook so the walkthrough can spotlight this section */
  tutorialId?: string;
  /** A short note on the heading's own line, so it takes no height */
  aside?: React.ReactNode;
  /** One muted line under the heading: what state the section is in */
  caption?: React.ReactNode;
  /** Briefly draws the eye to the heading (the section just unlocked) */
  highlight?: boolean;
  sectionRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div ref={sectionRef} className="space-y-2" data-tutorial={tutorialId}>
      <div className="space-y-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            data-highlight={highlight || undefined}
            className={`text-lg font-bold uppercase tracking-wide whitespace-nowrap transition-colors duration-300 ${
              highlight
                ? 'text-team-blue motion-safe:animate-[pulse_0.8s_ease-in-out_2]'
                : isDarkMode
                  ? 'text-gray-400'
                  : 'text-gray-500'
            }`}
          >
            {title}
          </h3>
          {aside}
        </div>
        {caption}
      </div>
      {children}
    </div>
  );
};

/** A large tap-target toggle, used in place of a small checkbox. */
export const Toggle = ({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  disabledReason,
  describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Full name for screen readers when the visible label is abbreviated */
  ariaLabel?: string;
  disabled?: boolean;
  /** Why the toggle is disabled, as a tooltip */
  disabledReason?: string;
  /** Id of the visible caption that says why the toggle is disabled */
  describedBy?: string;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      aria-describedby={disabled ? describedBy : undefined}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onChange(!checked)}
      // `touch-manipulation`: two quick taps are two taps, not a zoom.
      className={`h-11 px-2 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 select-none touch-manipulation ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 text-gray-500 dark:border-gray-700 dark:bg-gray-800'
          : checked
            ? // A solid fill in every theme: the check mark is hidden on a
              // phone, so on and off have to differ by more than a tint.
              `border-team-blue bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
            : isDarkMode
              ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
              : // gray-300 is under 3:1 on the light page
                'border-gray-500 bg-white text-gray-700 hover:bg-gray-100'
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
const RobotRow = memo(function RobotRow({
  label,
  leave,
  parkAuto,
  parkTeleop,
  onLeave,
  onParkAuto,
  onParkTeleop,
  autoDisabledReason,
  parkTeleopDisabledReason,
  autoReasonId,
  parkTeleopReasonId,
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
  /** Ids of the captions under the rows that show those reasons */
  autoReasonId?: string;
  parkTeleopReasonId?: string;
}) {
  const { isDarkMode } = useTheme();
  return (
    <div className={`${ROBOT_GRID} items-center`}>
      <div
        className={`text-sm md:text-lg font-semibold whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      <Toggle
        checked={leave}
        onChange={onLeave}
        label={ELEMENT_LABELS.leave}
        ariaLabel={`${label} leave`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={autoReasonId}
      />
      <Toggle
        checked={parkAuto}
        onChange={onParkAuto}
        label="Auto"
        ariaLabel={`${label} parked at end of auto`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={autoReasonId}
      />
      <Toggle
        checked={parkTeleop}
        onChange={onParkTeleop}
        label="End"
        ariaLabel={`${label} parked at end of match`}
        disabled={parkTeleopDisabledReason !== undefined}
        disabledReason={parkTeleopDisabledReason}
        describedBy={parkTeleopReasonId}
      />
    </div>
  );
});

/**
 * Column headings for the robot rows. The toggles themselves say "Auto" and
 * "End" — short enough to survive a phone-width column — and this row says
 * what they are. Screen readers get the full name from each toggle instead.
 */
const RobotHeader = () => {
  const { isDarkMode } = useTheme();
  const cls = `text-xs font-semibold uppercase tracking-wide text-center whitespace-nowrap ${
    isDarkMode ? 'text-gray-400' : 'text-gray-600'
  }`;
  return (
    <div className={`${ROBOT_GRID} items-end`} aria-hidden>
      <div />
      <div className={cls}>{ELEMENT_LABELS.leave}</div>
      <div className={cls}>Park: Auto</div>
      <div className={cls}>Park: End</div>
    </div>
  );
};

/**
 * Everything about the current match that isn't tapped live: robot leave and
 * park, a Scrim's fouls, and the end-of-match assessment. Tipping is in
 * LiveCounters; the running total is in ScoreBreakdown.
 */
export const MatchEntry = () => {
  const {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    autoDisabledReason,
    parkTeleopDisabledReason,
    robotsReason,
    robotsReasonId,
    endReasonId,
    endCaption,
    justUnlocked,
    endSectionRef,
  } = useMatchEntry();

  return (
    // `gap`, not `space-y`: the heading is visually hidden on a phone and
    // must not leave its margin behind on the first section.
    <div className="flex flex-col gap-4">
      <h2 className="sr-only md:not-sr-only md:text-team-blue md:text-xl md:font-semibold md:leading-6">
        Match Entry
      </h2>

      <Section
        title="Robots"
        tutorialId="robots"
        aside={
          robotsReason && (
            <SectionNote id={robotsReasonId} icon="locked" align="right">
              {robotsReason}
            </SectionNote>
          )
        }
      >
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
          autoReasonId={robotsReasonId}
          parkTeleopReasonId={robotsReasonId}
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
          autoReasonId={robotsReasonId}
          parkTeleopReasonId={robotsReasonId}
        />
      </Section>

      {sessionData.sessionType === 'Scrim' && (
        <Section title="Penalties" tutorialId="penalties">
          <PenaltyCounters />
        </Section>
      )}

      <Section
        title="End of Match"
        tutorialId="end-of-match"
        caption={endCaption}
        highlight={justUnlocked}
        sectionRef={endSectionRef}
      >
        <ScoreField
          size="large"
          stepper
          label={ELEMENT_LABELS.flower}
          hint={FIELD_HINTS.flower}
          max={FIELD_LIMITS.flower}
          value={sessionData.flower}
          points={breakdown.flower}
          disabled={endDisabled}
          lockedReasonId={endReasonId}
          resetKey={entryKey}
          onChange={set.flower}
        />
        <ScoreField
          size="large"
          stepper
          label={ELEMENT_LABELS.flowerBonus}
          hint={FIELD_HINTS.flowerBonus}
          max={FIELD_LIMITS.flowerBonus}
          value={sessionData.flowerBonus}
          points={breakdown.flowerBonus}
          disabled={endDisabled}
          lockedReasonId={endReasonId}
          resetKey={entryKey}
          onChange={set.flowerBonus}
        />
        <ScoreField
          size="large"
          stepper
          label={ELEMENT_LABELS.hive}
          hint={FIELD_HINTS.ballsInHive}
          max={FIELD_LIMITS.ballsInHive}
          value={sessionData.ballsInHive}
          points={breakdown.hive}
          disabled={endDisabled}
          lockedReasonId={endReasonId}
          resetKey={entryKey}
          onChange={set.ballsInHive}
        />
        <ScoreField
          size="large"
          stepper
          label={ELEMENT_LABELS.garden}
          hint={FIELD_HINTS.garden}
          max={FIELD_LIMITS.garden}
          value={sessionData.garden}
          points={breakdown.garden}
          disabled={endDisabled}
          lockedReasonId={endReasonId}
          resetKey={entryKey}
          onChange={set.garden}
        />
      </Section>
    </div>
  );
};
