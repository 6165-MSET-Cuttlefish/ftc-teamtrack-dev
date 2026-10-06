import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import { ELEMENT_LABELS, FIELD_LIMITS, POINTS } from '@/lib';
import { ScoreField } from './ScoreField';

/** Set once the scrim penalties hint has been dismissed on this device */
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
 * The first-time note for a Scrim's penalties, shown until dismissed on this
 * device: the counters look like they should cost points, and they don't.
 * It is the one place the rule is spelt out; the counters only say what
 * they have given away.
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
      // A tint, not a frame: the outlined things on the page are controls
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs leading-4 ${
        isDarkMode
          ? 'bg-white/[0.05] text-gray-300'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      {/* Each value stays with its name when the line wraps on a phone */}
      <p className="min-w-0 flex-1">
        Penalties go to the opponent (Minor&nbsp;+{POINTS.MINOR_PENALTY},
        Major&nbsp;+{POINTS.MAJOR_PENALTY}). They never lower your score.
      </p>
      <button
        type="button"
        aria-label="Dismiss penalties hint"
        onClick={dismissHint}
        className={`-my-1 -mr-1.5 inline-flex shrink-0 items-center justify-center rounded p-1 transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
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
 * One penalty counter: 'Minor' or 'Major' (the PENALTIES heading above says
 * what they are), what they have given the opponent, and the stepper, drawn
 * as one joined control like the end-of-match counters.
 *
 * '+N to opponent' only shows once there is something to give, in a line
 * kept for it from the start, so nothing moves when the first one is
 * counted. `segment` is the desktop pad's: the line sits beside the label.
 * `stacked` is the phone's: it sits under the label, in a line of one fixed
 * height. Why the counters are locked is read out from outside them (the
 * phone's Penalties heading, the desktop pad's), and `lockedReasonId`
 * points at it.
 */
export const PenaltyField = ({
  kind,
  value,
  locked,
  lockedReasonId,
  resetKey,
  onChange,
  layout,
}: {
  kind: 'minor' | 'major';
  value: number;
  locked: boolean;
  lockedReasonId?: string;
  resetKey: string;
  onChange: (value: number) => void;
  layout: 'stacked' | 'segment';
}) => {
  const { isDarkMode } = useTheme();
  const opponentId = useId();
  const each = kind === 'minor' ? POINTS.MINOR_PENALTY : POINTS.MAJOR_PENALTY;
  const toOpponent = value * each;
  const label = kind === 'minor' ? 'Minor' : 'Major';

  // Readable while locked: the stepper shows the lock
  const labelClass = `text-sm font-semibold leading-5 ${
    isDarkMode ? 'text-gray-200' : 'text-gray-800'
  }`;
  const opponent = (
    <span
      id={opponentId}
      // Hidden, not removed, at 0: its line stays the same height
      className={`whitespace-nowrap text-xs font-semibold leading-4 tabular-nums ${
        toOpponent > 0
          ? isDarkMode
            ? 'text-red-400'
            : 'text-red-700'
          : 'invisible'
      }`}
    >
      +{toOpponent} to opponent
    </span>
  );

  const field = (
    <ScoreField
      label={label}
      ariaName={ELEMENT_LABELS[kind]}
      hideLabel
      describedBy={toOpponent > 0 ? opponentId : undefined}
      layout="segment"
      stepper
      max={
        kind === 'minor'
          ? FIELD_LIMITS.minorPenalties
          : FIELD_LIMITS.majorPenalties
      }
      value={value}
      disabled={locked}
      lockedReasonId={lockedReasonId}
      resetKey={resetKey}
      onChange={onChange}
    />
  );

  return layout === 'segment' ? (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span aria-hidden className={labelClass}>
          {label}
        </span>
        {opponent}
      </div>
      {field}
    </div>
  ) : (
    <div className="min-w-0 space-y-1">
      <div aria-hidden className={labelClass}>
        {label}
      </div>
      {/* One height whatever it holds: the text's own 16px line */}
      <div className="flex h-4 items-center">{opponent}</div>
      {field}
    </div>
  );
};
