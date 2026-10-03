import { useId } from 'react';
import { Check, Lock, Minus } from 'lucide-react';
import { useTheme } from '@/contexts';
import { ELEMENT_LABELS, FIELD_HINTS, FIELD_LIMITS, POINTS } from '@/lib';
import { PenaltyHint } from './PenaltyCounters';
import { BreakdownStrip } from './ScoreBreakdown';
import { ScoreField } from './ScoreField';
import { TIP_SHORTCUT, useLiveCounters } from './useLiveCounters';
import { useMatchEntry } from './useMatchEntry';
import { usePenaltyCounters } from './usePenaltyCounters';

/**
 * Scoring on a full-size screen, laid out around how a match is watched.
 *
 *  - During play: a big Hive Tips pad (the one thing tapped over and over,
 *    so the whole surface is the +1; T on a keyboard does the same), the
 *    robot leave/park matrix beside it, and in a scrim the two foul
 *    counters.
 *  - After the buzzer: Flower, Flower Bonus, Left in Hive and Garden as
 *    joined steppers, locked until the clock stops (see `useScoringLocks`).
 *  - Then the breakdown as one band across the bottom.
 *
 * The rules sit behind each field's (i). The phone layout uses LiveCounters
 * and MatchEntry instead, which share their state and locks with this
 * through `useLiveCounters`, `useMatchEntry` and `usePenaltyCounters`.
 */

/** Width of the pad's "+1 Tip" key; the minus button sits just left of it */
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

  return (
    <div className="relative h-full min-h-[6.5rem]">
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
        className={`grid h-full w-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] gap-x-3 rounded-2xl border-2 px-5 py-3.5 text-left select-none touch-manipulation transition-[transform,background-color,border-color,box-shadow,filter] duration-150 ease-out ${surface}`}
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
          className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-baseline justify-between gap-3"
        >
          <span className="flex items-baseline gap-2">
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
          {!tippingEnabled && lockedReason && (
            <span className="flex min-w-0 items-center gap-1.5 text-right text-xs font-medium">
              <Lock size={12} className="shrink-0" />
              {lockedReason}
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

      {/* Taking one back is its own, quieter button beside the key. */}
      <button
        type="button"
        disabled={!tippingEnabled || value <= 0}
        onClick={() => handleTipping(Math.max(0, value - 1))}
        aria-label={`Decrease ${ELEMENT_LABELS.tipping}`}
        className={`absolute bottom-3.5 right-[8.75rem] flex h-12 w-11 items-center justify-center rounded-xl border-2 touch-manipulation transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] disabled:pointer-events-none disabled:opacity-0 ${
          filled
            ? // Sits on the filled pad: drawn like its key, not as a hole
              isDarkMode
              ? 'border-black/25 bg-black/10 text-black hover:bg-black/20'
              : 'border-white/50 bg-black/10 text-white hover:bg-black/20'
            : isDarkMode
              ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10'
              : 'border-gray-500 bg-white text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Minus size={18} />
      </button>
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

  const endFields = [
    {
      label: ELEMENT_LABELS.flower,
      name: 'flower',
      info: FIELD_HINTS.flower,
      max: FIELD_LIMITS.flower,
      value: sessionData.flower,
      points: breakdown.flower,
      onChange: set.flower,
    },
    {
      label: ELEMENT_LABELS.flowerBonus,
      name: 'flower-bonus',
      info: FIELD_HINTS.flowerBonus,
      max: FIELD_LIMITS.flowerBonus,
      value: sessionData.flowerBonus,
      points: breakdown.flowerBonus,
      onChange: set.flowerBonus,
    },
    {
      label: ELEMENT_LABELS.hive,
      name: 'left-in-hive',
      info: FIELD_HINTS.ballsInHive,
      max: FIELD_LIMITS.ballsInHive,
      value: sessionData.ballsInHive,
      points: breakdown.hive,
      onChange: set.ballsInHive,
    },
    {
      label: ELEMENT_LABELS.garden,
      name: 'garden',
      info: FIELD_HINTS.garden,
      max: FIELD_LIMITS.garden,
      value: sessionData.garden,
      points: breakdown.garden,
      onChange: set.garden,
    },
  ];

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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {endFields.map(f => (
            <ScoreField
              key={f.name}
              label={f.label}
              name={f.name}
              layout="segment"
              stepper
              info={f.info}
              max={f.max}
              value={f.value}
              points={f.points}
              disabled={endDisabled}
              lockedReasonId={endReasonId}
              resetKey={entryKey}
              onChange={f.onChange}
            />
          ))}
        </div>
      </div>

      <BreakdownStrip />
    </section>
  );
};
