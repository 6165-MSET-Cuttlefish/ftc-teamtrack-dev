/**
 * Match clock model.
 *
 * Pure functions over `SessionClockState`: the match, controller-pickup and
 * session clocks are anchored to wall-clock timestamps, and the seconds shown
 * on screen are derived from them. Nothing here counts ticks, so a frozen,
 * backgrounded or reloaded page catches up to the real field time.
 */

import { GAME_TIMING } from '@/constants';
import type { MatchPhase } from '@/types';
import type { SessionClockState } from '@/types/storage';

/** What the clock needs to know about the session it belongs to */
export interface ClockEnv {
  matchType: string;
  /** Session was completed: nothing counts any more */
  completed: boolean;
  /** Session has been started, so the session clock should be counting */
  sessionRunning: boolean;
}

const AUTON_END_MS = GAME_TIMING.AUTON_END_REMAINING * 1000;
const PICKUP_MS = GAME_TIMING.CONTROLLER_PICKUP_SECONDS * 1000;
const TELEOP_MS = GAME_TIMING.TELEOP_DURATION_SECONDS * 1000;

/**
 * Longest stretch with the app not running (closed, or the device asleep)
 * that still counts as session time. Anything longer is time away: a session
 * picked up again the next day has not been going all night.
 */
export const SESSION_AWAY_LIMIT_MS = 30 * 60 * 1000;

/** Length of the match clock for a match type, in seconds */
export const matchDurationSeconds = (
  matchType: string = 'Full Game'
): number => {
  switch (matchType) {
    case 'Autonomous':
      return GAME_TIMING.AUTONOMOUS_DURATION_SECONDS; // 0:30
    case 'Teleop':
      return GAME_TIMING.TELEOP_DURATION_SECONDS; // 2:00
    case 'Full Game':
    default:
      // 3s countdown + 30s auto + 120s teleop
      return GAME_TIMING.FULL_GAME_DURATION_SECONDS;
  }
};

/** Match-clock fields for a match that has not started: full length, nothing counting */
export const idleMatchClock = (
  matchType: string
): Omit<SessionClockState, 'sessionAccumulatedMs' | 'sessionResumedAt'> => ({
  phase: matchType === 'Teleop' ? 'teleop' : 'auton',
  running: false,
  remainingMs: matchDurationSeconds(matchType) * 1000,
  deadline: null,
  pickupRemainingMs: 0,
  pickupDeadline: null,
  pickupPaused: false,
});

/** Clock of a brand-new session */
export const idleClock = (matchType: string): SessionClockState => ({
  ...idleMatchClock(matchType),
  sessionAccumulatedMs: 0,
  sessionResumedAt: null,
});

export const clocksEqual = (
  a: SessionClockState,
  b: SessionClockState
): boolean =>
  a.phase === b.phase &&
  a.running === b.running &&
  a.remainingMs === b.remainingMs &&
  a.deadline === b.deadline &&
  a.pickupRemainingMs === b.pickupRemainingMs &&
  a.pickupDeadline === b.pickupDeadline &&
  a.pickupPaused === b.pickupPaused &&
  a.sessionAccumulatedMs === b.sessionAccumulatedMs &&
  a.sessionResumedAt === b.sessionResumedAt;

/** Longest the match clock can have left in a phase, in ms */
const matchClockLimitMs = (phase: MatchPhase, matchType: string): number =>
  phase === 'teleop' ? TELEOP_MS : matchDurationSeconds(matchType) * 1000;

const clampMs = (value: number, max: number): number =>
  Math.min(Math.max(value, 0), max);

/**
 * Keep every anchor within what a real match allows: never more left than
 * the period is long, never session time that has not happened yet. Anchors
 * only leave that range when the device clock is changed or storage held
 * something else, and a clock reading 57:30 helps nobody.
 */
export const boundClock = (
  clock: SessionClockState,
  env: ClockEnv,
  now: number
): SessionClockState => {
  const limit = matchClockLimitMs(clock.phase, env.matchType);
  const next: SessionClockState = {
    ...clock,
    remainingMs: clampMs(clock.remainingMs, limit),
    deadline:
      clock.deadline === null ? null : Math.min(clock.deadline, now + limit),
    pickupRemainingMs: clampMs(clock.pickupRemainingMs, PICKUP_MS),
    pickupDeadline:
      clock.pickupDeadline === null
        ? null
        : Math.min(clock.pickupDeadline, now + PICKUP_MS),
    sessionAccumulatedMs: Math.max(0, clock.sessionAccumulatedMs),
    sessionResumedAt:
      clock.sessionResumedAt === null
        ? null
        : Math.min(clock.sessionResumedAt, now),
  };
  return clocksEqual(next, clock) ? clock : next;
};

/**
 * Account for the stretch between the last moment the app is known to have
 * been running (`lastAliveAt`) and `now`, where plain elapsed time would be
 * wrong:
 *
 * - `now` is earlier: the device clock was set back. Real time never runs
 *   backwards, so every anchor moves back with it and each clock carries on
 *   from the second it was showing.
 * - The stretch is longer than SESSION_AWAY_LIMIT_MS: it is left out of the
 *   session clock. The match clocks still count it; a match that was running
 *   played out on the field regardless.
 */
export const resyncClock = (
  clock: SessionClockState,
  lastAliveAt: number,
  now: number
): SessionClockState => {
  const gap = now - lastAliveAt;
  if (gap < 0) {
    if (
      clock.deadline === null &&
      clock.pickupDeadline === null &&
      clock.sessionResumedAt === null
    ) {
      return clock;
    }
    return {
      ...clock,
      deadline: clock.deadline === null ? null : clock.deadline + gap,
      pickupDeadline:
        clock.pickupDeadline === null ? null : clock.pickupDeadline + gap,
      sessionResumedAt:
        clock.sessionResumedAt === null ? null : clock.sessionResumedAt + gap,
    };
  }
  if (gap > SESSION_AWAY_LIMIT_MS && clock.sessionResumedAt !== null) {
    return {
      ...clock,
      sessionResumedAt: Math.min(now, clock.sessionResumedAt + gap),
    };
  }
  return clock;
};

/**
 * Make the anchors agree with the flags: a clock that should be counting
 * gets a deadline, one that should not gets its remaining time banked.
 */
export const anchorClock = (
  clock: SessionClockState,
  env: ClockEnv,
  now: number
): SessionClockState => {
  const next = { ...clock };

  const matchCounting =
    next.running &&
    !env.completed &&
    (next.phase === 'auton' || next.phase === 'teleop');
  if (matchCounting && next.deadline === null) {
    next.deadline = now + next.remainingMs;
  } else if (!matchCounting && next.deadline !== null) {
    next.remainingMs = Math.max(0, next.deadline - now);
    next.deadline = null;
  }

  const pickupCounting =
    next.phase === 'controller_pickup' && !next.pickupPaused && !env.completed;
  if (pickupCounting && next.pickupDeadline === null) {
    next.pickupDeadline = now + next.pickupRemainingMs;
  } else if (!pickupCounting && next.pickupDeadline !== null) {
    next.pickupRemainingMs = Math.max(0, next.pickupDeadline - now);
    next.pickupDeadline = null;
  }

  const sessionCounting = env.sessionRunning && !env.completed;
  if (sessionCounting && next.sessionResumedAt === null) {
    next.sessionResumedAt = now;
  } else if (!sessionCounting && next.sessionResumedAt !== null) {
    next.sessionAccumulatedMs += Math.max(0, now - next.sessionResumedAt);
    next.sessionResumedAt = null;
  }

  return next;
};

const endMatch = (clock: SessionClockState): SessionClockState => ({
  ...clock,
  phase: 'ended',
  running: false,
  remainingMs: 0,
  deadline: null,
});

/**
 * Bring the clock up to `now`, replaying every phase change that was due:
 * rest of AUTO -> 8 s controller pickup -> TELEOP -> ended. Each phase starts
 * when the previous one was due to end, not when this happened to run, so a
 * page that was frozen or closed across a phase change lands where the field
 * is.
 */
export const advanceClock = (
  clock: SessionClockState,
  env: ClockEnv,
  now: number
): SessionClockState => {
  let next = anchorClock(boundClock(clock, env, now), env, now);

  if (next.phase === 'auton' && next.deadline !== null) {
    if (env.matchType === 'Full Game') {
      // AUTO is over once the clock is down to the teleop length
      const autonEndsAt = next.deadline - AUTON_END_MS;
      if (now >= autonEndsAt) {
        next = {
          ...next,
          phase: 'controller_pickup',
          running: false,
          remainingMs: AUTON_END_MS,
          deadline: null,
          pickupRemainingMs: PICKUP_MS,
          pickupDeadline: autonEndsAt + PICKUP_MS,
          pickupPaused: false,
        };
      }
    } else if (now >= next.deadline) {
      next = endMatch(next);
    }
  }

  if (
    next.phase === 'controller_pickup' &&
    next.pickupDeadline !== null &&
    now >= next.pickupDeadline
  ) {
    next = {
      ...next,
      phase: 'teleop',
      running: true,
      remainingMs: TELEOP_MS,
      deadline: next.pickupDeadline + TELEOP_MS,
      pickupRemainingMs: 0,
      pickupDeadline: null,
    };
  }

  if (
    next.phase === 'teleop' &&
    next.deadline !== null &&
    now >= next.deadline
  ) {
    next = endMatch(next);
  }

  // The clock cannot run once the match is over
  if (next.phase === 'ended' && next.running) {
    next = { ...next, running: false };
  }

  return next;
};

/** Whole seconds left on the match clock (0:00 exactly when the period ends) */
export const matchSecondsLeft = (
  clock: SessionClockState,
  now: number
): number =>
  Math.max(
    0,
    Math.ceil(
      (clock.deadline !== null ? clock.deadline - now : clock.remainingMs) /
        1000
    )
  );

/** Whole seconds left of controller pickup */
export const pickupSecondsLeft = (
  clock: SessionClockState,
  now: number
): number =>
  Math.max(
    0,
    Math.ceil(
      (clock.pickupDeadline !== null
        ? clock.pickupDeadline - now
        : clock.pickupRemainingMs) / 1000
    )
  );

/** Whole seconds the session has been running */
export const sessionSeconds = (clock: SessionClockState, now: number): number =>
  Math.floor(
    (clock.sessionAccumulatedMs +
      (clock.sessionResumedAt !== null
        ? Math.max(0, now - clock.sessionResumedAt)
        : 0)) /
      1000
  );

/** Two clocks due to change within this many ms of each other share one update */
const COALESCE_MS = 40;

/**
 * Milliseconds until a counting clock next shows a different second (or a
 * phase change falls due). Null when nothing is counting.
 */
export const msUntilNextChange = (
  clock: SessionClockState,
  now: number
): number | null => {
  const waits: number[] = [];
  // Countdowns change as the time left crosses a whole second
  for (const deadline of [clock.deadline, clock.pickupDeadline]) {
    if (deadline === null) continue;
    const left = deadline - now;
    waits.push(left <= 0 ? 0 : left % 1000 || 1000);
  }
  if (clock.sessionResumedAt !== null) {
    const elapsed =
      clock.sessionAccumulatedMs + Math.max(0, now - clock.sessionResumedAt);
    waits.push(1000 - (elapsed % 1000));
  }
  if (waits.length === 0) return null;
  const soonest = Math.min(...waits);
  return Math.max(...waits.filter(wait => wait - soonest <= COALESCE_MS));
};
