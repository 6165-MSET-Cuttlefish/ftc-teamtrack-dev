import { useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTheme } from '@/contexts';
import { FIELD_HINTS, FIELD_LIMITS, POINTS } from '@/lib';
import { ScoreField } from './ScoreField';
import { useLiveCounters } from './LiveCounters';
import { useMatchEntry } from './MatchEntry';
import { BreakdownStrip } from './ScoreBreakdown';

/**
 * Scoring on a full-size screen, laid out around how a match is watched.
 *
 * Two bands, in the order the match happens:
 *  - During play: a big Tips pad (the one thing tapped over and over, so the
 *    whole surface is the +1; T on the keyboard does the same), the robot
 *    leave/park matrix, and in a scrim the two foul counters.
 *  - After the buzzer: Flower, Bonus, Hive and Garden as joined steppers,
 *    greyed out until the clock stops.
 *  - Then the breakdown as one band across the bottom.
 *
 * No section headings or rules text: the controls name themselves, and the
 * rules sit behind each field's (i).
 */

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT');

const TipsPad = ({
  value,
  points,
  enabled,
  onChange,
}: {
  value: number;
  points: number;
  enabled: boolean;
  onChange: (value: number) => void;
}) => {
  const { isDarkMode } = useTheme();
  const max = FIELD_LIMITS.tipping;

  // Latest values for the key handler, so it is attached once.
  const state = useRef({ value, enabled, onChange });
  useEffect(() => {
    state.current = { value, enabled, onChange };
  });

  // T adds a tip, Shift+T takes one back. Not while typing anywhere, and not
  // with a modifier that belongs to a browser shortcut. No animation: a key
  // pressed this often should just change the number.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't' || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const { value: v, enabled: on, onChange: set } = state.current;
      if (!on) return;
      e.preventDefault();
      const next = e.shiftKey ? Math.max(0, v - 1) : Math.min(max, v + 1);
      if (next !== v) set(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [max]);

  const muted = isDarkMode ? 'text-white/45' : 'text-gray-500';
  const strong = isDarkMode ? 'text-white' : 'text-gray-900';

  return (
    <div className="relative h-full min-h-[6.5rem]">
      {/*
        The whole pad is the +1 button: the biggest target on the page for
        the one action repeated all match. It is drawn as a button, not a
        card: a raised gold surface with a + key, a lift on hover and a press
        on click, so nobody has to guess that it can be tapped.
      */}
      <button
        type="button"
        disabled={!enabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={`Add a tip, ${value} so far`}
        className={`group flex h-full w-full flex-col justify-between rounded-2xl border-2 px-5 py-3.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed ${
          enabled
            ? isDarkMode
              ? 'cursor-pointer border-team-blue/60 bg-team-blue/[0.12] shadow-[0_2px_0_0_rgb(var(--team-blue)/0.35),0_8px_20px_-8px_rgb(0_0_0/0.6)] [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:bg-team-blue/[0.16] active:translate-y-0 active:scale-[0.985] active:bg-team-blue/[0.2] active:shadow-[0_0_0_0_rgb(var(--team-blue)/0.35)]'
              : 'cursor-pointer border-team-blue/70 bg-team-blue/[0.1] shadow-[0_2px_0_0_rgb(var(--team-blue)/0.45),0_8px_20px_-10px_rgb(0_0_0/0.25)] [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:bg-team-blue/[0.14] active:translate-y-0 active:scale-[0.985] active:shadow-none'
            : isDarkMode
              ? 'border-white/10 bg-white/[0.02]'
              : 'border-gray-200 bg-gray-50'
        }`}
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span
              className={`text-base font-semibold ${enabled ? strong : muted}`}
              title={FIELD_HINTS.tipping}
            >
              Tips
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${enabled ? 'text-team-blue' : muted}`}
            >
              {points} pts
            </span>
          </span>
        </span>
        <span className="flex w-full items-end justify-between">
          <span
            className={`text-[2.75rem] font-bold leading-none tabular-nums tracking-tight ${enabled ? strong : muted}`}
          >
            {value}
          </span>
          {/* The + key: what makes the pad read as a button at a glance. */}
          <span
            aria-hidden
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-150 ease-out group-active:scale-95 ${
              enabled
                ? 'bg-team-blue text-[#191919] shadow-[0_2px_6px_-1px_rgb(0_0_0/0.4)]'
                : isDarkMode
                  ? 'bg-white/[0.06] text-white/25'
                  : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Plus size={24} strokeWidth={2.75} />
          </span>
        </span>
      </button>

      {/* Undo sits beside the + key but is its own, quieter button. */}
      <button
        type="button"
        disabled={!enabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Remove a tip"
        className={`absolute bottom-3.5 right-[4.75rem] flex h-12 w-10 items-center justify-center rounded-xl border transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] disabled:pointer-events-none disabled:opacity-0 ${
          isDarkMode
            ? 'border-white/15 bg-black/40 text-white/80 hover:bg-white/10'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        <Minus size={18} />
      </button>
    </div>
  );
};

/** One leave/park chip. Filled gold when on. */
const Chip = ({
  on,
  label,
  ariaLabel,
  disabledReason,
  onChange,
}: {
  on: boolean;
  label: string;
  ariaLabel: string;
  disabledReason?: string;
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
      disabled={disabled}
      title={disabledReason}
      onClick={() => onChange(!on)}
      className={`h-11 min-w-0 rounded-xl border px-2 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96] select-none disabled:cursor-not-allowed disabled:opacity-35 ${
        on
          ? isDarkMode
            ? 'border-team-blue bg-team-blue text-[#191919]'
            : 'border-team-blue bg-team-blue text-white'
          : isDarkMode
            ? 'border-white/15 bg-black/20 text-white/75 hover:border-white/30 hover:text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
};

export const ScoringPad = () => {
  const { isDarkMode } = useTheme();
  const live = useLiveCounters();
  const entry = useMatchEntry();
  const { sessionData, set, breakdown, entryKey, endDisabled } = entry;
  const { autoDisabledReason, parkTeleopDisabledReason } = entry;

  const rowLabel = `text-xs font-semibold tabular-nums ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`;

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

  return (
    <section aria-label="Scoring" className="space-y-5">
      <div
        className={`grid items-stretch gap-5 ${
          live.isScrim
            ? 'grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.8fr)]'
            : 'grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'
        }`}
      >
        <div data-tutorial="live">
          <TipsPad
            value={sessionData.tipping}
            points={live.breakdown.tipping}
            enabled={live.tippingEnabled}
            onChange={live.handleTipping}
          />
        </div>

        <div
          data-tutorial="robots"
          className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] content-center items-center gap-x-2 gap-y-2.5"
        >
          {robots.map(r => (
            <div key={r.id} className="contents">
              <span className={rowLabel} aria-hidden>
                R{r.id}
              </span>
              <Chip
                on={r.leave}
                label="Leave"
                ariaLabel={`Robot ${r.id} leave`}
                disabledReason={autoDisabledReason}
                onChange={r.onLeave}
              />
              <Chip
                on={r.parkAuto}
                label="Auto park"
                ariaLabel={`Robot ${r.id} parked at end of auto`}
                disabledReason={autoDisabledReason}
                onChange={r.onParkAuto}
              />
              <Chip
                on={r.parkEnd}
                label="End park"
                ariaLabel={`Robot ${r.id} parked at end of match`}
                disabledReason={parkTeleopDisabledReason}
                onChange={r.onParkEnd}
              />
            </div>
          ))}
        </div>

        {live.isScrim && (
          <div
            data-tutorial="penalties"
            className="flex flex-col justify-center gap-2"
          >
            <ScoreField
              label="Minor"
              name="minor-penalty"
              layout="segment"
              stepper
              info={FIELD_HINTS.minorPenalties}
              max={FIELD_LIMITS.minorPenalties}
              value={sessionData.minorPenalties}
              opponentPoints={sessionData.minorPenalties * POINTS.MINOR_PENALTY}
              resetKey={live.entryKey}
              onChange={live.handleMinorPenalties}
            />
            <ScoreField
              label="Major"
              name="major-penalty"
              layout="segment"
              stepper
              info={FIELD_HINTS.majorPenalties}
              max={FIELD_LIMITS.majorPenalties}
              value={sessionData.majorPenalties}
              opponentPoints={sessionData.majorPenalties * POINTS.MAJOR_PENALTY}
              resetKey={live.entryKey}
              onChange={live.handleMajorPenalties}
            />
          </div>
        )}
      </div>

      <div data-tutorial="end-of-match" className="grid grid-cols-4 gap-5">
        <ScoreField
          label="Flower"
          layout="segment"
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
          label="Bonus"
          name="flower-bonus"
          layout="segment"
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
          label="Hive"
          name="left-in-hive"
          layout="segment"
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
          layout="segment"
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

      <BreakdownStrip />
    </section>
  );
};
