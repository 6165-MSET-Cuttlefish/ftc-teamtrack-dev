import { memo, useId, useState } from 'react';
import { Check, Info, Lock } from 'lucide-react';
import { useTheme } from '@/contexts';
import { cn } from '@/lib/utils';
import {
  COUNT_LABELS,
  EACH_LABELS,
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
  POINTS,
} from '@/lib';
import { FOULS_RULE } from '@/lib/scoring';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import {
  CountLine,
  CounterHead,
  FlowerSlots,
  INFO_BUTTON_CLASS,
  LOCKED_SURFACE,
} from './EndOfMatchParts';
import { useActiveShort, useActiveSideBySide } from './layout/useActiveCompact';
import { PenaltyField, PenaltyHint, ToOpponent } from './PenaltyCounters';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { toggleOffClass, toggleOnClass } from './toggleTone';
import { useMatchEntry } from './useMatchEntry';
import { usePenaltyCounters } from './usePenaltyCounters';
import { START_FIRST } from './useScoringLocks';

const Section = ({
  title,
  tutorialId,
  aside,
  headingHidden = false,
  titleHidden = false,
  caption,
  reserveCaption = false,
  highlight = false,
  sectionRef,
  className = '',
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
  /**
   * Only the title is read out but not shown: the caption under it stays,
   * for a section whose groups have titles of their own.
   */
  titleHidden?: boolean;
  /** One muted line under the heading: what state the section is in */
  caption?: React.ReactNode;
  /**
   * Keep the caption's place (an EndNote's height) when there is no
   * caption, so the fields under it stay put as it comes and goes.
   */
  reserveCaption?: boolean;
  /** Briefly draws the eye to the heading and caption (just unlocked) */
  highlight?: boolean;
  sectionRef?: React.Ref<HTMLDivElement>;
  /** Extra classes for the section */
  className?: string;
  children: React.ReactNode;
}) => (
  // `gap`, not `space-y`: a hidden heading leaves no gap behind it.
  <div
    ref={sectionRef}
    className={`flex flex-col gap-2 ${className}`}
    data-tutorial={tutorialId}
  >
    <div className={headingHidden ? 'sr-only' : 'space-y-0.5'}>
      <div
        className={
          titleHidden ? 'sr-only' : 'flex items-baseline justify-between gap-3'
        }
      >
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
            'transition-colors duration-300',
            reserveCaption ? 'min-h-8' : 'min-h-4',
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
  lockGlyph = false,
  blockedPress,
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
  /** Id of the text that says why the toggle is disabled (or waiting) */
  describedBy?: string;
  /**
   * While disabled, a lock before the label: for a toggle locked while its
   * neighbours are not (End park during AUTO, and before Start), where the
   * reason would otherwise be wondered about.
   */
  lockGlyph?: boolean;
  /**
   * Before Start: drawn ready, but a press changes nothing and calls this
   * (asking for Start) instead; read out as unavailable.
   */
  blockedPress?: () => void;
}) => {
  const { isDarkMode } = useTheme();
  const blocked = blockedPress !== undefined && !disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? wideLabel ?? label}
      aria-describedby={disabled || blocked ? describedBy : undefined}
      aria-disabled={blocked || undefined}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => (blocked ? blockedPress?.() : onChange(!checked))}
      // `touch-manipulation`: two quick taps are two taps, not a zoom. Thin
      // side padding, so the check mark fits beside "Leave" in the 69px a
      // 320px phone gives each toggle, and thinner still in a column
      // narrower than that phone's (a 200% zoom).
      // Narrower than 15rem (a 200% zoom), the check mark or lock goes
      // over the label rather than beside it, so "Leave" still fits.
      className={`h-11 min-w-0 px-1 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1 select-none touch-manipulation [@container(max-width:18.5rem)]:gap-0.5 [@container(max-width:18.5rem)]:px-0.5 [@container(max-width:15rem)]:flex-col [@container(max-width:15rem)]:gap-0 ${
        disabled
          ? // The one locked look: no outline, muted but readable (over 3:1)
            `cursor-not-allowed ${LOCKED_SURFACE}`
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
      {disabled && lockGlyph && (
        <Lock
          size={12}
          aria-hidden
          className="shrink-0 [@container(max-width:18.5rem)]:size-2.5"
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
 * Narrower than 15rem (a 200% zoom) the name can't have a column of its
 * own: it goes on a line over the toggles (see `RobotRow`), which then
 * share the whole width.
 */
const NARROW_ROBOT_GRID = {
  1: '[@container(max-width:15rem)]:grid-cols-1 [@container(max-width:15rem)]:gap-1',
  2: '[@container(max-width:15rem)]:grid-cols-2 [@container(max-width:15rem)]:gap-1',
  3: '[@container(max-width:15rem)]:grid-cols-3 [@container(max-width:15rem)]:gap-1',
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
  blockedPress,
  blockedReasonId,
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
  /** Id of the note that says those reasons */
  reasonId?: string;
  /** Before Start, what a press on a ready-looking toggle does instead */
  blockedPress?: () => void;
  /** Id of the text that says why those take nothing yet */
  blockedReasonId?: string;
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
        ariaLabel={`${label} ${ELEMENT_LABELS.leave}`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={autoDisabledReason ? reasonId : blockedReasonId}
        blockedPress={blockedPress}
      />
    ),
    parkAuto: (
      <Toggle
        key="parkAuto"
        checked={parkAuto}
        onChange={onParkAuto}
        label={bothParks ? 'Auto' : ELEMENT_LABELS.park}
        wideLabel={bothParks ? ELEMENT_LABELS.parkAuto : undefined}
        // What it shows ('Auto', 'Park (Auto)', 'Park') is in its name
        ariaLabel={`${label} ${ELEMENT_LABELS.parkAuto}`}
        disabled={autoDisabledReason !== undefined}
        disabledReason={autoDisabledReason}
        describedBy={autoDisabledReason ? reasonId : blockedReasonId}
        blockedPress={blockedPress}
      />
    ),
    parkEnd: (
      <Toggle
        key="parkEnd"
        checked={parkTeleop}
        onChange={onParkTeleop}
        label={bothParks ? 'End' : ELEMENT_LABELS.park}
        wideLabel={bothParks ? ELEMENT_LABELS.parkEnd : undefined}
        ariaLabel={`${label} ${ELEMENT_LABELS.parkEnd}`}
        disabled={parkTeleopDisabledReason !== undefined}
        disabledReason={parkTeleopDisabledReason}
        describedBy={parkTeleopDisabledReason ? reasonId : blockedReasonId}
        lockGlyph
        blockedPress={blockedPress}
      />
    ),
  };
  return (
    <div
      className={`${ROBOT_GRID[columns.length]} ${NARROW_ROBOT_GRID[columns.length]} items-center`}
    >
      <div
        className={`text-sm md:text-lg font-semibold whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${
          bothParks ? '' : '[@container(max-width:15rem)]:col-span-full'
        }`}
      >
        {label}
      </div>
      {/* In place of ParkHeader where the name is over the toggles: on the
          name's line, over the two parks */}
      {bothParks && (
        <div
          aria-hidden
          className={`${EYEBROW_CLASS} col-span-2 hidden text-center leading-4 [@container(max-width:15rem)]:block`}
        >
          Park
        </div>
      )}
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
    className={`${ROBOT_GRID[3]} [@container(max-width:15rem)]:hidden [@container(min-width:27.5rem)]:hidden`}
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
 * A Scrim's fouls (and a saved match's that has some, whatever the session
 * is now), under the robot rows; a short screen has them elsewhere (see
 * `MatchEntry`). Before Start they look ready, as every
 * field the match starts with does, and a press asks for Start; why they
 * take nothing yet is read out from `startFirstId`. The line under each
 * counter is kept for what it has given the opponent in every state, so
 * nothing under it moves at Start.
 */
const Fouls = ({ startFirstId }: { startFirstId: string }) => {
  const {
    minor,
    major,
    entryKey,
    blockedPress,
    handleMinorPenalties,
    handleMajorPenalties,
  } = usePenaltyCounters();
  return (
    <Section title="Fouls" tutorialId="penalties">
      <PenaltyHint />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-2">
        <PenaltyField
          kind="minor"
          layout="stacked"
          value={minor}
          blockedPress={blockedPress}
          lockedReasonId={startFirstId}
          resetKey={entryKey}
          onChange={handleMinorPenalties}
        />
        <PenaltyField
          kind="major"
          layout="stacked"
          value={major}
          blockedPress={blockedPress}
          lockedReasonId={startFirstId}
          resetKey={entryKey}
          onChange={handleMajorPenalties}
        />
      </div>
    </Section>
  );
};

/**
 * A Scrim's fouls on a phone on its side, over the robot rows: the screen
 * has no height for them between the robots and End of Match, which the
 * buzzer needs on screen together. Drawn as on the desktop pad, so they
 * take little height and the robot rows stay on screen during play: the
 * FOULS heading with the rule behind its (i) and what they gave the
 * opponent on its line, then Minor and Major side by side, each name
 * beside its stepper where the column has room and over it where not.
 */
const FoulsOverRobots = ({ startFirstId }: { startFirstId: string }) => {
  const {
    minor,
    major,
    entryKey,
    blockedPress,
    handleMinorPenalties,
    handleMajorPenalties,
  } = usePenaltyCounters();
  const { isDarkMode } = useTheme();
  const titleId = useId();
  const ruleId = useId();
  // The rule belongs to the match in the fields, as the counters' (i) do:
  // Start, Save or opening another match closes it.
  const [ruleFor, setRuleFor] = useState<string | null>(null);
  const ruleOpen = ruleFor === entryKey;
  const given =
    (minor ?? 0) * POINTS.MINOR_PENALTY + (major ?? 0) * POINTS.MAJOR_PENALTY;
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      data-tutorial="penalties"
      className="flex flex-col gap-1"
    >
      <div className="flex min-h-5 min-w-0 items-center justify-between gap-2">
        <h3 className={`flex items-center ${EYEBROW_CLASS}`}>
          <span id={titleId}>Fouls</span>
          <button
            type="button"
            aria-label="About Fouls"
            aria-expanded={ruleOpen}
            aria-controls={ruleOpen ? ruleId : undefined}
            onClick={() => setRuleFor(ruleOpen ? null : entryKey)}
            className={`${INFO_BUTTON_CLASS} ml-1.5 normal-case ${
              isDarkMode
                ? 'text-gray-400 hover:text-team-blue'
                : 'text-gray-500 hover:text-team-blue'
            }`}
          >
            <Info size={14} />
          </button>
        </h3>
        <ToOpponent points={given} />
      </div>
      {ruleOpen && (
        <p
          id={ruleId}
          className={`text-xs leading-4 text-balance ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {FOULS_RULE}
        </p>
      )}
      {/* Each counter is its name, then its stepper: down a column each
          where the column is narrow, along one row where it has room */}
      <div className="grid grid-flow-col grid-cols-2 grid-rows-[auto_auto] gap-x-3 gap-y-1 [@container(min-width:22rem)]:grid-flow-row [@container(min-width:22rem)]:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] [@container(min-width:22rem)]:grid-rows-none [@container(min-width:22rem)]:items-center">
        <PenaltyField
          kind="minor"
          layout="row"
          value={minor}
          blockedPress={blockedPress}
          lockedReasonId={startFirstId}
          resetKey={entryKey}
          onChange={handleMinorPenalties}
        />
        <PenaltyField
          kind="major"
          layout="row"
          value={major}
          blockedPress={blockedPress}
          lockedReasonId={startFirstId}
          resetKey={entryKey}
          onChange={handleMajorPenalties}
        />
      </div>
    </div>
  );
};

/** Which end-of-match rule is open under its (i) */
type InfoKey = 'flower' | 'flowerBonus' | 'hive' | 'garden';

/**
 * The flower pair of counters (see `flowersShown`); the other pair is Left
 * in Hive and Garden (see `hiveGardenShown`)
 */
const FLOWER_KEYS: readonly string[] = ['flower', 'flowerBonus'];

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
    robotsRef,
    entryLocked,
    blockedPress,
    startFirstId,
    hasAuto,
    hasTeleop,
    robots,
    flowersShown,
    hiveGardenShown,
  } = useMatchEntry();
  const { shown: foulsShown } = usePenaltyCounters();
  /**
   * A phone on its side has no height for the robot rows, the fouls and the
   * first End of Match counters at once, and the buzzer needs the robots
   * (Park (End)), the band and the counters together. So the fouls don't go
   * between the two there. Beside the clock they go over the robots, slim,
   * where they are on screen during play with the robots; with the clock
   * over the scoring (an iPhone SE on its side, a 200% zoom), where only
   * the robots fit under it during play, after End of Match. Always, not
   * only at the buzzer: nothing moves as the match goes on.
   */
  const short = useActiveShort();
  const foulsFirst = useActiveSideBySide();
  const foulsLast = short && !foulsFirst;
  const { isDarkMode } = useTheme();
  const ids = {
    flower: useId(),
    flowerLine: useId(),
    flowerBonus: useId(),
    flowerBonusLine: useId(),
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

  /** A counter's name, with its rule under it while its (i) is open */
  const head = (
    which: InfoKey,
    id: string,
    title: string,
    rule: string,
    icon?: React.ReactNode
  ) => (
    // A little more room under the name than between the worth line and
    // the stepper.
    <div className="min-w-0 pb-0.5">
      <CounterHead
        id={id}
        title={title}
        icon={icon}
        info={rule}
        infoId={ids.info}
        infoOpen={infoOpen === which}
        onInfo={() => toggleInfo(which)}
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
      {/* What a field that looks ready before Start says to a screen reader */}
      {entryLocked && (
        <span id={startFirstId} className="sr-only">
          {START_FIRST}
        </span>
      )}

      {foulsShown && foulsFirst && (
        <FoulsOverRobots startFirstId={startFirstId} />
      )}

      {/*
        The robot rows name themselves: the heading, and why a toggle is
        locked, are read out but not shown. The End toggles carry a lock of
        their own while AUTO runs, and before Start, as the match starts
        with it. One row for a team on its own, two for an alliance.
      */}
      {/* On a phone on its side too narrow for the clock's column (an iPhone
          SE) the rows sit closer, so the second clears the bar */}
      <Section
        title="Robots"
        tutorialId="robots"
        headingHidden
        sectionRef={robotsRef}
        className="[@media(max-height:500px)_and_(max-width:639px)]:gap-1"
        aside={
          robotsReason && (
            <SectionNote id={robotsReasonId} visuallyHidden>
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
          blockedPress={blockedPress}
          blockedReasonId={startFirstId}
        />
        {robots === 2 && (
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
            blockedPress={blockedPress}
            blockedReasonId={startFirstId}
          />
        )}
      </Section>

      {foulsShown && !short && <Fouls startFirstId={startFirstId} />}

      {/* Its groups have titles of their own: only its caption shows */}
      <Section
        title="End of Match"
        titleHidden
        caption={endCaption}
        reserveCaption
        highlight={justUnlocked}
        sectionRef={endSectionRef}
      >
        {/*
          Four counters drawn alike, as on the desktop pad: a name with the
          rule behind its (i), what one is worth, then the stepper. The two
          flower counters come first, side by side so the difference is the
          first thing seen: what is counted (pieces, or flowers) and where
          your nectar is (the picture before each name). Left in Hive and
          Garden are the second pair. A pair goes to one column only where
          its column is narrower than a 320px phone's (a 200% zoom). Each
          counter spans its pair's rows (subgrid), so the steppers stay level
          however the names above them wrap.

          The walkthrough spotlights the counters, not the note over them,
          which is empty while it runs: its ring then sits as close to the
          fields on every side. An Autonomous match has none to show (see
          `useMatchEntry`): then there is nothing here to spotlight.
        */}
        <div
          data-tutorial={
            flowersShown || hiveGardenShown ? 'end-of-match' : undefined
          }
          className="grid grid-cols-1 gap-x-3 gap-y-4 empty:hidden [@container(min-width:17rem)]:grid-cols-2"
        >
          {(
            [
              {
                key: 'flower',
                headId: ids.flower,
                lineId: ids.flowerLine,
                icon: <FlowerSlots nectar="top" />,
                points: breakdown.flower,
                value: sessionData.flower,
                onChange: set.flower,
              },
              {
                key: 'flowerBonus',
                headId: ids.flowerBonus,
                lineId: ids.flowerBonusLine,
                icon: <FlowerSlots nectar="bottom" />,
                points: breakdown.flowerBonus,
                value: sessionData.flowerBonus,
                onChange: set.flowerBonus,
              },
              {
                key: 'ballsInHive',
                info: 'hive',
                headId: ids.hive,
                lineId: ids.hiveLine,
                points: breakdown.hive,
                value: sessionData.ballsInHive,
                onChange: set.ballsInHive,
              },
              {
                key: 'garden',
                headId: ids.garden,
                lineId: ids.gardenLine,
                points: breakdown.garden,
                value: sessionData.garden,
                onChange: set.garden,
              },
            ] as const
          )
            .filter(c =>
              FLOWER_KEYS.includes(c.key) ? flowersShown : hiveGardenShown
            )
            .map(c => (
              <div
                key={c.key}
                role="group"
                aria-labelledby={c.headId}
                className="row-span-3 grid grid-rows-subgrid gap-y-1.5"
              >
                {head(
                  'info' in c ? c.info : c.key,
                  c.headId,
                  COUNT_LABELS[c.key],
                  FIELD_HINTS[c.key],
                  'icon' in c ? c.icon : undefined
                )}
                <CountLine
                  id={c.lineId}
                  each={EACH_LABELS[c.key]}
                  points={c.points}
                />
                <ScoreField
                  layout="segment"
                  stepper
                  hideLabel
                  label={COUNT_LABELS[c.key]}
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
      </Section>

      {foulsShown && foulsLast && <Fouls startFirstId={startFirstId} />}
    </div>
  );
};
