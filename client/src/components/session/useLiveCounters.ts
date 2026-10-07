import { useCallback, useEffect, useRef } from 'react';
import { useSessionCore } from '@/contexts';
import { SESSION_LIMITS } from '@/constants';
import { FIELD_LIMITS, calculateScore } from '@/lib';
import type { ScoreEvent } from '@/types';
import { useLiveControls } from './controls';
import { requestStartNudge } from './controls/startNudge';
import { START_FIRST, useScoringLocks } from './useScoringLocks';

/** Adds a tip from a laptop keyboard while the match is being played */
export const TIP_SHORTCUT = 'T';

/** A press on a field that is waiting, which does nothing */
const ignorePress = () => {};

/**
 * State and handlers for Hive Tips, the counter tapped while the match runs:
 * shared by the phone layout's LiveCounters block and the desktop
 * ScoringPad, so tips are timed, locked and keyed the same way in both.
 * Only one of the two is mounted at a time, which keeps the T shortcut
 * registered once.
 */
export const useLiveCounters = () => {
  const {
    sessionData,
    updateSessionData,
    matchPhase,
    getTimers,
    isTutorialActive,
  } = useSessionCore();
  const {
    editing,
    scoring,
    entryKey,
    tippingEnabled,
    tippingLive,
    awaitingStart,
    entryLocked,
    inCountdown,
    clockRunning,
  } = useScoringLocks();
  const { pendingConfirm } = useLiveControls();

  const breakdown = calculateScore(scoring);

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

  // On a laptop every tip is otherwise a mouse aim at the button. The key
  // only counts while the match is being played, and never while something
  // is being typed or a dialog is asking a question.
  const tipping = sessionData.tipping;
  useEffect(() => {
    if (!tippingLive) return;
    const addTipOnKey = (e: KeyboardEvent) => {
      if (e.key.toUpperCase() !== TIP_SHORTCUT) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented)
        return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            'input, textarea, select, [role="dialog"]:not([data-tutorial-card])'
          ))
      ) {
        return;
      }
      // The tutorial's own card says to press T, so it doesn't block it.
      if (document.querySelector('[role="dialog"]:not([data-tutorial-card])'))
        return;
      if (tipping >= FIELD_LIMITS.tipping) return;
      e.preventDefault();
      recordTippingRef.current(tipping + 1);
    };
    document.addEventListener('keydown', addTipOnKey);
    return () => document.removeEventListener('keydown', addTipOnKey);
  }, [tippingLive, tipping]);

  return {
    sessionData,
    breakdown,
    entryKey,
    tippingEnabled,
    tippingLive,
    /**
     * Hive Tips always looks ready, as it will be once play is on, but takes
     * no taps before Start, in the 3-2-1 and while the walkthrough has no
     * match open: its buttons call this instead. Before Start it asks the
     * Start button to show it is the next step; otherwise Start has been
     * pressed (or the walkthrough says what to press), and a tap waits.
     */
    blockedPress: tippingEnabled
      ? undefined
      : entryLocked
        ? requestStartNudge
        : ignorePress,
    handleTipping,
    // The walkthrough's practice match stands for one being played, though
    // its clock never runs. While a question is open, its answer is the
    // next step: the button stays usable, as an outline.
    liveActionFilled:
      !pendingConfirm && (tippingLive || (isTutorialActive && tippingEnabled)),
    // Read out with the counter, not shown: it looks ready, and Start (or
    // the 3-2-1 on the clock) is what it waits for
    lockedReason: awaitingStart
      ? START_FIRST
      : inCountdown
        ? 'Unlocks when Auto starts'
        : undefined,
  };
};
