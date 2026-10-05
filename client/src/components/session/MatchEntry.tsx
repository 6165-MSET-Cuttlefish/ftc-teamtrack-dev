import { memo, useId, useState } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '@/contexts';
import { cn } from '@/lib/utils';
import {
  COUNT_LABELS,
  EACH_LABELS,
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
  FLOWERS_HINT,
  FLOWERS_LABEL,
} from '@/lib';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { CountLine, CounterHead, FlowerSlots } from './EndOfMatchParts';
import { useActiveShortStacked } from './layout/useActiveCompact';
import { PenaltyField, PenaltyHint } from './PenaltyCounters';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { toggleOffClass, toggleOnClass } from './toggleTone';
import { useMatchEntry } from './useMatchEntry';
import {
  PENALTIES_LOCKED_REASON,
  usePenaltyCounters,
} from './usePenaltyCounters';

const Section = ({
  title,
  tutorialId,
  aside,
  headingHidden = false,
  caption,
  reserveCaption = false,
  highlight = false,
  sectionRef,
  children,
}: {
  title: string;
  /** `data-tutorial` hook so the walkthrough can spotlight this section */
  tutorialId?: string;
  /** A short note on the heading's own line, so it takes no height */
  aside?: React.ReactNode;
  /**
   * The heading and its aside are read out but not shown, and take no
   * height: for a screen with none to spare, where what is under the
   * heading names itself. (Not with a caption, which would go too.)
   */
  headingHidden?: boolean;
  /** One muted line under the heading: what state the section is in */
  caption?: React.ReactNode;
  /**
   * Keep the caption's line when there is no caption, so the fields under
   * it stay put as it comes and goes.
   */
  reserveCaption?: boolean;
  /** Briefly draws the eye to the heading and caption (just unlocked) */
  highlight?: boolean;
  sectionRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) => (
  // `gap`, not `space-y`: a hidden heading leaves no gap behind it.
  <div
    ref={sectionRef}
    className="flex flex-col gap-2"
    data-tutorial={tutorialId}
  >
    <div className={headingHidden ? 'sr-only' : 'space-y-0.5'}>
      <div className="flex items-baseline justify-between gap-3">
        <h3
          data-highlight={highlight || undefined}
          className={cn(
            EYEBROW_CLASS,
            'whitespace-nowrap transition-colors duration-300',
            highlight &&
              'text-team-blue motion-safe:animate-[pulse_0.8s_ease-in-out_2]'
          )}
        >
          {title}
        </h3>
        {aside}
      </div>
      {(caption || reserveCaption) && (
        <div
          className={cn(
            'min-h-4 transition-colors duration-300',
            highlight &&
              '[&_p]:text-team-blue motion-safe:animate-[pulse_0.8s_ease-in-out_2]'
          )}
        >
          {caption}
        </div>
      )}
    </div>
    {children}
  </div>
);

/** A large tap-target toggle, used in place of a small checkbox. */
export const Toggle = ({
  checked,
  onChange,
  label,
  wideLabel,
  ariaLabel,
  disabled = false,
  disabledReason,
  describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /**
   * A fuller label for where the toggle has room for it: inside Match
   * Entry, once its column is wide enough (a container query on Match
   * Entry). Elsewhere `label` alone shows.
   */
  wideLabel?: string;
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
      aria-label={ariaLabel ?? wideLabel ?? label}
      aria-describedby={disabled ? describedBy : undefined}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onChange(!checked)}
      // `touch-manipulation`: two quick taps are two taps, not a zoom. Thin
      // side padding, so the check mark fits beside "Leave" in the 69px a
      // 320px phone gives each toggle, and thinner still in a column
      // narrower than that phone's (a 200% zoom).
      className={`h-11 min-w-0 px-1 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1 select-none touch-manipulation [@container(max-width:18.5rem)]:gap-0.5 [@container(max-width:18.5rem)]:px-0.5 ${
        disabled
          ? // The one locked tone: muted, but its label still readable (over
            // 3:1), as the locked counters' labels are.
            `cursor-not-allowed text-gray-500 ${
              isDarkMode
                ? 'border-white/10 bg-white/[0.02]'
                : 'border-gray-300 bg-gray-100'
            }`
          : checked
            ? // A tint and the check mark (a thicker frame on the light page)
              toggleOnClass(isDarkMode)
            : toggleOffClass(isDarkMode)
      }`}
    >
      {checked && (
        <Check
          size={14}
          strokeWidth={3}
          aria-hidden
          className="shrink-0 [@container(max-width:18.5rem)]:size-3"
        />
      )}
      {wideLabel ? (
        <>
          <span className="truncate [@container(min-width:27.5rem)]:hidden">
            {label}
          </span>
          <span className="hidden truncate [@container(min-width:27.5rem)]:inline">
            {wideLabel}
          </span>
        </>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </button>
  );
};

/** One robot toggle: Leave, Park at the end of Auto, Park at the end */
type RobotColumn = 'leave' | 'parkAuto' | 'parkEnd';

/**
 * The toggles a match type can score, so there is never a column that can't
 * be used: a Teleop match has no Leave or Auto park, an Autonomous one no
 * End park. The type can't change while a match is played, so the columns
 * never change under a scorer.
 */
const ROBOT_COLUMNS = {
  full: ['leave', 'parkAuto', 'parkEnd'],
  auto: ['leave', 'parkAuto'],
  teleop: ['parkEnd'],
} as const satisfies Record<string, readonly RobotColumn[]>;
type RobotColumns = (typeof ROBOT_COLUMNS)[keyof typeof ROBOT_COLUMNS];

/**
 * Name column, then one per toggle, narrower on a phone. The toggle
 * columns are `minmax(0, 1fr)`, not `1fr`: a checked toggle (its check
 * mark) must not widen its column in one row only and knock the two rows
 * out of line.
 */
const ROBOT_GRID = {
  1: 'grid grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[5rem_minmax(0,1fr)] gap-2',
  2: 'grid grid-cols-[3.5rem_repeat(2,minmax(0,1fr))] md:grid-cols-[5rem_repeat(2,minmax(0,1fr))] gap-2',
  3: 'grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] md:grid-cols-[5rem_repeat(3,minmax(0,1fr))] gap-2',
} as const;

/**
 * BIOBUZZ scores PARK twice per robot: once for parking by the end of AUTO,
 * once for parking by the end of the match. A robot can leave the loading
 * zone in between and still collect both.
 */
const RobotRow = memo(function RobotRow({
  label,
  columns,
  leave,
  parkAuto,
  parkTeleop,
  onLeave,
  onParkAuto,
  onParkTeleop,
  autoDisabledReason,
  parkTeleopDisabledReason,
  reasonId,
}: {
  label: string;
  columns: RobotColumns;
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
  /** Id of the note beside the Robots heading that shows those reasons */
  reasonId?: string;
}) {
  const { isDarkMode } = useTheme();
  // With both parks in the row the toggles say which one, in full where the
  // column is wide enough and under a PARK heading where it isn't.
  const bothParks = columns.length === 3;
  const toggles: Record<RobotColumn, React.ReactNode> = {
    leave: (
      <Toggle
        key="leave"
        checked={leave}
        onChange={onLeave}
        label={ELEMENT_LABELS.leave}
        ariaLabel={`${label} leave`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={reasonId}
      />
    ),
    parkAuto: (
      <Toggle
        key="parkAuto"
        checked={parkAuto}
        onChange={onParkAuto}
        label={bothParks ? 'Auto' : ELEMENT_LABELS.park}
        wideLabel={bothParks ? ELEMENT_LABELS.parkAuto : undefined}
        ariaLabel={`${label} parked at end of auto`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={reasonId}
      />
    ),
    parkEnd: (
      <Toggle
        key="parkEnd"
        checked={parkTeleop}
        onChange={onParkTeleop}
        label={bothParks ? 'End' : ELEMENT_LABELS.park}
        wideLabel={bothParks ? ELEMENT_LABELS.parkEnd : undefined}
        ariaLabel={`${label} parked at end of match`}
        disabled={parkTeleopDisabledReason !== undefined}
        disabledReason={parkTeleopDisabledReason}
        describedBy={reasonId}
      />
    ),
  };
  return (
    <div className={`${ROBOT_GRID[columns.length]} items-center`}>
      <div
        className={`text-sm md:text-lg font-semibold whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      {columns.map(column => toggles[column])}
    </div>
  );
});

/**
 * Over the two parks, where their toggles are too narrow to say "Park
 * (Auto)" and "Park (End)" and read "Auto" and "End" instead. Leave names
 * itself, so nothing goes over it. Screen readers get the full name from
 * each toggle.
 */
const ParkHeader = () => (
  <div
    className={`${ROBOT_GRID[3]} [@container(min-width:27.5rem)]:hidden`}
    aria-hidden
  >
    <div
      className={`${EYEBROW_CLASS} col-span-2 col-start-3 text-center leading-4`}
    >
      Park
    </div>
  </div>
);

/**
 * A Scrim's fouls, under the robot rows. Locked before Start, which the
 * line at the top already says for every field (see `useMatchEntry`): the
 * note beside the heading is only read out, not under each counter either.
 * The line under each counter is kept for what it has given the opponent
 * in every state, so nothing under it moves at Start.
 */
const Penalties = () => {
  const {
    minor,
    major,
    entryKey,
    locked,
    handleMinorPenalties,
    handleMajorPenalties,
  } = usePenaltyCounters();
  const reasonId = useId();
  return (
    <Section
      title="Penalties"
      tutorialId="penalties"
      aside={
        locked && (
          <SectionNote id={reasonId} visuallyHidden>
            {PENALTIES_LOCKED_REASON}
          </SectionNote>
        )
      }
    >
      <PenaltyHint />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-2">
        <PenaltyField
          kind="minor"
          layout="stacked"
          value={minor}
          locked={locked}
          lockedReasonId={reasonId}
          resetKey={entryKey}
          onChange={handleMinorPenalties}
        />
        <PenaltyField
          kind="major"
          layout="stacked"
          value={major}
          locked={locked}
          lockedReasonId={reasonId}
          resetKey={entryKey}
          onChange={handleMajorPenalties}
        />
      </div>
    </Section>
  );
};

/** Which end-of-match rule is open under its (i) */
type InfoKey = 'flowers' | 'hive' | 'garden';

/**
 * Everything about the current match that isn't tapped live: robot leave and
 * park, a Scrim's fouls, and the end-of-match assessment. Tipping is in
 * LiveCounters; the running total is in ScoreBreakdown.
 *
 * Its own width decides its layout (a size container), not the screen's:
 * beside the clock on a phone held sideways, or zoomed to 200%, its column
 * is narrower than a 320px phone held upright.
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
    entryLocked,
    hasAuto,
    hasTeleop,
  } = useMatchEntry();
  const { isDarkMode } = useTheme();
  // An iPhone SE on its side: Robot 1 has to be above the bar during AUTO,
  // so the Robots heading goes (its toggles read Leave, Park (Auto) and
  // Park (End) at that width) and what it says about locks is read out
  // only, in every phase alike. The dimmed toggles show they are locked.
  const shortStacked = useActiveShortStacked();
  const ids = {
    flowers: useId(),
    flower: useId(),
    flowerBonus: useId(),
    hive: useId(),
    hiveLine: useId(),
    garden: useId(),
    gardenLine: useId(),
    info: useId(),
  };

  const columns =
    ROBOT_COLUMNS[hasAuto ? (hasTeleop ? 'full' : 'auto') : 'teleop'];

  // The rule behind one heading's (i), opened in place under that heading.
  // It belongs to the match in the fields: Start, Save or opening another
  // match closes it.
  const [info, setInfo] = useState<{ key: string; open: InfoKey | null }>({
    key: entryKey,
    open: null,
  });
  const infoOpen = info.key === entryKey ? info.open : null;
  const toggleInfo = (which: InfoKey) =>
    setInfo({ key: entryKey, open: infoOpen === which ? null : which });

  /** A group's heading, with its rule under it while its (i) is open */
  const head = (which: InfoKey, id: string, title: string, rule: string) => (
    // A little more room under the heading than between a count line and
    // its stepper, as in the Flowers pair.
    <div className="min-w-0 pb-0.5">
      <CounterHead
        id={id}
        title={title}
        info={rule}
        infoId={ids.info}
        infoOpen={infoOpen === which}
        onInfo={() => toggleInfo(which)}
        dim={endDisabled}
      />
      {infoOpen === which && (
        <p
          id={ids.info}
          className={`pt-1.5 text-xs text-balance ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {rule}
        </p>
      )}
    </div>
  );

  return (
    // `gap`, not `space-y`: the heading is visually hidden and must not
    // leave its margin behind on the first section.
    <div className="flex flex-col gap-4 [container-type:inline-size]">
      {/* Phone layouts only, where the page's own headings say where it is */}
      <h2 className="sr-only">Match Entry</h2>

      <Section
        title="Robots"
        tutorialId="robots"
        headingHidden={shortStacked}
        aside={
          robotsReason && (
            <SectionNote
              id={robotsReasonId}
              icon="locked"
              align="right"
              // Before Start: said once for every field, under Hive Tips
              // just above (see `useMatchEntry`)
              visuallyHidden={entryLocked}
            >
              {robotsReason}
            </SectionNote>
          )
        }
      >
        {columns.length === 3 && <ParkHeader />}
        <RobotRow
          label="Robot 1"
          columns={columns}
          leave={sessionData.robot1Leave}
          parkAuto={sessionData.robot1ParkAuto}
          parkTeleop={sessionData.robot1ParkTeleop}
          onLeave={set.robot1Leave}
          onParkAuto={set.robot1ParkAuto}
          onParkTeleop={set.robot1ParkTeleop}
          autoDisabledReason={autoDisabledReason}
          parkTeleopDisabledReason={parkTeleopDisabledReason}
          reasonId={robotsReason ? robotsReasonId : undefined}
        />
        <RobotRow
          label="Robot 2"
          columns={columns}
          leave={sessionData.robot2Leave}
          parkAuto={sessionData.robot2ParkAuto}
          parkTeleop={sessionData.robot2ParkTeleop}
          onLeave={set.robot2Leave}
          onParkAuto={set.robot2ParkAuto}
          onParkTeleop={set.robot2ParkTeleop}
          autoDisabledReason={autoDisabledReason}
          parkTeleopDisabledReason={parkTeleopDisabledReason}
          reasonId={robotsReason ? robotsReasonId : undefined}
        />
      </Section>

      {sessionData.sessionType === 'Scrim' && <Penalties />}

      <Section
        title="End of Match"
        tutorialId="end-of-match"
        caption={endCaption}
        reserveCaption
        highlight={justUnlocked}
        sectionRef={endSectionRef}
      >
        {/*
          Three groups drawn alike, as on the desktop pad: a heading with the
          rule behind its (i), what to count and what one is worth, then the
          stepper. Flower and Flower Bonus share one heading, side by side so
          the difference is the first thing seen: what is counted (pieces, or
          flowers) and where your nectar is. Left in Hive and Garden are the
          second pair. Each pair goes to one column where its column is too
          narrow for two steppers to show their counts. Each counter spans
          its pair's rows (subgrid), so the steppers stay level however the
          lines above them wrap.
        */}
        <div className="flex flex-col gap-4">
          <div
            role="group"
            aria-labelledby={ids.flowers}
            className="flex flex-col gap-1.5"
          >
            {head('flowers', ids.flowers, FLOWERS_LABEL, FLOWERS_HINT)}
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 [@container(min-width:20rem)]:grid-cols-2">
              {(
                [
                  {
                    key: 'flower',
                    lineId: ids.flower,
                    nectar: 'top',
                    points: breakdown.flower,
                    value: sessionData.flower,
                    onChange: set.flower,
                  },
                  {
                    key: 'flowerBonus',
                    lineId: ids.flowerBonus,
                    nectar: 'bottom',
                    points: breakdown.flowerBonus,
                    value: sessionData.flowerBonus,
                    onChange: set.flowerBonus,
                  },
                ] as const
              ).map(f => (
                <div
                  key={f.key}
                  className="row-span-2 grid grid-rows-subgrid gap-y-1.5"
                >
                  <CountLine
                    id={f.lineId}
                    icon={<FlowerSlots nectar={f.nectar} dim={endDisabled} />}
                    label={COUNT_LABELS[f.key]}
                    each={EACH_LABELS[f.key]}
                    points={f.points}
                    dim={endDisabled}
                  />
                  <ScoreField
                    layout="stacked"
                    stepper
                    hideLabel
                    label={ELEMENT_LABELS[f.key]}
                    describedBy={f.lineId}
                    max={FIELD_LIMITS[f.key]}
                    value={f.value}
                    disabled={endDisabled}
                    lockedReasonId={endReasonId}
                    resetKey={entryKey}
                    onChange={f.onChange}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-3 gap-y-4 [@container(min-width:20rem)]:grid-cols-2">
            {(
              [
                {
                  key: 'ballsInHive',
                  info: 'hive',
                  headId: ids.hive,
                  lineId: ids.hiveLine,
                  label: ELEMENT_LABELS.hive,
                  points: breakdown.hive,
                  value: sessionData.ballsInHive,
                  onChange: set.ballsInHive,
                },
                {
                  key: 'garden',
                  info: 'garden',
                  headId: ids.garden,
                  lineId: ids.gardenLine,
                  label: ELEMENT_LABELS.garden,
                  points: breakdown.garden,
                  value: sessionData.garden,
                  onChange: set.garden,
                },
              ] as const
            ).map(c => (
              <div
                key={c.key}
                role="group"
                aria-labelledby={c.headId}
                className="row-span-3 grid grid-rows-subgrid gap-y-1.5"
              >
                {head(c.info, c.headId, c.label, FIELD_HINTS[c.key])}
                <CountLine
                  id={c.lineId}
                  label={COUNT_LABELS[c.key]}
                  each={EACH_LABELS[c.key]}
                  points={c.points}
                  dim={endDisabled}
                />
                <ScoreField
                  layout="stacked"
                  stepper
                  hideLabel
                  label={c.label}
                  describedBy={c.lineId}
                  max={FIELD_LIMITS[c.key]}
                  value={c.value}
                  disabled={endDisabled}
                  lockedReasonId={endReasonId}
                  resetKey={entryKey}
                  onChange={c.onChange}
                />
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
};
