import { useId, useState } from 'react';
import { Check, Lock } from 'lucide-react';
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
import {
  CountLine,
  CounterHead,
  FlowerSlots,
  LOCKED_SURFACE,
} from './EndOfMatchParts';
import { PenaltyField, PenaltyHint } from './PenaltyCounters';
import { BreakdownStrip } from './ScoreBreakdown';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { toggleOffClass, toggleOnClass } from './toggleTone';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';
import { useMatchEntry } from './useMatchEntry';
import { usePenaltyCounters } from './usePenaltyCounters';
import { useScoringLocks } from './useScoringLocks';

/**
 * Scoring on a full-size screen, laid out around how a match is watched.
 *
 *  - During play: a big Hive Tips pad (the one thing tapped over and over,
 *    so the whole surface is the +1; T on a keyboard does the same) with
 *    its -1 beside it (under it on a tablet and in a scrim), the robot
 *    leave/park matrix beside it, and in a scrim the two penalty counters.
 *  - After the buzzer: the two flower counters, Left in Hive and Garden as
 *    joined steppers, each under its name (the rule behind an (i)) and what
 *    one is worth, locked until the clock stops (see `useScoringLocks`).
 *  - Then one band across the bottom: the total and the ranking points.
 *    Each element's points are on its own counter, so the band doesn't
 *    repeat them.
 *
 * The full rules sit behind each heading's (i). The phone layout uses LiveCounters
 * and MatchEntry instead, which share their state and locks with this
 * through `useLiveCounters`, `useMatchEntry` and `usePenaltyCounters`.
 */

/** Width of the pad's "+1 Tip" key */
const KEY_WIDTH = 'w-28';

/**
 * `lockNoteId` names the text, read out but not shown, that says why the
 * pad is locked. Before Start it speaks for the whole band (the robots and
 * a Scrim's penalties wait for the same Start), so they point at it too.
 */
const TipsPad = ({ lockNoteId }: { lockNoteId: string }) => {
  const { isDarkMode } = useTheme();
  const describedById = useId();
  const {
    sessionData,
    breakdown,
    tippingEnabled,
    tippingLive,
    handleTipping,
    liveActionFilled,
    lockedReason,
  } = useLiveCounters();
  const value = sessionData.tipping;
  const max = FIELD_LIMITS.tipping;
  const canAdd = tippingEnabled && value < max;
  // The page's one filled button while play is on, as the phone's +1 Tip.
  // Paused, after the buzzer or for a saved match it is an outline, and the
  // filled button is Resume or Save.
  const filled = canAdd && liveActionFilled;

  const surface = !canAdd
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
  // frame. Locked, it is only its words and a lock.
  const key = !canAdd
    ? ''
    : filled
      ? 'bg-black/10'
      : isDarkMode
        ? 'bg-white/[0.07]'
        : 'bg-gray-100';

  // Taking one back: an outline, or greyed out with nothing to take back.
  const canTakeBack = tippingEnabled && value > 0;
  const minus = canTakeBack
    ? `cursor-pointer active:scale-[0.94] ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10'
          : 'border-gray-500 bg-white text-gray-900 hover:bg-gray-100'
      }`
    : `cursor-not-allowed ${LOCKED_SURFACE}`;

  // On a wide screen the -1 stands beside the pad, as tall as it, rather
  // than on a line of its own under it: [-1][Hive Tips 0  +1 Tip] reads as
  // one stepper, and the band is no taller than the robots beside it, so no
  // lone -1 sits over an empty strip. Below `lg` (and beside a scrim's
  // penalties, where the pad's column is narrow) the pad needs its whole
  // width for a two-digit count and the key, so the -1 goes under it.
  const minusBeside = sessionData.sessionType !== 'Scrim';

  return (
    // `self-start`: a scrim's penalty column can make the band taller than
    // the pad, and the pad keeps its one height whatever is beside it.
    <div
      className={`grid gap-2 self-start ${
        minusBeside ? 'lg:grid-cols-[auto_minmax(0,1fr)]' : ''
      }`}
    >
      {/*
        The whole pad is the +1 button: the biggest target on the page for
        the one action repeated all match. The key reads "+1 Tip" and comes
        first, so that is what the button is called; the label, points and
        count are read out from its description instead.

        One fixed height in every state. Its fill, edge and text change in
        the same frame (only the press and hover move are animated): a fill
        fading in under text that had already changed left the pad blank
        for a moment as AUTO started, on pause and at the buzzer.
      */}
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => handleTipping(Math.min(max, value + 1))}
        aria-describedby={describedById}
        aria-keyshortcuts={tippingLive ? TIP_SHORTCUT : undefined}
        className={`grid h-[6.5rem] w-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] gap-x-3 rounded-2xl border-2 px-5 py-3.5 text-left select-none touch-manipulation transition-[transform,box-shadow,filter] duration-150 ease-out ${surface} ${
          minusBeside ? 'lg:col-start-2 lg:row-start-1' : ''
        }`}
      >
        <span
          className={`col-start-2 row-start-2 flex h-12 ${KEY_WIDTH} items-center justify-center gap-2 self-end rounded-xl text-base font-bold whitespace-nowrap ${key}`}
        >
          {!tippingEnabled && (
            <Lock size={16} aria-hidden className="shrink-0" />
          )}
          +1 Tip
          {/* Only while the key does something: the match is being played */}
          {tippingLive && (
            <kbd
              aria-hidden
              title={`Shortcut: press ${TIP_SHORTCUT} to add a Hive Tip`}
              className="rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 opacity-70 [@media(pointer:coarse)]:hidden"
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
      <span id={describedById} className="sr-only">
        {`${ELEMENT_LABELS.tipping} ${value}, ${breakdown.tipping} points${
          !tippingEnabled && lockedReason ? `. ${lockedReason}` : ''
        }`}
      </span>

      {/*
        Taking one back is a button of its own, outside the pad's edge and
        next to its count (beside it or under it), far from the +1 key. It is
        there (greyed out) from the start rather than appearing with the
        first tip: a button that showed up inside the pad would land under
        the finger tapping it, and turn the next tap into a -1. After the pad
        in the page's order, as the pad is what the band is for.
      */}
      <button
        type="button"
        disabled={!canTakeBack}
        onClick={() => handleTipping(Math.max(0, value - 1))}
        aria-label={`Decrease ${ELEMENT_LABELS.tipping}`}
        title="Take one tip off"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-base font-bold tabular-nums select-none touch-manipulation transition-[background-color,transform] duration-150 ease-out ${minus} ${
          minusBeside
            ? 'lg:col-start-1 lg:row-start-1 lg:h-auto lg:self-stretch'
            : ''
        }`}
      >
        <span aria-hidden>&minus;1</span>
      </button>
      {/*
        Why the pad is locked is read out, not shown: the locked look and the
        lock on the key say it, and Start, right above, is what unlocks it.
        Read out with the pad, from its description, and with each robot chip
        and penalty counter locked for the same reason, rather than a second
        time on its own.
      */}
      {!tippingEnabled && lockedReason && (
        <div aria-hidden className="sr-only">
          <SectionNote id={lockNoteId} visuallyHidden>
            {lockedReason}
          </SectionNote>
        </div>
      )}
    </div>
  );
};

/**
 * One leave/park toggle in the robot matrix: the accent tint and a check
 * when on, an outline when off, the one muted locked tone when it can't be
 * scored yet.
 */
const Chip = ({
  on,
  label,
  ariaLabel,
  disabled,
  describedBy,
  onChange,
}: {
  on: boolean;
  label: string;
  ariaLabel: string;
  disabled: boolean;
  /** Id of the note under the matrix that says why it is locked */
  describedBy?: string;
  onChange: (v: boolean) => void;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-describedby={disabled ? describedBy : undefined}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl border-2 px-1.5 text-sm font-semibold select-none touch-manipulation transition-[background-color,border-color,color,transform] duration-150 ease-out enabled:active:scale-[0.96] ${
        disabled
          ? `cursor-not-allowed ${LOCKED_SURFACE}`
          : // The phone's toggle colours: on the light page an on chip also
            // gets a thicker frame and a deeper tint
            on
            ? toggleOnClass(isDarkMode)
            : toggleOffClass(isDarkMode)
      }`}
    >
      {on && <Check size={14} strokeWidth={3} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

type InfoKey = 'flower' | 'flowerBonus' | 'hive' | 'garden';

export const ScoringPad = () => {
  const { isDarkMode } = useTheme();
  const entry = useMatchEntry();
  const fouls = usePenaltyCounters();
  const { entryLocked, endParkLocked, hasAuto, hasTeleop } = useScoringLocks();
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
  } = entry;
  const isScrim = sessionData.sessionType === 'Scrim';

  const rowLabel = `col-start-1 whitespace-nowrap text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;

  const robots = [
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
  ];

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
    robotsNote: useId(),
    padLock: useId(),
  };

  // The matrix shows only what the match type scores (no dead chips): a
  // Teleop match has no Leave or Park (Auto), an Autonomous one no Park
  // (End). What is locked, or why a column is missing, is one line under
  // it, kept in every state so the rows never move. Before Start every
  // field is locked alike: the pad's own note, read out but not shown, says
  // it for the whole band, and this one is empty.
  const robotsNote = entryLocked
    ? null
    : endParkLocked && hasTeleop
      ? { locked: true, text: `${ELEMENT_LABELS.parkEnd} unlocks in Teleop` }
      : !hasAuto
        ? { locked: false, text: 'Teleop match: no Auto scoring' }
        : !hasTeleop
          ? { locked: false, text: 'Autonomous match: no End park' }
          : null;
  /** Where a locked robot chip or penalty counter says why */
  const robotsReasonId = entryLocked ? ids.padLock : ids.robotsNote;

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
  };
  /** The open rule, right under the heading whose (i) opened it */
  const rule = (which: InfoKey) =>
    infoOpen === which && (
      <p
        id={ids.info}
        className={`mt-1.5 text-xs leading-4 text-balance ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        {infoText[which]}
      </p>
    );

  /** The stepper of one end-of-match counter; its label is drawn above it */
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
      {/*
        What is tapped while the clock runs, in one band. In a scrim the
        penalties sit beside the robots on a wide screen and take a row of
        their own under the band below `lg`, so the robot rows never move
        down.
      */}
      <h2 className="sr-only">Live scoring</h2>
      <div
        data-tutorial="live"
        // The robots get the width 'Park (Auto)' and its check need on a
        // tablet, in a scrim's three columns too; the pad keeps plenty.
        className={`grid items-stretch gap-4 lg:gap-5 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] ${
          isScrim
            ? 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.45fr)_minmax(0,0.7fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'
        }`}
      >
        <TipsPad lockNoteId={ids.padLock} />

        <div
          data-tutorial="robots"
          // Top-aligned, not centred: a scrim's penalty counters make the
          // band taller, and the robot rows must stay where Practice has them.
          className="grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] content-start items-center gap-x-1.5 gap-y-2.5 pt-0.5"
        >
          {robots.map(r => {
            const leaveLocked = entryLocked;
            const endLocked = entryLocked || endParkLocked;
            return (
              <div key={r.id} className="contents">
                <span className={rowLabel} aria-hidden>
                  Robot {r.id}
                </span>
                {hasAuto && (
                  <>
                    <Chip
                      on={r.leave}
                      label={ELEMENT_LABELS.leave}
                      ariaLabel={`Robot ${r.id} leave`}
                      disabled={leaveLocked}
                      describedBy={robotsReasonId}
                      onChange={r.onLeave}
                    />
                    <Chip
                      on={r.parkAuto}
                      label={ELEMENT_LABELS.parkAuto}
                      ariaLabel={`Robot ${r.id} parked at end of auto`}
                      disabled={leaveLocked}
                      describedBy={robotsReasonId}
                      onChange={r.onParkAuto}
                    />
                  </>
                )}
                {hasTeleop && (
                  <Chip
                    on={r.parkEnd}
                    label={ELEMENT_LABELS.parkEnd}
                    ariaLabel={`Robot ${r.id} parked at end of match`}
                    disabled={endLocked}
                    describedBy={robotsReasonId}
                    onChange={r.onParkEnd}
                  />
                )}
              </div>
            );
          })}
          <div className="col-span-4 min-h-4">
            {robotsNote && (
              <SectionNote
                id={ids.robotsNote}
                icon={robotsNote.locked ? 'locked' : undefined}
              >
                {robotsNote.text}
              </SectionNote>
            )}
          </div>
        </div>

        {isScrim && (
          <div
            data-tutorial="penalties"
            className="col-span-2 grid grid-cols-2 content-start gap-x-4 gap-y-2 lg:col-span-1 lg:grid-cols-1"
          >
            {/* Locked only before Start, which the pad's line already says */}
            <h3 className={`col-span-2 lg:col-span-1 ${EYEBROW_CLASS}`}>
              Penalties
            </h3>
            <PenaltyField
              kind="minor"
              layout="segment"
              value={fouls.minor}
              locked={fouls.locked}
              lockedReasonId={ids.padLock}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMinorPenalties}
            />
            <PenaltyField
              kind="major"
              layout="segment"
              value={fouls.major}
              locked={fouls.locked}
              lockedReasonId={ids.padLock}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMajorPenalties}
            />
          </div>
        )}
      </div>

      {/* Under the band, so dismissing it moves nothing that is tapped live */}
      {isScrim && <PenaltyHint />}

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
          Three rows shared across the four counters (subgrid), so every
          name, every worth line and every stepper sits level with its
          neighbours however the names wrap: the two flower counters, then
          Left in Hive and Garden. Below `lg` the flower pair takes the first
          row and the other two the next. An open (i) rule sits under its
          own name, in that first row, so the rows under it stay level with
          their neighbours too.
        */}
        {/* The walkthrough spotlights the fields, not the note over them,
            which is empty while it runs */}
        <div
          data-tutorial="end-of-match"
          className="grid grid-cols-2 gap-x-4 gap-y-1.5 lg:grid-cols-4 lg:gap-x-5"
        >
          {(
            [
              {
                key: 'flower',
                name: 'flower',
                headId: ids.flower,
                lineId: ids.flowerLine,
                icon: <FlowerSlots nectar="top" />,
                points: breakdown.flower,
                value: sessionData.flower,
                onChange: set.flower,
              },
              {
                key: 'flowerBonus',
                name: 'flower-bonus',
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
                name: 'left-in-hive',
                headId: ids.hive,
                lineId: ids.hiveLine,
                points: breakdown.hive,
                value: sessionData.ballsInHive,
                onChange: set.ballsInHive,
              },
              {
                key: 'garden',
                name: 'garden',
                headId: ids.garden,
                lineId: ids.gardenLine,
                points: breakdown.garden,
                value: sessionData.garden,
                onChange: set.garden,
              },
            ] as const
          ).map(c => {
            const which = 'info' in c ? c.info : c.key;
            return (
              <div
                key={c.key}
                role="group"
                aria-labelledby={c.headId}
                className={`row-span-3 grid grid-rows-subgrid ${
                  c.key === 'flower' || c.key === 'flowerBonus'
                    ? ''
                    : 'md:max-lg:mt-3'
                }`}
              >
                <div>
                  <CounterHead
                    id={c.headId}
                    title={COUNT_LABELS[c.key]}
                    icon={'icon' in c ? c.icon : undefined}
                    info={infoText[which]}
                    infoId={ids.info}
                    infoOpen={infoOpen === which}
                    onInfo={() => toggleInfo(which)}
                  />
                  {rule(which)}
                </div>
                <CountLine
                  id={c.lineId}
                  each={EACH_LABELS[c.key]}
                  points={c.points}
                />
                {counter(
                  COUNT_LABELS[c.key],
                  c.name,
                  c.lineId,
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
