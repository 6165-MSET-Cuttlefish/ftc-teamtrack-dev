import { useId, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import { ELEMENT_LABELS, FIELD_LIMITS, POINTS } from '@/lib';
import { FOULS_RULE } from '@/lib/scoring';
import { ScoreField } from './ScoreField';

/** Set once the scrim fouls hint has been dismissed on this device */
const PENALTY_HINT_SEEN_KEY = 'teamtrack-penalty-hint-seen';

const penaltyHintSeen = () => {
  try {
    return localStorage.getItem(PENALTY_HINT_SEEN_KEY) === 'true';
  } catch {
    // Storage is blocked: the hint would come back on every visit.
    return true;
  }
};

/**
 * The phone's first-time note for a Scrim's fouls, shown until dismissed on
 * this device: the counters look like they should cost points, and they
 * don't. It is where the phone spells the rule out; the counters only say
 * what they have given away. (The desktop pad has it behind the FOULS
 * heading's (i).)
 */
export const PenaltyHint = () => {
  const { isTutorialActive } = useSessionCore();
  const { isDarkMode } = useTheme();
  const [hintDismissed, setHintDismissed] = useState(penaltyHintSeen);
  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(PENALTY_HINT_SEEN_KEY, 'true');
    } catch {
      // Dismissed for this visit only.
    }
  };
  if (hintDismissed || isTutorialActive) return null;

  return (
    <div
      role="note"
      // No frame (the outlined things on the page are controls) and no fill
      // (the filled band under it is the end-of-match lock): a muted line
      // Icon and × level with the first line when the text wraps
      // As wide as its words on a wide layout, so the × stays beside them
      className={`flex items-start gap-2 text-xs leading-4 md:w-fit md:max-w-full ${
        isDarkMode ? 'text-gray-300' : 'text-gray-700'
      }`}
    >
      <Info size={14} aria-hidden className="mt-px shrink-0" />
      {/* A note in sentences, where the (i) rules go without the period */}
      <p className="min-w-0 flex-1 text-balance">{FOULS_RULE}.</p>
      <button
        type="button"
        aria-label="Dismiss fouls hint"
        onClick={dismissHint}
        // A 24px button, so its × lines up with the steppers' edge on any
        // pointer; under a finger an empty ::after makes the target 44px.
        className={`relative -my-1 -mr-1.5 inline-flex min-h-0 min-w-0 shrink-0 items-center justify-center rounded p-1 transition-colors after:absolute after:inset-0 after:content-[''] [@media(pointer:coarse)]:after:-inset-2.5 ${
          isDarkMode
            ? 'text-gray-400 hover:text-white'
            : 'text-gray-500 hover:text-black'
        }`}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
};

/**
 * One foul counter: 'Minor' or 'Major' (the FOULS heading above says what
 * they are; a screen reader hears "Minor Foul"), and the stepper, drawn as
 * one joined control like the end-of-match counters.
 *
 * `stacked` is the phone's: the name, then what they have given the
 * opponent ('+N to opponent', only once there is something to give, in a
 * line of one fixed height kept for it from the start, so nothing moves
 * when the first one is counted), then the stepper. `row` is the desktop
 * pad's: the name and the stepper on one line, level with a robot row (the
 * pad says what they gave once, on the heading's line). Why the counters
 * take nothing yet is read out from outside them, and `lockedReasonId`
 * points at it.
 */
export const PenaltyField = ({
  kind,
  value,
  blockedPress,
  lockedReasonId,
  resetKey,
  onChange,
  layout,
}: {
  kind: 'minor' | 'major';
  value: number;
  /** Before Start: drawn ready, and a press asks for Start (see ScoreField) */
  blockedPress?: () => void;
  lockedReasonId?: string;
  resetKey: string;
  onChange: (value: number) => void;
  layout: 'stacked' | 'row';
}) => {
  const { isDarkMode } = useTheme();
  const opponentId = useId();
  const each = kind === 'minor' ? POINTS.MINOR_PENALTY : POINTS.MAJOR_PENALTY;
  const toOpponent = value * each;
  const label = kind === 'minor' ? 'Minor' : 'Major';
  const stacked = layout === 'stacked';

  // Readable while it waits: the stepper shows what it can do
  const labelClass = `text-sm font-semibold leading-5 ${
    isDarkMode ? 'text-gray-200' : 'text-gray-800'
  }`;

  const field = (
    <ScoreField
      label={label}
      ariaName={ELEMENT_LABELS[kind]}
      hideLabel
      describedBy={stacked && toOpponent > 0 ? opponentId : undefined}
      layout="segment"
      stepper
      max={
        kind === 'minor'
          ? FIELD_LIMITS.minorPenalties
          : FIELD_LIMITS.majorPenalties
      }
      value={value}
      blockedPress={blockedPress}
      lockedReasonId={lockedReasonId}
      resetKey={resetKey}
      onChange={onChange}
    />
  );

  if (!stacked) {
    return (
      <>
        <span aria-hidden className={`whitespace-nowrap ${labelClass}`}>
          {label}
        </span>
        {field}
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      <div aria-hidden className={labelClass}>
        {label}
      </div>
      {/* One height whatever it holds: the text's own 16px line */}
      <div className="flex h-4 items-center">
        <ToOpponent id={opponentId} points={toOpponent} />
      </div>
      {field}
    </div>
  );
};

/**
 * What fouls have given the opponent: '+N to opponent', in the foul colour
 * once there is something to give. Hidden, not removed, at 0, so its line
 * keeps its height.
 */
export const ToOpponent = ({ id, points }: { id?: string; points: number }) => {
  const { isDarkMode } = useTheme();
  return (
    <span
      id={id}
      className={`whitespace-nowrap text-xs font-semibold leading-4 tabular-nums ${
        points > 0
          ? isDarkMode
            ? 'text-red-400'
            : 'text-red-700'
          : 'invisible'
      }`}
    >
      +{points} to opponent
    </span>
  );
};
