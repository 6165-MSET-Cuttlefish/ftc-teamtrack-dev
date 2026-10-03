import { useCallback, useEffect, useRef } from 'react';
import { useSessionCore } from '@/contexts';
import { SESSION_LIMITS } from '@/constants';
import { FIELD_LIMITS, POINTS, calculateScore } from '@/lib';
import type { ScoreEvent } from '@/types';
import { ScoreField } from './ScoreField';
import { useScoringLocks } from './useScoringLocks';

/**
 * The counters tapped while the match is running: Tipping and, in a Scrim,
 * this alliance's fouls. They get a block of their own — outside Match
 * Entry's Robots section — so both layouts can keep them next to the clock.
 *
 * Fouls are credited to the opponent (MINOR 5, MAJOR 20) and never come off
 * this alliance's score, so they show what was given away rather than
 * points.
 */
/**
 * State and handlers for the live counters, shared by the phone layout's
 * LiveCounters block and the desktop ScoringPanel so tipping is timed the
 * same way in both.
 */
export const useLiveCounters = () => {
  const { sessionData, updateSessionData, matchPhase, getTimers } =
    useSessionCore();
  const { editing, scoring, entryKey, tippingEnabled, clockRunning } =
    useScoringLocks();

  const breakdown = calculateScore(scoring);
  const isScrim = sessionData.sessionType === 'Scrim';

  /**
   * When the last tip was counted, for cycle times. A performance.now()
   * reading, so a change to the device clock between two tips doesn't end up
   * in the gap.
   */
  const lastTipRef = useRef<number | null>(null);

  // A cycle is the gap between two tips in one stretch of play. Whenever the
  // clock isn't running — between matches, paused, controller pickup, after
  // the buzzer — the stretch is over and the next tip starts a new one.
  useEffect(() => {
    if (!clockRunning) lastTipRef.current = null;
  }, [clockRunning]);

  /**
   * Tipping is counted while the match runs, so each change is logged with
   * its phase and time. Only a single +1 tap made while the clock is running
   * is a tip that just happened; a correction, a typed total or a count
   * adjusted after the buzzer changes the number without being timed.
   */
  const recordTipping = (value: number) => {
    // A saved match's timeline is history: correcting its count must not
    // stamp it with whatever the clock is doing now.
    if (editing) {
      updateSessionData({ tipping: value });
      return;
    }

    let cycleTime: number | undefined;
    if (clockRunning && value === sessionData.tipping + 1) {
      const now = performance.now();
      if (lastTipRef.current !== null) {
        cycleTime = parseFloat(((now - lastTipRef.current) / 1000).toFixed(2));
      }
      lastTipRef.current = now;
    }

    const entry: ScoreEvent = {
      field: 'tipping',
      value,
      phase: matchPhase,
      timeRemaining: getTimers().timer,
      ...(cycleTime !== undefined ? { cycleTime } : {}),
    };

    updateSessionData({
      tipping: value,
      // Bounded so a long session can't grow past what a save can hold.
      phaseLog: [...(sessionData.phaseLog ?? []), entry].slice(
        -SESSION_LIMITS.MAX_CYCLE_TIMES
      ),
    });
  };

  // ScoreField is memoized: handlers that keep their identity mean a tap on
  // one counter re-renders that counter only.
  const recordTippingRef = useRef(recordTipping);
  useEffect(() => {
    recordTippingRef.current = recordTipping;
  });
  const handleTipping = useCallback(
    (value: number) => recordTippingRef.current(value),
    []
  );
  const handleMinorPenalties = useCallback(
    (value: number) => updateSessionData({ minorPenalties: value }),
    [updateSessionData]
  );
  const handleMajorPenalties = useCallback(
    (value: number) => updateSessionData({ majorPenalties: value }),
    [updateSessionData]
  );

  return {
    sessionData,
    breakdown,
    isScrim,
    entryKey,
    tippingEnabled,
    handleTipping,
    handleMinorPenalties,
    handleMajorPenalties,
  };
};

export const LiveCounters = () => {
  const {
    sessionData,
    breakdown,
    isScrim,
    entryKey,
    tippingEnabled,
    handleTipping,
    handleMinorPenalties,
    handleMajorPenalties,
  } = useLiveCounters();

  return (
    // `gap`, not `space-y`: the heading is visually hidden on a phone and
    // must not leave its margin behind on the first counter.
    <div className="flex flex-col gap-2" data-tutorial="live">
      <h2 className="sr-only md:not-sr-only md:text-team-blue md:text-xl md:font-semibold md:leading-6">
        Live Scoring
      </h2>
      <ScoreField
        label="Tipping"
        size="large"
        stepper
        max={FIELD_LIMITS.tipping}
        value={sessionData.tipping}
        points={breakdown.tipping}
        disabled={!tippingEnabled}
        resetKey={entryKey}
        onChange={handleTipping}
      />
      {isScrim && (
        <div
          className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-2"
          data-tutorial="penalties"
        >
          <ScoreField
            label="Minor Penalty"
            size="large"
            layout="stacked"
            stepper
            max={FIELD_LIMITS.minorPenalties}
            value={sessionData.minorPenalties}
            opponentPoints={sessionData.minorPenalties * POINTS.MINOR_PENALTY}
            resetKey={entryKey}
            onChange={handleMinorPenalties}
          />
          <ScoreField
            label="Major Penalty"
            size="large"
            layout="stacked"
            stepper
            max={FIELD_LIMITS.majorPenalties}
            value={sessionData.majorPenalties}
            opponentPoints={sessionData.majorPenalties * POINTS.MAJOR_PENALTY}
            resetKey={entryKey}
            onChange={handleMajorPenalties}
          />
        </div>
      )}
    </div>
  );
};
