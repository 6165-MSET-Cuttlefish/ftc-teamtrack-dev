import { useRef } from 'react';
import { useSession, useTheme } from '@/contexts';
import { POINTS, calculateScore } from '@/lib';
import type { ScoreEvent } from '@/types';
import { ScoreField } from './ScoreField';

/**
 * Garden and Tipping are counted while the match runs. Flower and hive
 * contents are assessed after the buzzer and live in MatchEntry instead.
 */
export const LiveScoring = () => {
  const { sessionData, updateSessionData, matchPhase, matchActive, timer } =
    useSession();
  const { isDarkMode } = useTheme();

  /** Timestamp of the last live scoring change, for cycle times */
  const lastActionRef = useRef<number | null>(null);

  /**
   * Counts are whole-match totals, so there is no phase to assign them to —
   * they stay editable for the whole match, including after the buzzer, so a
   * miscount can be corrected before the match is saved.
   */
  const allowed = matchActive;
  const breakdown = calculateScore(sessionData);

  const record = (field: ScoreEvent['field'], value: number) => {
    const now = Date.now();
    const cycleTime =
      lastActionRef.current !== null
        ? parseFloat(((now - lastActionRef.current) / 1000).toFixed(2))
        : undefined;
    lastActionRef.current = now;

    const entry: ScoreEvent = {
      field,
      value,
      phase: matchPhase,
      timeRemaining: timer,
      cycleTime,
    };

    updateSessionData({
      [field]: value,
      phaseLog: [...(sessionData.phaseLog ?? []), entry],
    });
  };

  const liveTotal = breakdown.garden + breakdown.tipping;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-team-blue text-2xl font-semibold leading-6">
            Live Scoring
          </h2>
          <p
            className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {allowed
              ? 'Tap +/- or type a count and press Enter'
              : 'Start the match to begin scoring'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Live:
          </span>
          <span className="text-2xl font-bold text-team-blue tabular-nums">
            {liveTotal}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <ScoreField
          label="Tipping"
          hint={`${POINTS.HIVE_TIP} pts each — hive tips`}
          size="large"
          stepper
          value={sessionData.tipping}
          points={breakdown.tipping}
          disabled={!allowed}
          onChange={v => record('tipping', v)}
        />
        <ScoreField
          label="Garden"
          hint={`${POINTS.GARDEN} pt each`}
          size="large"
          stepper
          value={sessionData.garden}
          points={breakdown.garden}
          disabled={!allowed}
          onChange={v => record('garden', v)}
        />
      </div>
    </div>
  );
};
