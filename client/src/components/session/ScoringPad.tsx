import { useId, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { useTheme } from '@/contexts';
import {
  COUNT_LABELS,
  EACH_LABELS,
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
} from '@/lib';
import { formatPoints } from '@/lib/points';
import { FOULS_RULE } from '@/lib/scoring';
import {
  CounterHead,
  INFO_BUTTON_CLASS,
  LOCKED_SURFACE,
} from './EndOfMatchParts';
import { PenaltyField, ToOpponent } from './PenaltyCounters';
import { BreakdownStrip } from './ScoreBreakdown';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { toggleOffClass, toggleOnClass } from './toggleTone';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';
import { useMatchEntry } from './useMatchEntry';
import { usePenaltyCounters } from './usePenaltyCounters';
import {
  LOCK_REASONS,
  START_FIRST,
  autonomousNote,
  useScoringLocks,
} from './useScoringLocks';

/**
 * Scoring on a full-size screen, laid out around how a match is watched.
 *
 *  - During play: one band of even rows. A big Hive Tips pad (the one thing
 *    tapped over and over, so the whole surface is the +1; T on a keyboard
 *    does the same) with its -1 beside it as a tall key, the robot
 *    leave/park rows beside it, and in a scrim the two foul counters, each
 *    level with a robot row. Every column starts and ends on the same lines.
 *  - After the buzzer: the two flower counters, Left in Hive and Garden as
 *    joined steppers, each under its name (the rule and what one is worth
 *    behind an (i)), locked until the clock stops (see `useScoringLocks`).
 *  - Then one band across the bottom: the total and the ranking points.
 *    Each element's points are on its own counter, so the band doesn't
 *    repeat them.
 *
 * The full rules sit behind each heading's (i). The phone layout uses LiveCounters
 * and MatchEntry instead, which share their state and locks with this
 * through `useLiveCounters`, `useMatchEntry` and `usePenaltyCounters`.
 */

/**
 * Width of the pad's "+1 Tip" key, and the room around it. With the -1
 * beside it, the pad is at its narrowest on an iPad held upright and beside
 * a scrim's fouls on a small laptop: a narrower key and tighter spacing
 * there keep a two-digit count clear of the key.
 */
const KEY_WIDTH = 'w-24 xl:w-28';
const PAD_SPACING = 'gap-x-2 px-4 lg:px-5 xl:gap-x-3';

/**
 * The pad and its -1, as tall as the band beside them (its three rows).
 * Before Start (and in the 3-2-1) it looks as it will once play is on, and
 * a press asks for Start instead of counting (see `useLiveCounters`).
 */
const TipsPad = () => {
  const { isDarkMode } = useTheme();
  const describedById = useId();
  const {
    sessionData,
    breakdown,
    tippingEnabled,
    tipKeyLive,
    blockedPress,
    handleTipping,
    liveActionFilled,
    lockedReason,
  } = useLiveCounters();
  const value = sessionData.tipping;
  const max = FIELD_LIMITS.tipping;
  const canAdd = tippingEnabled && value < max;
  /** Looks ready, but a press goes to `blockedPress` */
  const blocked = blockedPress !== undefined;
  // The page's one filled button while play is on, as the phone's +1 Tip.
  // Paused, after the buzzer, before Start or for a saved match it is an
  // outline, and the filled button is Resume, Save or Start.
  const filled = canAdd && liveActionFilled;

  // It never looks locked: a match starts with it ready. Only a count at
  // its limit greys it out.
  const surface =
    !canAdd && !blocked
      ? `cursor-not-allowed ${LOCKED_SURFACE}`
      : filled
        ? `cursor-pointer border-team-blue bg-team-blue shadow-[0_2px_0_0_rgb(0_0_0/0.25)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985] active:shadow-none ${
            isDarkMode
              ? 'text-black hover:brightness-110 active:brightness-90'
              : 'text-white hover:brightness-90 active:brightness-75'
          }`
        : `cursor-pointer active:scale-[0.985] ${
            isDarkMode
              ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10'
              : 'border-gray-500 bg-white text-gray-900 hover:bg-gray-100'
          }`;

  // The key is a tint inside the pad, never a second frame inside its
  // frame. At its limit, it is only its words.
  const key =
    !canAdd && !blocked
      ? ''
      : filled
        ? 'bg-black/10'
        : isDarkMode
          ? 'bg-white/[0.07]'
          : 'bg-gray-100';

  // Taking one back: an outline, or greyed out with nothing to take back
  // (as at 0, which is where every match starts).
  const canTakeBack = (tippingEnabled || blocked) && value > 0;
  const minus = canTakeBack
    ? `cursor-pointer active:scale-[0.94] ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10'
          : 'border-gray-500 bg-white text-gray-900 hover:bg-gray-100'
      }`
    : `cursor-not-allowed ${LOCKED_SURFACE}`;

  return (
    // The -1 stands beside the pad, as tall as it, rather than on a line of
    // its own under it: [-1][Hive Tips 0  +1 Tip] reads as one stepper, and
    // the pad is no taller than the rows beside it, so no lone -1 sits over
    // an empty strip. It spans the band's three rows, whatever is in them.
    <div className="row-span-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      {/*
        The whole pad is the +1 button: the biggest target on the page for
        the one action repeated all match. The key reads "+1 Tip" and comes
        first, so that is what the button is called; the label, points and
        count are read out from its description instead.

        One height in every state. Its fill, edge and text change in the
        same frame (only the press and hover move are animated): a fill
        fading in under text that had already changed left the pad blank
        for a moment as AUTO started, on pause and at the buzzer.
      */}
      <button
        type="button"
        disabled={!canAdd && !blocked}
        aria-disabled={blocked || undefined}
        onClick={() =>
          blocked ? blockedPress() : handleTipping(Math.min(max, value + 1))
        }
        aria-describedby={describedById}
        aria-keyshortcuts={tipKeyLive ? TIP_SHORTCUT : undefined}
        className={`col-start-2 row-start-1 grid min-h-[6.5rem] w-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] ${PAD_SPACING} rounded-2xl border-2 py-3.5 text-left select-none touch-manipulation transition-[transform,box-shadow,filter] duration-150 ease-out ${surface}`}
      >
        <span
          className={`col-start-2 row-start-2 flex h-12 ${KEY_WIDTH} items-center justify-center gap-2 self-end rounded-xl text-base font-bold whitespace-nowrap ${key}`}
        >
          +1 Tip
          {/* Only while the key does something: a match is being played
              (the walkthrough's practice one too) */}
          {tipKeyLive && (
            <kbd
              aria-hidden
              title={`Shortcut: press ${TIP_SHORTCUT} to add a Hive Tip`}
              // Faded only where that still reads: white on the light
              // theme's filled pad is under 4.5:1 at anything less than full
              className={`rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 [@media(pointer:coarse)]:hidden ${isDarkMode ? 'opacity-70' : ''}`}
            >
              {TIP_SHORTCUT}
            </kbd>
          )}
        </span>
        <span
          aria-hidden
          className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-baseline gap-2 whitespace-nowrap"
        >
          <span className="text-base font-semibold">
            {ELEMENT_LABELS.tipping}
          </span>
          {/* Only once there are some; the line keeps its height */}
          {breakdown.tipping > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              {formatPoints(breakdown.tipping)}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="col-start-1 row-start-2 self-end text-[2.75rem] font-bold leading-none tabular-nums tracking-tight"
        >
          {value}
        </span>
      </button>
      {/* Why the pad takes no taps yet is read out, not shown: it looks
          ready, and Start (or the 3-2-1 on the clock) is what it waits for */}
      <span id={describedById} className="sr-only">
        {`${ELEMENT_LABELS.tipping} ${value}, ${breakdown.tipping} points${
          !tippingEnabled && lockedReason ? `. ${lockedReason}` : ''
        }`}
      </span>

      {/*
        Taking one back is a button of its own, outside the pad's edge and
        next to its count, far from the +1 key. It is there (greyed out)
        from the start rather than appearing with the first tip: a button
        that showed up inside the pad would land under the finger tapping
        it, and turn the next tap into a -1. After the pad in the page's
        order, as the pad is what the band is for.
      */}
      <button
        type="button"
        disabled={!canTakeBack}
        aria-disabled={(canTakeBack && blocked) || undefined}
        onClick={() =>
          blocked ? blockedPress() : handleTipping(Math.max(0, value - 1))
        }
        // Named by what it shows, as the pad is by its "+1 Tip"
        aria-label="−1 Tip"
        title="Take one tip off"
        className={`col-start-1 row-start-1 flex w-11 shrink-0 items-center justify-center self-stretch rounded-xl border-2 text-base font-bold tabular-nums select-none touch-manipulation transition-[background-color,transform] duration-150 ease-out ${minus}`}
      >
        <span aria-hidden>&minus;1</span>
      </button>
    </div>
  );
};

/**
 * One leave/park toggle in the robot rows: the accent tint and a check
 * when on, an outline when off, the one muted locked tone when it can't be
 * scored yet. As tall as its row (two rows for a team's one robot).
 */
const Chip = ({
  on,
  label,
  ariaLabel,
  disabled,
  describedBy,
  blockedPress,
  onChange,
  className = '',
}: {
  on: boolean;
  label: string;
  ariaLabel: string;
  disabled: boolean;
  /** Id of the note that says why it is locked, or waiting for Start */
  describedBy?: string;
  /** Before Start: drawn ready, and a press asks for Start instead */
  blockedPress?: () => void;
  onChange: (v: boolean) => void;
  className?: string;
}) => {
  const { isDarkMode } = useTheme();
  const blocked = blockedPress !== undefined && !disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-describedby={disabled || blocked ? describedBy : undefined}
      aria-disabled={blocked || undefined}
      disabled={disabled}
      onClick={() => (blocked ? blockedPress?.() : onChange(!on))}
      className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border-2 px-1.5 text-sm font-semibold select-none touch-manipulation transition-[background-color,border-color,color,transform] duration-150 ease-out enabled:active:scale-[0.96] ${
        disabled
          ? `cursor-not-allowed ${LOCKED_SURFACE}`
          : // The phone's toggle colours: on the light page an on chip also
            // gets a thicker frame and a deeper tint
            on
            ? toggleOnClass(isDarkMode)
            : toggleOffClass(isDarkMode)
      } ${className}`}
    >
      {on && <Check size={14} strokeWidth={3} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

type InfoKey = 'flower' | 'flowerBonus' | 'hive' | 'garden' | 'fouls';

/**
 * The robot rows' columns: the name, then one per chip the match type
 * scores (Leave and Park (Auto), Park (End)), sharing the width between them
 */
const ROBOT_COLUMNS: Record<number, string> = {
  1: 'grid-cols-[3rem_minmax(0,1fr)]',
  2: 'grid-cols-[3rem_repeat(2,minmax(0,1fr))]',
  3: 'grid-cols-[3rem_repeat(3,minmax(0,1fr))]',
};

/**
 * The flower pair of counters (see `flowersShown`); the other pair is Left
 * in Hive and Garden (see `hiveGardenShown`)
 */
const FLOWER_KEYS: readonly string[] = ['flower', 'flowerBonus'];

export const ScoringPad = () => {
  const { isDarkMode } = useTheme();
  const entry = useMatchEntry();
  const fouls = usePenaltyCounters();
  const { endParkLocked, hasAuto, hasTeleop } = useScoringLocks();
  const {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    endReasonId,
    endCaption,
    justUnlocked,
    endSectionRef,
    robotsRef,
    entryLocked,
    blockedPress,
    startFirstId,
    robots,
    flowersShown,
    hiveGardenShown,
  } = entry;
  const foulsShown = fouls.shown;

  const rowLabel = `col-start-1 self-center whitespace-nowrap text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;

  const robotRows = [
    {
      id: 1,
      leave: sessionData.robot1Leave,
      parkAuto: sessionData.robot1ParkAuto,
      parkEnd: sessionData.robot1ParkTeleop,
      onLeave: set.robot1Leave,
      onParkAuto: set.robot1ParkAuto,
      onParkEnd: set.robot1ParkTeleop,
    },
    {
      id: 2,
      leave: sessionData.robot2Leave,
      parkAuto: sessionData.robot2ParkAuto,
      parkEnd: sessionData.robot2ParkTeleop,
      onLeave: set.robot2Leave,
      onParkAuto: set.robot2ParkAuto,
      onParkEnd: set.robot2ParkTeleop,
    },
  ].slice(0, robots);
  /**
   * The rows a robot takes in the band: its own, or both for a team's one
   * robot, whose chips are then as tall as the pad beside them
   */
  const robotSpan = robots === 1 ? 'row-span-2' : '';

  const ids = {
    flower: useId(),
    flowerBonus: useId(),
    hive: useId(),
    garden: useId(),
    flowerWorth: useId(),
    flowerBonusWorth: useId(),
    hiveWorth: useId(),
    gardenWorth: useId(),
    info: useId(),
    robotsNote: useId(),
    fouls: useId(),
    foulsRule: useId(),
  };

  // The rows show only what the match type scores (no dead chips): a
  // Teleop match has no Leave or Park (Auto), an Autonomous one no Park
  // (End), nor end-of-match counters. What is locked, or why something is
  // missing, is one line over the rows, kept in every state so they never
  // move. Before Start it is what AUTO says, as the match starts with that
  // lock.
  const robotsNote =
    endParkLocked && hasTeleop
      ? { locked: true, text: LOCK_REASONS.endParkWaits }
      : !hasAuto
        ? { locked: false, text: LOCK_REASONS.noAuto }
        : !hasTeleop
          ? {
              locked: false,
              text: autonomousNote({
                flowers: flowersShown,
                hiveGarden: hiveGardenShown,
              }),
            }
          : null;

  /**
   * Which heading's (i) is open; its rule shows under that heading. It
   * belongs to the match in the fields: starting, saving or opening another
   * one closes it.
   */
  const [info, setInfo] = useState<{ key: string; open: InfoKey | null }>({
    key: entryKey,
    open: null,
  });
  const infoOpen = info.key === entryKey ? info.open : null;
  const toggleInfo = (which: InfoKey) =>
    setInfo({ key: entryKey, open: infoOpen === which ? null : which });
  const infoText: Record<InfoKey, string> = {
    flower: FIELD_HINTS.flower,
    flowerBonus: FIELD_HINTS.flowerBonus,
    hive: FIELD_HINTS.ballsInHive,
    garden: FIELD_HINTS.garden,
    fouls: FOULS_RULE,
  };
  const ruleTone = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  /** The open rule, right under the heading whose (i) opened it */
  const rule = (which: InfoKey) =>
    infoOpen === which && (
      <p
        id={ids.info}
        className={`mt-1.5 text-xs leading-4 text-balance ${ruleTone}`}
      >
        {infoText[which]}
      </p>
    );

  /**
   * The stepper of one end-of-match counter; its label is drawn above it,
   * and `describedBy` says what one is worth and its points
   */
  const counter = (
    label: string,
    name: string,
    describedBy: string,
    max: number,
    value: number,
    onChange: (v: number) => void
  ) => (
    <ScoreField
      label={label}
      name={name}
      hideLabel
      describedBy={describedBy}
      layout="segment"
      stepper
      max={max}
      value={value}
      disabled={endDisabled}
      lockedReasonId={endReasonId}
      resetKey={entryKey}
      onChange={onChange}
    />
  );

  return (
    <section aria-label="Scoring" className="flex flex-col gap-4 lg:gap-5">
      <h2 className="sr-only">Live scoring</h2>
      {/* What a field that looks ready before Start says to a screen reader */}
      {entryLocked && (
        <span id={startFirstId} className="sr-only">
          {START_FIRST}
        </span>
      )}
      {/*
        What is tapped while the clock runs, in one band of three rows: a
        line for the robots' note (and in a scrim the FOULS heading), then a
        row for each robot, with the pad and its -1 down the side of all
        three. A scrim's fouls are a third column whose Minor and Major sit
        level with Robot 1 and Robot 2; below `lg` there is no room for it,
        and they take a row of their own under the band, so the robot rows
        never move down. Every column starts and ends on the same lines.
      */}
      <div
        data-tutorial="live"
        // The robots get the width 'Park (Auto)' and its check need on a
        // tablet, in a scrim's three columns too; the pad keeps plenty.
        className={`grid grid-rows-[auto_auto_auto] items-stretch gap-x-4 gap-y-2 lg:gap-x-5 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] ${
          foulsShown
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.75fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'
        }`}
      >
        <TipsPad />

        <div
          ref={robotsRef}
          data-tutorial="robots"
          className={`row-span-3 grid grid-rows-subgrid gap-x-1.5 ${
            ROBOT_COLUMNS[(hasAuto ? 2 : 0) + (hasTeleop ? 1 : 0)]
          }`}
        >
          <div className="col-span-full min-h-5">
            {robotsNote && (
              <SectionNote
                id={ids.robotsNote}
                icon={robotsNote.locked ? 'locked' : undefined}
              >
                {robotsNote.text}
              </SectionNote>
            )}
          </div>
          {robotRows.map(r => (
            <div key={r.id} className="contents">
              <span className={`${rowLabel} ${robotSpan}`} aria-hidden>
                Robot {r.id}
              </span>
              {hasAuto && (
                <>
                  <Chip
                    on={r.leave}
                    label={ELEMENT_LABELS.leave}
                    ariaLabel={`Robot ${r.id} ${ELEMENT_LABELS.leave}`}
                    disabled={false}
                    describedBy={startFirstId}
                    blockedPress={blockedPress}
                    onChange={r.onLeave}
                    className={robotSpan}
                  />
                  <Chip
                    on={r.parkAuto}
                    label={ELEMENT_LABELS.parkAuto}
                    ariaLabel={`Robot ${r.id} ${ELEMENT_LABELS.parkAuto}`}
                    disabled={false}
                    describedBy={startFirstId}
                    blockedPress={blockedPress}
                    onChange={r.onParkAuto}
                    className={robotSpan}
                  />
                </>
              )}
              {hasTeleop && (
                <Chip
                  on={r.parkEnd}
                  label={ELEMENT_LABELS.parkEnd}
                  ariaLabel={`Robot ${r.id} ${ELEMENT_LABELS.parkEnd}`}
                  disabled={endParkLocked}
                  describedBy={endParkLocked ? ids.robotsNote : startFirstId}
                  blockedPress={blockedPress}
                  onChange={r.onParkEnd}
                  className={robotSpan}
                />
              )}
            </div>
          ))}
        </div>

        {foulsShown && (
          <div
            role="group"
            aria-labelledby={ids.fouls}
            data-tutorial="penalties"
            className="col-span-2 mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 lg:col-span-1 lg:row-span-3 lg:mt-0 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-subgrid"
          >
            {/* What they gave the opponent is said once, on this line */}
            <div className="col-span-4 flex min-h-5 min-w-0 items-center justify-between gap-2 lg:col-span-2">
              <h3 className={`flex items-center ${EYEBROW_CLASS}`}>
                <span id={ids.fouls}>Fouls</span>
                <button
                  type="button"
                  aria-label="About Fouls"
                  aria-expanded={infoOpen === 'fouls'}
                  aria-controls={
                    infoOpen === 'fouls' ? ids.foulsRule : undefined
                  }
                  onClick={() => toggleInfo('fouls')}
                  className={`${INFO_BUTTON_CLASS} ml-1.5 normal-case ${
                    isDarkMode
                      ? 'text-gray-400 hover:text-team-blue'
                      : 'text-gray-500 hover:text-team-blue'
                  }`}
                >
                  <Info size={14} />
                </button>
              </h3>
              <ToOpponent points={breakdown.penalties} />
            </div>
            <PenaltyField
              kind="minor"
              layout="row"
              value={fouls.minor}
              blockedPress={fouls.blockedPress}
              lockedReasonId={startFirstId}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMinorPenalties}
            />
            <PenaltyField
              kind="major"
              layout="row"
              value={fouls.major}
              blockedPress={fouls.blockedPress}
              lockedReasonId={startFirstId}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMajorPenalties}
            />
          </div>
        )}
        {/* The FOULS rule, open under the band (the rows it would push down
            are level with the robots) */}
        {foulsShown && infoOpen === 'fouls' && (
          <p
            id={ids.foulsRule}
            className={`col-span-2 text-xs leading-4 text-balance lg:col-span-1 lg:col-start-3 ${ruleTone}`}
          >
            {FOULS_RULE}
          </p>
        )}
      </div>

      <div ref={endSectionRef} className="flex flex-col gap-2">
        <h2 className="sr-only">End of match</h2>
        {/* One height in every state, so the fields don't move when it changes */}
        <div
          data-highlight={justUnlocked || undefined}
          className={`min-h-8 transition-colors duration-300 ${
            justUnlocked
              ? '[&_p]:text-team-blue motion-safe:animate-[pulse_0.8s_ease-in-out_2]'
              : ''
          }`}
        >
          {endCaption}
        </div>
        {/*
          Two rows shared across the four counters (subgrid), so every name
          (with its points) and every stepper sits level with its neighbours
          however the names wrap: the two flower counters, then
          Left in Hive and Garden. Below `lg` the flower pair takes the first
          row and the other two the next. An open (i) rule sits under its
          own name, in that first row, so the rows under it stay level with
          their neighbours too.
        */}
        {/* The walkthrough spotlights the fields, not the note over them,
            which is empty while it runs. An Autonomous match has none to
            show (see `useMatchEntry`): then there is nothing to spotlight. */}
        <div
          data-tutorial={
            flowersShown || hiveGardenShown ? 'end-of-match' : undefined
          }
          className={`grid grid-cols-2 gap-x-4 gap-y-2 empty:hidden lg:gap-x-5 ${
            flowersShown && hiveGardenShown ? 'lg:grid-cols-4' : ''
          }`}
        >
          {(
            [
              {
                key: 'flower',
                name: 'flower',
                headId: ids.flower,
                worthId: ids.flowerWorth,
                points: breakdown.flower,
                value: sessionData.flower,
                onChange: set.flower,
              },
              {
                key: 'flowerBonus',
                name: 'flower-bonus',
                headId: ids.flowerBonus,
                worthId: ids.flowerBonusWorth,
                points: breakdown.flowerBonus,
                value: sessionData.flowerBonus,
                onChange: set.flowerBonus,
              },
              {
                key: 'ballsInHive',
                info: 'hive',
                name: 'left-in-hive',
                headId: ids.hive,
                worthId: ids.hiveWorth,
                points: breakdown.hive,
                value: sessionData.ballsInHive,
                onChange: set.ballsInHive,
              },
              {
                key: 'garden',
                name: 'garden',
                headId: ids.garden,
                worthId: ids.gardenWorth,
                points: breakdown.garden,
                value: sessionData.garden,
                onChange: set.garden,
              },
            ] as const
          )
            .filter(c =>
              FLOWER_KEYS.includes(c.key) ? flowersShown : hiveGardenShown
            )
            .map(c => {
              const which = 'info' in c ? c.info : c.key;
              return (
                <div
                  key={c.key}
                  role="group"
                  aria-labelledby={c.headId}
                  className={`row-span-2 grid grid-rows-subgrid ${
                    flowersShown &&
                    hiveGardenShown &&
                    !FLOWER_KEYS.includes(c.key)
                      ? 'md:max-lg:mt-3'
                      : ''
                  }`}
                >
                  <div>
                    <CounterHead
                      id={c.headId}
                      title={COUNT_LABELS[c.key]}
                      worth={{ id: c.worthId, each: EACH_LABELS[c.key] }}
                      points={c.points}
                      info={infoText[which]}
                      infoId={ids.info}
                      infoOpen={infoOpen === which}
                      onInfo={() => toggleInfo(which)}
                    />
                    {rule(which)}
                  </div>
                  {counter(
                    COUNT_LABELS[c.key],
                    c.name,
                    c.worthId,
                    FIELD_LIMITS[c.key],
                    c.value,
                    c.onChange
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <BreakdownStrip />
    </section>
  );
};
