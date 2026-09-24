import { useRef } from 'react';
import { useSession, useTheme } from '@/contexts';
import { POINTS, calculateScore } from '@/lib';
import type { ScoreEvent } from '@/types';
import { ScoreField } from './ScoreField';

/**
 * Garden and Tipping are counted while the match runs. Flower and hive
 * contents are assessed after the buzzer and live in MatchEntry instead.
 *
 * In a scrim the opponent's fouls happen live too, so penalties are counted
 * here; in practice they stay with the post-match entry.
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
  const isScrim = sessionData.sessionType === 'Scrim';

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-team-blue text-xl font-semibold leading-6">
          Live Scoring
        </h2>
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

      <div className="space-y-2">
        <ScoreField
          label="Tipping"
          size="large"
          stepper
          value={sessionData.tipping}
          points={breakdown.tipping}
          disabled={!allowed}
          onChange={v => record('tipping', v)}
        />
        <ScoreField
          label="Garden"
          size="large"
          stepper
          value={sessionData.garden}
          points={breakdown.garden}
          disabled={!allowed}
          onChange={v => record('garden', v)}
        />
        {isScrim && (
          <>
            <ScoreField
              label="Minor Penalty"
              size="large"
              stepper
              value={sessionData.minorPenalties}
              points={-(sessionData.minorPenalties * POINTS.MINOR_PENALTY)}
              onChange={v => updateSessionData({ minorPenalties: v })}
            />
            <ScoreField
              label="Major Penalty"
              size="large"
              stepper
              value={sessionData.majorPenalties}
              points={-(sessionData.majorPenalties * POINTS.MAJOR_PENALTY)}
              onChange={v => updateSessionData({ majorPenalties: v })}
            />
          </>
        )}
      </div>
    </div>
  );
};
