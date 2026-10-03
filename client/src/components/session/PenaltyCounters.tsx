import { useState } from 'react';
import { X } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import { ELEMENT_LABELS, FIELD_LIMITS, POINTS } from '@/lib';
import { ScoreField } from './ScoreField';
import { usePenaltyCounters } from './usePenaltyCounters';

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
 * The first-time note for a Scrim's fouls, shown until dismissed on this
 * device: the fouls counters look like they should cost points, and they
 * don't.
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
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-4 ${
        isDarkMode
          ? 'border-team-blue-40 text-gray-300'
          : 'border-gray-300 bg-gray-50 text-gray-700'
      }`}
    >
      <p className="min-w-0 flex-1">
        Scrim: count your alliance&apos;s fouls here. Each one goes to the
        opponent ({POINTS.MINOR_PENALTY} minor, {POINTS.MAJOR_PENALTY} major)
        and never comes off your score.
      </p>
      <button
        type="button"
        aria-label="Dismiss fouls hint"
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
 * This alliance's fouls in a Scrim, under the robot rows in Match Entry.
 * They are not timed, so they can be counted any time before the match is
 * saved; above the robot rows they would push Leave and Park off a short
 * screen during AUTO, which is when those are watched.
 *
 * Fouls are credited to the opponent (MINOR 5, MAJOR 20) and never come off
 * this alliance's score, so they show what was given away rather than
 * points.
 */
export const PenaltyCounters = () => {
  const { minor, major, entryKey, handleMinorPenalties, handleMajorPenalties } =
    usePenaltyCounters();

  return (
    <>
      <PenaltyHint />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-2">
        <ScoreField
          label={ELEMENT_LABELS.minor}
          size="large"
          layout="stacked"
          stepper
          max={FIELD_LIMITS.minorPenalties}
          value={minor}
          opponentPoints={minor * POINTS.MINOR_PENALTY}
          resetKey={entryKey}
          onChange={handleMinorPenalties}
        />
        <ScoreField
          label={ELEMENT_LABELS.major}
          size="large"
          layout="stacked"
          stepper
          max={FIELD_LIMITS.majorPenalties}
          value={major}
          opponentPoints={major * POINTS.MAJOR_PENALTY}
          resetKey={entryKey}
          onChange={handleMajorPenalties}
        />
      </div>
    </>
  );
};
