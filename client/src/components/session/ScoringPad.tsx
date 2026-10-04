import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '@/contexts';
import {
  COUNT_LABELS,
  EACH_LABELS,
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
  FLOWERS_HINT,
  FLOWERS_LABEL,
  POINTS,
} from '@/lib';
import { CountLine, CounterHead, FlowerSlots } from './EndOfMatchParts';
import { PenaltyHint } from './PenaltyCounters';
import { BreakdownStrip } from './ScoreBreakdown';
import { ScoreField } from './ScoreField';
import { SectionNote } from './SectionNote';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';
import { useMatchEntry } from './useMatchEntry';
import { usePenaltyCounters } from './usePenaltyCounters';

/**
 * Scoring on a full-size screen, laid out around how a match is watched.
 *
 *  - During play: a big Hive Tips pad (the one thing tapped over and over,
 *    so the whole surface is the +1; T on a keyboard does the same) with
 *    its -1 under it, the robot leave/park matrix beside it, and in a scrim
 *    the two foul counters.
 *  - After the buzzer: Flowers (its two counters, Flower and Flower Bonus,
 *    under one heading), Left in Hive and Garden as joined steppers, each
 *    under a line that says what to count, locked until the clock stops
 *    (see `useScoringLocks`).
 *  - Then the breakdown as one band across the bottom.
 *
 * The full rules sit behind each heading's (i). The phone layout uses LiveCounters
 * and MatchEntry instead, which share their state and locks with this
 * through `useLiveCounters`, `useMatchEntry` and `usePenaltyCounters`.
 */

/** Width of the pad's "+1 Tip" key */
const KEY_WIDTH = 'w-28';

const TipsPad = () => {
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
    ? `cursor-not-allowed ${
        isDarkMode
          ? 'border-white/10 bg-white/[0.02] text-gray-500'
          : 'border-gray-300 bg-gray-50 text-gray-500'
      }`
    : filled
      ? `cursor-pointer border-team-blue bg-team-blue shadow-[0_2px_0_0_rgb(0_0_0/0.25)] [@media(hover:hover)]:hover:-translate-y-px active:translate-y-0 active:scale-[0.985] active:shadow-none ${
          isDarkMode
            ? 'text-black [@media(hover:hover)]:hover:brightness-110 active:brightness-90'
            : 'text-white [@media(hover:hover)]:hover:brightness-90 active:brightness-75'
        }`
      : `cursor-pointer active:scale-[0.985] ${
          isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10'
            : 'border-gray-500 bg-white text-gray-900 hover:bg-gray-100'
        }`;

  const key = !canAdd
    ? isDarkMode
      ? 'border-white/10 text-gray-500'
      : 'border-gray-300 text-gray-500'
    : filled
      ? isDarkMode
        ? 'border-black/25 bg-black/10'
        : 'border-white/50 bg-black/10'
      : isDarkMode
        ? 'border-team-blue-40'
        : 'border-gray-500';

  // Taking one back: an outline, or greyed out with nothing to take back.
  const canTakeBack = tippingEnabled && value > 0;
  const minus = canTakeBack
    ? `cursor-pointer active:scale-[0.94] ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark text-white [@media(hover:hover)]:hover:bg-team-white-10'
          : 'border-gray-500 bg-white text-gray-900 [@media(hover:hover)]:hover:bg-gray-100'
      }`
    : `cursor-not-allowed ${
        isDarkMode
          ? 'border-white/10 bg-white/[0.02] text-gray-500'
          : 'border-gray-300 bg-gray-50 text-gray-500'
      }`;

  return (
    <div className="flex h-full flex-col gap-2">
      {/*
        The whole pad is the +1 button: the biggest target on the page for
        the one action repeated all match. The key reads "+1 Tip" and comes
        first, so that is what the button is called; the label, points and
        count are read out from its description instead.
      */}
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => handleTipping(Math.min(max, value + 1))}
        aria-describedby={describedById}
        aria-keyshortcuts={tippingLive ? TIP_SHORTCUT : undefined}
        className={`grid min-h-[6.5rem] w-full flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] gap-x-3 rounded-2xl border-2 px-5 py-3.5 text-left select-none touch-manipulation transition-[transform,background-color,border-color,box-shadow,filter] duration-150 ease-out ${surface}`}
      >
        <span
          className={`col-start-2 row-start-2 flex h-12 ${KEY_WIDTH} items-center justify-center gap-2 self-end rounded-xl border-2 text-base font-bold whitespace-nowrap ${key}`}
        >
          +1 Tip
          {/* Always shown on a keyboard device so the shortcut is learnt before
              the match; it only works while tips can be scored. */}
          <kbd
            aria-hidden
            title={`Shortcut: press ${TIP_SHORTCUT} to add a Hive Tip`}
            className="rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 opacity-70 [@media(pointer:coarse)]:hidden"
          >
            {TIP_SHORTCUT}
          </kbd>
        </span>
        <span
          aria-hidden
          className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-baseline gap-2"
        >
          <span className="text-base font-semibold">
            {ELEMENT_LABELS.tipping}
          </span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              canAdd && !filled ? 'text-team-blue' : ''
            }`}
          >
            {breakdown.tipping} pts
          </span>
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
        under its count, far from the +1 key. It is there (greyed out) from
        the start rather than appearing with the first tip: a button that
        showed up inside the pad would land under the finger tapping it, and
        turn the next tap into a -1. Why the pad is locked goes beside it,
        in the row's spare width: inside the pad the line wrapped on a
        tablet and made the pad taller until AUTO, so everything under it
        moved up as play started.
      */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          disabled={!canTakeBack}
          onClick={() => handleTipping(Math.max(0, value - 1))}
          aria-label={`Decrease ${ELEMENT_LABELS.tipping}`}
          title="Take one tip off"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-base font-bold tabular-nums select-none touch-manipulation transition-[background-color,transform] duration-150 ease-out ${minus}`}
        >
          <span aria-hidden>&minus;1</span>
        </button>
        {!tippingEnabled && lockedReason && (
          // Read out with the pad, from its description
          <div aria-hidden className="min-w-0">
            <SectionNote icon="locked">{lockedReason}</SectionNote>
          </div>
        )}
      </div>
    </div>
  );
};

/** One leave/park toggle in the robot matrix. Filled when on. */
const Chip = ({
  on,
  label,
  ariaLabel,
  disabledReason,
  describedBy,
  onChange,
}: {
  on: boolean;
  label: string;
  ariaLabel: string;
  /** Set when the toggle can't be scored; says why */
  disabledReason?: string;
  describedBy?: string;
  onChange: (v: boolean) => void;
}) => {
  const { isDarkMode } = useTheme();
  const disabled = disabledReason !== undefined;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-describedby={disabled ? describedBy : undefined}
      disabled={disabled}
      title={disabledReason}
      onClick={() => onChange(!on)}
      className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-semibold select-none touch-manipulation transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? `border-team-blue bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
            : // gray-300 is under 3:1 on the light page
              'border-gray-500 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {on && <Check size={16} className="hidden shrink-0 xl:block" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

export const ScoringPad = () => {
  const { isDarkMode } = useTheme();
  const entry = useMatchEntry();
  const fouls = usePenaltyCounters();
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
  } = entry;
  const isScrim = sessionData.sessionType === 'Scrim';

  const rowLabel = `text-xs font-semibold tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;

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
    flowers: useId(),
    flower: useId(),
    flowerBonus: useId(),
    hive: useId(),
    hiveLine: useId(),
    garden: useId(),
    gardenLine: useId(),
    info: useId(),
  };
  /** Which heading's (i) is open; its rule shows under the row */
  const [infoOpen, setInfoOpen] = useState<
    'flowers' | 'hive' | 'garden' | null
  >(null);
  const toggleInfo = (which: 'flowers' | 'hive' | 'garden') =>
    setInfoOpen(v => (v === which ? null : which));
  // The counters' own lines say what each is worth; the Flowers (i) adds
  // the rule that tells them apart.
  const infoText =
    infoOpen === 'flowers'
      ? FLOWERS_HINT
      : infoOpen === 'hive'
        ? FIELD_HINTS.ballsInHive
        : infoOpen === 'garden'
          ? FIELD_HINTS.garden
          : null;

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
        fouls sit beside the robots on a wide screen and take a row of their
        own under the band below `lg`, so the robot rows never move down.
      */}
      <div
        data-tutorial="live"
        className={`grid items-stretch gap-4 lg:gap-5 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] ${
          isScrim
            ? 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.8fr)]'
            : ''
        }`}
      >
        <TipsPad />

        <div
          data-tutorial="robots"
          // Top-aligned, not centred: a scrim's foul counters make the band
          // taller, and the robot rows must stay where Practice has them.
          className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] content-start items-center gap-x-2 gap-y-2.5 pt-0.5"
        >
          {robots.map(r => (
            <div key={r.id} className="contents">
              <span className={rowLabel} aria-hidden>
                R{r.id}
              </span>
              <Chip
                on={r.leave}
                label={ELEMENT_LABELS.leave}
                ariaLabel={`Robot ${r.id} leave`}
                disabledReason={autoDisabledReason}
                describedBy={robotsReasonId}
                onChange={r.onLeave}
              />
              <Chip
                on={r.parkAuto}
                label={ELEMENT_LABELS.parkAuto}
                ariaLabel={`Robot ${r.id} parked at end of auto`}
                disabledReason={autoDisabledReason}
                describedBy={robotsReasonId}
                onChange={r.onParkAuto}
              />
              <Chip
                on={r.parkEnd}
                label={ELEMENT_LABELS.parkEnd}
                ariaLabel={`Robot ${r.id} parked at end of match`}
                disabledReason={parkTeleopDisabledReason}
                describedBy={robotsReasonId}
                onChange={r.onParkEnd}
              />
            </div>
          ))}
          {robotsReason && (
            <span id={robotsReasonId} className="sr-only">
              {robotsReason}
            </span>
          )}
        </div>

        {isScrim && (
          <div
            data-tutorial="penalties"
            className="col-span-2 grid grid-cols-2 gap-4 lg:col-span-1 lg:flex lg:flex-col lg:justify-center lg:gap-2"
          >
            <ScoreField
              label={ELEMENT_LABELS.minor}
              name="minor-penalty"
              layout="segment"
              stepper
              info={FIELD_HINTS.minorPenalties}
              max={FIELD_LIMITS.minorPenalties}
              value={fouls.minor}
              opponentPoints={fouls.minor * POINTS.MINOR_PENALTY}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMinorPenalties}
            />
            <ScoreField
              label={ELEMENT_LABELS.major}
              name="major-penalty"
              layout="segment"
              stepper
              info={FIELD_HINTS.majorPenalties}
              max={FIELD_LIMITS.majorPenalties}
              value={fouls.major}
              opponentPoints={fouls.major * POINTS.MAJOR_PENALTY}
              resetKey={fouls.entryKey}
              onChange={fouls.handleMajorPenalties}
            />
          </div>
        )}
      </div>

      {/* Under the band, so dismissing it moves nothing that is tapped live */}
      {isScrim && <PenaltyHint />}

      <div
        ref={endSectionRef}
        data-tutorial="end-of-match"
        className="flex flex-col gap-2"
      >
        {/* One line in every state, so the fields don't move when it changes */}
        <div
          data-highlight={justUnlocked || undefined}
          className={`min-h-4 transition-colors duration-300 ${
            justUnlocked
              ? '[&_p]:text-team-blue motion-safe:animate-[pulse_0.8s_ease-in-out_2]'
              : ''
          }`}
        >
          {endCaption}
        </div>
        {/*
          Three rows shared across the groups (subgrid), so every heading,
          every "what to count" line and every stepper sits level with its
          neighbours however the lines wrap: the Flowers pair under one
          heading, then Left in Hive and Garden. Below `lg` the pair takes
          the first row and the other two the next.
        */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 lg:grid-cols-4 lg:gap-x-5">
          <div
            role="group"
            aria-labelledby={ids.flowers}
            className="col-span-2 row-span-3 grid grid-cols-subgrid grid-rows-subgrid"
          >
            <div className="col-span-2">
              <CounterHead
                id={ids.flowers}
                title={FLOWERS_LABEL}
                points={breakdown.flower + breakdown.flowerBonus}
                info={FLOWERS_HINT}
                infoId={ids.info}
                infoOpen={infoOpen === 'flowers'}
                onInfo={() => toggleInfo('flowers')}
                dim={endDisabled}
              />
            </div>
            <CountLine
              id={ids.flower}
              icon={<FlowerSlots nectar="top" dim={endDisabled} />}
              label={COUNT_LABELS.flower}
              each={EACH_LABELS.flower}
              points={breakdown.flower}
              dim={endDisabled}
            />
            <CountLine
              id={ids.flowerBonus}
              icon={<FlowerSlots nectar="bottom" dim={endDisabled} />}
              label={COUNT_LABELS.flowerBonus}
              each={EACH_LABELS.flowerBonus}
              points={breakdown.flowerBonus}
              dim={endDisabled}
            />
            {counter(
              ELEMENT_LABELS.flower,
              'flower',
              ids.flower,
              FIELD_LIMITS.flower,
              sessionData.flower,
              set.flower
            )}
            {counter(
              ELEMENT_LABELS.flowerBonus,
              'flower-bonus',
              ids.flowerBonus,
              FIELD_LIMITS.flowerBonus,
              sessionData.flowerBonus,
              set.flowerBonus
            )}
          </div>

          <div
            role="group"
            aria-labelledby={ids.hive}
            className="row-span-3 grid grid-rows-subgrid md:max-lg:mt-3"
          >
            <CounterHead
              id={ids.hive}
              title={ELEMENT_LABELS.hive}
              info={FIELD_HINTS.ballsInHive}
              infoId={ids.info}
              infoOpen={infoOpen === 'hive'}
              onInfo={() => toggleInfo('hive')}
              dim={endDisabled}
            />
            <CountLine
              id={ids.hiveLine}
              label={COUNT_LABELS.ballsInHive}
              each={EACH_LABELS.ballsInHive}
              points={breakdown.hive}
              dim={endDisabled}
            />
            {counter(
              ELEMENT_LABELS.hive,
              'left-in-hive',
              ids.hiveLine,
              FIELD_LIMITS.ballsInHive,
              sessionData.ballsInHive,
              set.ballsInHive
            )}
          </div>

          <div
            role="group"
            aria-labelledby={ids.garden}
            className="row-span-3 grid grid-rows-subgrid md:max-lg:mt-3"
          >
            <CounterHead
              id={ids.garden}
              title={ELEMENT_LABELS.garden}
              info={FIELD_HINTS.garden}
              infoId={ids.info}
              infoOpen={infoOpen === 'garden'}
              onInfo={() => toggleInfo('garden')}
              dim={endDisabled}
            />
            <CountLine
              id={ids.gardenLine}
              label={COUNT_LABELS.garden}
              each={EACH_LABELS.garden}
              points={breakdown.garden}
              dim={endDisabled}
            />
            {counter(
              ELEMENT_LABELS.garden,
              'garden',
              ids.gardenLine,
              FIELD_LIMITS.garden,
              sessionData.garden,
              set.garden
            )}
          </div>
        </div>
        {infoText && (
          <p
            id={ids.info}
            className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {infoText}
          </p>
        )}
      </div>

      <BreakdownStrip />
    </section>
  );
};
