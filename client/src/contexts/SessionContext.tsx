import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import {
  formatTime as formatTimeUtil,
  getDisplayTimer as getDisplayTimerUtil,
  calculateTotal,
  DEFAULT_ROBOT_COUNT,
  emptyScoringFields,
  pickScoringFields,
} from '@/lib';
import {
  hasDraftContent,
  isWorthStoring,
  saveSessionToStorage,
  loadStoredSession,
  removeStoredSession,
  readSessionToken,
  readStoredSessionSeenAt,
  markStoredSessionSeen,
  SESSION_REV_KEY,
  SESSION_STORAGE_CLEARED_EVENT,
  type StoredSession,
} from '@/lib/sessionPersistence';
import {
  advanceClock,
  anchorClock,
  clocksEqual,
  idleClock,
  idleMatchClock,
  matchSecondsLeft,
  msUntilNextChange,
  pickupSecondsLeft,
  resyncClock,
  sessionSeconds,
  SESSION_AWAY_LIMIT_MS,
  type ClockEnv,
} from '@/lib/matchClock';
import { matchAudioTime, TELEOP_AUDIO_OFFSET } from '@/lib/matchAudioTime';
import {
  clearMatchEditDraft,
  readMatchEditDraft,
  saveMatchEditDraft,
} from '@/lib/matchEditDraft';
import { finishedSessionOf } from '@/lib/sessionFinished';
import {
  defaultSessionName,
  forgetSessionNames,
  isStaleDefaultName,
  retypeDefaultSessionName,
  SESSION_NAMES_CHANGED_EVENT,
  setSessionNamesOwner,
} from '@/lib/sessionName';
import { GAME_TIMING, ROUTES, STORAGE_KEYS } from '@/constants';
import type {
  Match,
  SessionFormData,
  MatchPhase,
  MatchScoringFields,
} from '@/types';
import type { SessionClockState } from '@/types/storage';

interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
}

/**
 * The three clocks as they read now, in whole seconds. They are republished
 * every second while a session is running, so they live in a context of
 * their own: only components that show a clock re-render on a tick.
 */
interface SessionTimers {
  /** Match timer counts DOWN from 150 → 0 */
  timer: number;
  sessionTimer: number;
  /** Countdown for controller_pickup (8→0) phase */
  phaseTimer: number;
}

/**
 * The match clock as it stood at a moment, kept to be put back later (see
 * `resumeMatchClock`), with the wall clock and the page's steady clock at
 * that moment: a device clock set back meanwhile doesn't move it.
 */
export interface HeldMatchClock {
  clock: SessionClockState;
  /**
   * The match it is the clock of: when that match was started. Another tab
   * can replace the match with a new one under the same number.
   */
  match: number;
  wall: number;
  steady: number;
}

/** Everything about the session that does not change just because time passed */
interface SessionCoreContextType {
  sessionData: SessionFormData;
  updateSessionData: (updates: Partial<SessionFormData>) => void;
  /** Full replacement of session data (not a merge) */
  replaceSessionData: (data: SessionFormData) => void;
  completeSession: (timerValue: string) => void;
  /**
   * Go to a new session. A draft (not started, no saved matches, but notes
   * or changed settings) is the new session being set up and is kept;
   * `discardDraft` throws it away too.
   */
  resetSession: (options?: { discardDraft?: boolean }) => void;
  /**
   * Counts sessions: goes up whenever the session is reset (New Session,
   * Cancel Session, an account switch) or completed. Per-session UI state
   * can key off it.
   */
  sessionEpoch: number;
  /**
   * What the clocks read as of the last tick, for code that needs a clock
   * value at the moment something happens (a tap, a save) without
   * re-rendering every second to have it.
   */
  getTimers: () => SessionTimers;
  /**
   * The clocks' anchors as they stand, for code that needs the match clock
   * to the millisecond rather than in the whole seconds published (the
   * match audio).
   */
  getMatchClock: () => SessionClockState;
  setTimer: (timer: number) => void;
  setSessionTimer: (timer: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  resetTimer: () => void;
  formatTime: (seconds: number) => string;
  /** Current FTC match phase */
  matchPhase: MatchPhase;
  setMatchPhase: (phase: MatchPhase) => void;
  setPhaseTimer: (timer: number) => void;
  /** True while the controller-pickup countdown is frozen */
  isPickupPaused: boolean;
  /** Freeze or resume the controller-pickup countdown (no effect outside pickup) */
  setIsPickupPaused: (paused: boolean) => void;
  /**
   * True while the match clock is still above the playing time: the 3-2-1
   * before AUTO of a Full Game.
   */
  isMatchCountdown: boolean;
  hasActiveSession: boolean;
  hasStarted: boolean;
  setHasStarted: (started: boolean) => void;
  editingMatchId: string | null;
  startEditingMatch: (match: Match) => void;
  returnToCurrentMatch: () => void;
  saveEditedMatch: () => void;
  /** Whether the current match has been explicitly started (resets between matches) */
  matchActive: boolean;
  setMatchActive: (active: boolean) => void;
  /** AUTO (or controller pickup) of a Full Game straight to the start of TELEOP */
  skipToTeleop: () => void;
  /**
   * TELEOP straight to 1:00, when FLOWERS unlock
   * (GAME_TIMING.FLOWERS_UNLOCK_REMAINING left). A paused clock stays paused.
   */
  skipToFlowers: () => void;
  /**
   * A running match straight to the buzzer, from wherever it is: Skip to
   * Buzzer in its last period (TELEOP, or AUTO of an Autonomous match), or
   * ending it early from any point. The match ends just as if its clock had
   * run out.
   */
  skipToEnd: () => void;
  /** The match clock as it stands now, for `resumeMatchClock` */
  holdMatchClock: () => HeldMatchClock;
  /**
   * Put a held match clock back as if it had kept going since: one that was
   * counting has counted on, through the end of AUTO, controller pickup and
   * TELEOP, to the buzzer if its time ran out meanwhile; one that was paused
   * is where it was. The match is the one it was held from again (a
   * discarded match put back). Returns the clock as it now stands, for the
   * match audio to follow (see `followMatchClock`).
   */
  resumeMatchClock: (held: HeldMatchClock) => SessionClockState;
  /**
   * Whether `held` is the clock of the match in progress, and not of one
   * another tab has since put a new match in place of.
   */
  isCurrentMatch: (held: HeldMatchClock) => boolean;
  /** Convert raw countdown timer to display timer for a given phase */
  getDisplayTimer: (timer: number, phase: MatchPhase) => number;
  /** True when tutorial is active - prevents audio from playing */
  isTutorialActive: boolean;
  setIsTutorialActive: (active: boolean) => void;
}

type SessionContextType = SessionCoreContextType & SessionTimers;

/** Match clock values above this are the countdown before play starts */
const PLAYING_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

/** Longest the clocks go without being re-read from the wall clock, in ms */
const CLOCK_TICK_MS = 1000;
/** Shortest gap between two re-reads, in ms */
const CLOCK_MIN_TICK_MS = 10;
/** Quiet time after a change before it is written to localStorage, in ms */
const PERSIST_DELAY_MS = 300;
/** How often a tab with a running clock notes that the stored session is open in it, in ms */
const SEEN_MARK_INTERVAL_MS = 60 * 1000;

/**
 * A new session is ready to start as-is: named, set to Practice and to one
 * robot, so the first thing a user can do is press Start. The name says
 * what kind of session it is and which one ("Practice 4"); it can be
 * changed from the session menu.
 */
const createInitialSessionData = (): SessionFormData => {
  return {
    ...emptyScoringFields(),
    robotCount: DEFAULT_ROBOT_COUNT,
    sessionName: defaultSessionName('Practice'),
    sessionDuration: '',
    sessionType: 'Practice',
    matchType: 'Full Game',
    isSessionCompleted: false,
    selectedFeature: 'Cycle Times',
    notes: '',
    matches: [],
  };
};

/** Session flags that are stored alongside the session data and clocks */
interface SessionFlags {
  hasStarted: boolean;
  matchActive: boolean;
}

const flagsOf = (stored: StoredSession | null): SessionFlags => ({
  hasStarted: stored?.timerState.hasStarted ?? false,
  matchActive: stored?.timerState.matchActive ?? false,
});

/**
 * Everything a save would write, as one comparable string. Clocks appear as
 * their anchors, so the string only changes when this tab changes something,
 * never because time passed.
 */
const signatureOf = (
  data: SessionFormData,
  clock: SessionClockState,
  flags: SessionFlags
): string =>
  JSON.stringify([
    data,
    [
      clock.phase,
      clock.running,
      clock.remainingMs,
      clock.deadline,
      clock.pickupRemainingMs,
      clock.pickupDeadline,
      clock.pickupPaused,
      clock.sessionAccumulatedMs,
      clock.sessionResumedAt,
    ],
    [flags.hasStarted, flags.matchActive],
  ]);

/**
 * The same without the clock anchors: what the session is, not when. A tab
 * that only puts its anchors right (the device clock was set back, time away
 * was left out) stores a session whose state is still this.
 */
const stateSignatureOf = (
  data: SessionFormData,
  clock: SessionClockState,
  flags: SessionFlags
): string =>
  JSON.stringify([
    data,
    [clock.phase, clock.running, clock.pickupPaused],
    [flags.hasStarted, flags.matchActive],
  ]);

/**
 * Stop the match audio. /active does this itself while it is open; this is
 * for a match that goes away while another page is showing (sign-out, or
 * another tab ending it), where the track would otherwise play on.
 */
const stopMatchAudio = () => {
  const audio = (window as TeamTrackWindow).__teamtrack_match_audio__;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  try {
    sessionStorage.removeItem(STORAGE_KEYS.AUDIO_STATE);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Move the match audio to `time` in the track, for a match clock that has
 * jumped there, and start it from there if `play`. Otherwise a playing
 * track plays on from there and a paused one is picked up from there on
 * Resume.
 */
const cueMatchAudio = (time: number, play: boolean) => {
  const audio = (window as TeamTrackWindow).__teamtrack_match_audio__;
  if (!audio) return;
  audio.currentTime = time;
  if (play && audio.paused) audio.play().catch(() => {});
};

/** One toast for an edit another tab's change closed */
const EDIT_LOST_TOAST_ID = 'match-edit-lost';
/** One toast for a session another tab completed or closed */
const CLOSED_ELSEWHERE_TOAST_ID = 'session-closed-elsewhere';

/** "Match 2", for the saved match `matchId` among `matches` */
const matchName = (matches: Match[] | undefined, matchId: string): string => {
  const match = matches?.find(m => m.id === matchId);
  return match ? `Match ${match.matchNumber}` : 'the match';
};

const SessionCoreContext = createContext<SessionCoreContextType | undefined>(
  undefined
);
const SessionTimerContext = createContext<SessionTimers | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();

  // One read of storage per mount; every initial value below comes from it.
  const [initial] = useState(() => {
    const stored = loadStoredSession();
    const data = stored?.sessionData ?? createInitialSessionData();
    const clock = stored?.clock ?? idleClock(data.matchType);
    const flags = flagsOf(stored);
    // A saved match this tab had open for editing comes back open, as it
    // was left, if it is still in the session.
    const draft = stored ? readMatchEditDraft() : null;
    const edit =
      draft && data.matches?.some(match => match.id === draft.matchId)
        ? draft
        : null;
    return {
      data,
      edit,
      clock,
      flags,
      now: Date.now(),
      token: readSessionToken(),
      // A clock that had to be corrected on the way in is stored again
      signature: stored?.clockCorrected
        ? null
        : signatureOf(data, clock, flags),
      state: stateSignatureOf(data, clock, flags),
      restored: stored !== null,
      sessionStartTime: stored?.timerState.sessionStartTime ?? 0,
      matchStartTime: stored?.timerState.matchStartTime ?? 0,
    };
  });

  const [sessionData, setSessionData] = useState<SessionFormData>(() =>
    initial.edit ? { ...initial.data, ...initial.edit.fields } : initial.data
  );

  /**
   * The clocks. These anchors are the source of truth; `timer`, `phaseTimer`,
   * `sessionTimer`, `matchPhase`, `isTimerRunning` and `isPickupPaused` below
   * are what they currently read, republished on every tick.
   */
  const clockRef = useRef<SessionClockState>(initial.clock);
  const envRef = useRef<ClockEnv>({
    matchType: initial.data.matchType,
    completed: false,
    sessionRunning: initial.flags.hasStarted,
  });
  /**
   * Bumped when this tab changes a clock (start, pause, skip, reset), never
   * by a tick. Re-arms the tick and makes the session get stored again.
   */
  const [clockNonce, setClockNonce] = useState(0);

  const [timer, setTimerState] = useState<number>(() =>
    matchSecondsLeft(initial.clock, initial.now)
  );
  const [matchPhase, setMatchPhaseState] = useState<MatchPhase>(
    initial.clock.phase
  );
  const [phaseTimer, setPhaseTimerState] = useState<number>(() =>
    pickupSecondsLeft(initial.clock, initial.now)
  );
  const [sessionTimer, setSessionTimerState] = useState<number>(() =>
    sessionSeconds(initial.clock, initial.now)
  );
  const [isTimerRunning, setIsTimerRunningState] = useState(
    initial.clock.running
  );
  const [isPickupPaused, setIsPickupPausedState] = useState(
    initial.clock.pickupPaused
  );

  const [hasStarted, setHasStarted] = useState(initial.flags.hasStarted);

  const [editingMatchId, setEditingMatchId] = useState<string | null>(
    initial.edit?.matchId ?? null
  );
  const [currentMatchData, setCurrentMatchData] =
    useState<MatchScoringFields | null>(() =>
      initial.edit ? pickScoringFields(initial.data) : null
    );

  const [matchActive, setMatchActive] = useState<boolean>(
    initial.flags.matchActive
  );

  const [isTutorialActive, setTutorialActive] = useState<boolean>(false);
  const tutorialActiveRef = useRef(false);

  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionStartTimeRef = useRef(initial.sessionStartTime);
  const matchStartTimeRef = useRef(initial.matchStartTime);

  /**
   * Multi-tab bookkeeping. `lastSeenTokenRef` is the stored revision this tab
   * last wrote or read (null: nothing stored); if storage holds a different
   * one, another tab has written since. `lastSyncedRef` is the signature of
   * what this tab last wrote or loaded, so it only writes its own changes;
   * `lastSyncedStateRef` is the same without the clock anchors, and is kept
   * when those are put right. `holdsStoredSessionRef` says whether the
   * session on screen is one that was in storage, and so goes away if
   * another tab removes it from there.
   */
  const lastSeenTokenRef = useRef<string | null>(initial.token);
  const lastSyncedRef = useRef<string | null>(initial.signature);
  const lastSyncedStateRef = useRef(initial.state);
  const holdsStoredSessionRef = useRef(initial.restored);
  /** What a save would store right now, for handlers that outlive a render */
  const unsavedRef = useRef({ data: initial.data, flags: initial.flags });
  /** The saved match open for editing, with its fields as edited so far */
  const openEditRef = useRef<{
    matchId: string;
    fields: MatchScoringFields;
  } | null>(initial.edit);
  /** When this tab last noted that the stored session is open in it */
  const lastMarkedSeenRef = useRef(0);
  /** Flushes the write that is waiting out PERSIST_DELAY_MS, if any */
  const pendingPersistRef = useRef<(() => void) | null>(null);
  /**
   * The wall clock as of the last time the clocks were read against it, and
   * the page's own steady clock at that moment.
   */
  const lastReadRef = useRef({ wall: initial.now, steady: performance.now() });

  /** The clock readings last published, for `getTimers` */
  const timersRef = useRef<SessionTimers>({
    timer: matchSecondsLeft(initial.clock, initial.now),
    sessionTimer: sessionSeconds(initial.clock, initial.now),
    phaseTimer: pickupSecondsLeft(initial.clock, initial.now),
  });

  /** Push what the clocks read at `now` into state (no-ops when unchanged). */
  const publishClock = useCallback((now: number) => {
    const clock = clockRef.current;
    const timers: SessionTimers = {
      timer: matchSecondsLeft(clock, now),
      sessionTimer: sessionSeconds(clock, now),
      phaseTimer: pickupSecondsLeft(clock, now),
    };
    timersRef.current = timers;
    setTimerState(timers.timer);
    setPhaseTimerState(timers.phaseTimer);
    setSessionTimerState(timers.sessionTimer);
    setMatchPhaseState(clock.phase);
    setIsTimerRunningState(clock.running);
    setIsPickupPausedState(clock.pickupPaused);
  }, []);

  const getTimers = useCallback(() => timersRef.current, []);

  const getMatchClock = useCallback(() => clockRef.current, []);

  /**
   * Read the wall clock for the clocks. The anchors assume it only moves
   * forward, a second or so at a time; when it has been set back, or the
   * page was asleep for longer than counts as session time, they are put
   * right first (and stored again).
   */
  const readWallClock = useCallback((): number => {
    const now = Date.now();
    const steady = performance.now();
    const last = lastReadRef.current;
    lastReadRef.current = { wall: now, steady };
    // Set back: measure from where it would have been by now if left alone
    let aliveAt =
      now < last.wall ? last.wall + (steady - last.steady) : last.wall;
    // This tab has not looked for long enough to count as time away (it was
    // frozen in the background). The session was not away if another tab
    // had it open meanwhile.
    if (
      now - aliveAt > SESSION_AWAY_LIMIT_MS &&
      holdsStoredSessionRef.current &&
      readSessionToken() === lastSeenTokenRef.current
    ) {
      const seenAt = readStoredSessionSeenAt();
      if (seenAt !== null && seenAt <= now) aliveAt = Math.max(aliveAt, seenAt);
    }
    const resynced = resyncClock(clockRef.current, aliveAt, now);
    if (resynced !== clockRef.current) {
      clockRef.current = resynced;
      lastSyncedRef.current = null;
      setClockNonce(n => n + 1);
    }
    return now;
  }, []);

  /**
   * Install the clock `update` makes of the current one. A change made by
   * this tab (`own`) is only re-anchored here: callers set several values in
   * a row, and phase changes must wait until they are all in. They are
   * replayed by the tick that follows the render.
   */
  const commitClock = useCallback(
    (
      update: (clock: SessionClockState, now: number) => SessionClockState,
      own: boolean
    ) => {
      const now = readWallClock();
      const next = update(clockRef.current, now);
      const settled = own
        ? anchorClock(next, envRef.current, now)
        : advanceClock(next, envRef.current, now);
      const changed = !clocksEqual(settled, clockRef.current);
      if (changed) clockRef.current = settled;
      publishClock(now);
      if (changed && own) setClockNonce(n => n + 1);
    },
    [readWallClock, publishClock]
  );

  /** Catch every clock up to the wall clock, replaying any phase change that was due. */
  const tick = useCallback(() => {
    commitClock(clock => clock, false);
  }, [commitClock]);

  const setTimer = useCallback(
    (seconds: number) => {
      commitClock(
        clock => ({ ...clock, remainingMs: seconds * 1000, deadline: null }),
        true
      );
    },
    [commitClock]
  );

  const setIsTimerRunning = useCallback(
    (running: boolean) => {
      commitClock((clock, now) => {
        const next = anchorClock({ ...clock, running }, envRef.current, now);
        // A pause holds the second that was on screen: Resume carries on
        // from the start of it, and the match audio with it.
        return running
          ? next
          : { ...next, remainingMs: Math.ceil(next.remainingMs / 1000) * 1000 };
      }, true);
    },
    [commitClock]
  );

  const setMatchPhase = useCallback(
    (phase: MatchPhase) => {
      commitClock(clock => {
        if (phase === clock.phase) return clock;
        return {
          ...clock,
          phase,
          pickupRemainingMs:
            phase === 'controller_pickup'
              ? GAME_TIMING.CONTROLLER_PICKUP_SECONDS * 1000
              : 0,
          pickupDeadline: null,
          pickupPaused: false,
        };
      }, true);
    },
    [commitClock]
  );

  const setPhaseTimer = useCallback(
    (seconds: number) => {
      commitClock(
        clock => ({
          ...clock,
          pickupRemainingMs: seconds * 1000,
          pickupDeadline: null,
        }),
        true
      );
    },
    [commitClock]
  );

  const setIsPickupPaused = useCallback(
    (paused: boolean) => {
      commitClock(
        clock =>
          clock.phase === 'controller_pickup'
            ? { ...clock, pickupPaused: paused }
            : clock,
        true
      );
    },
    [commitClock]
  );

  const setSessionTimer = useCallback(
    (seconds: number) => {
      commitClock(
        clock => ({
          ...clock,
          sessionAccumulatedMs: seconds * 1000,
          sessionResumedAt: null,
        }),
        true
      );
    },
    [commitClock]
  );

  /** Put every piece of in-memory session state back to a brand-new session. */
  const resetState = useCallback(() => {
    const newSessionData = createInitialSessionData();
    const clock = idleClock(newSessionData.matchType);
    envRef.current = {
      matchType: newSessionData.matchType,
      completed: false,
      sessionRunning: false,
    };
    clockRef.current = clock;
    const now = Date.now();
    lastReadRef.current = { wall: now, steady: performance.now() };
    publishClock(now);
    setSessionData(newSessionData);
    setHasStarted(false);
    setMatchActive(false);
    setEditingMatchId(null);
    setCurrentMatchData(null);
    sessionStartTimeRef.current = 0;
    matchStartTimeRef.current = 0;
    holdsStoredSessionRef.current = false;
    lastSyncedRef.current = signatureOf(newSessionData, clock, flagsOf(null));
    lastSyncedStateRef.current = stateSignatureOf(
      newSessionData,
      clock,
      flagsOf(null)
    );
    unsavedRef.current = { data: newSessionData, flags: flagsOf(null) };
    setSessionEpoch(epoch => epoch + 1);
  }, [publishClock]);

  /** Replace this tab's session with the one another tab stored. */
  const adoptStoredSession = useCallback(
    (stored: StoredSession, token: string | null) => {
      const flags = flagsOf(stored);
      envRef.current = {
        matchType: stored.sessionData.matchType,
        completed: false,
        sessionRunning: flags.hasStarted,
      };
      clockRef.current = stored.clock;
      // Already brought up to this moment when it was read
      const now = Date.now();
      lastReadRef.current = { wall: now, steady: performance.now() };
      publishClock(now);
      setHasStarted(flags.hasStarted);
      setMatchActive(flags.matchActive);
      // Storage always holds the live match, never an edit in progress. A
      // match open for editing here stays open over the other tab's
      // session while it is still in it; otherwise the edit is gone, and
      // that is said.
      const edit = openEditRef.current;
      const editedMatch = edit
        ? stored.sessionData.matches?.find(match => match.id === edit.matchId)
        : undefined;
      if (edit && editedMatch) {
        setSessionData({ ...stored.sessionData, ...edit.fields });
        setCurrentMatchData(pickScoringFields(stored.sessionData));
      } else {
        setSessionData(stored.sessionData);
        setEditingMatchId(null);
        setCurrentMatchData(null);
        if (edit) {
          toast.warning(
            `Your edit to ${matchName(unsavedRef.current.data.matches, edit.matchId)} wasn't saved: the session changed in another tab`,
            { id: EDIT_LOST_TOAST_ID }
          );
        }
      }
      sessionStartTimeRef.current = stored.timerState.sessionStartTime;
      matchStartTimeRef.current = stored.timerState.matchStartTime;
      lastSeenTokenRef.current = token;
      holdsStoredSessionRef.current = true;
      lastSyncedRef.current = stored.clockCorrected
        ? null
        : signatureOf(stored.sessionData, stored.clock, flags);
      lastSyncedStateRef.current = stateSignatureOf(
        stored.sessionData,
        stored.clock,
        flags
      );
      unsavedRef.current = { data: stored.sessionData, flags };
      setClockNonce(n => n + 1);
    },
    [publishClock]
  );

  /**
   * Another tab has completed, discarded or signed out of the session this
   * tab was showing: say what became of it, rather than turn into a blank
   * new session without a word. Not for a tab that had not started it.
   */
  const sayClosedElsewhere = useCallback(() => {
    const { data, flags } = unsavedRef.current;
    const matches = data.matches ?? [];
    if (matches.length === 0 && !flags.hasStarted) return;
    const edit = openEditRef.current;
    const editLost = edit
      ? ` Your edit to ${matchName(matches, edit.matchId)} wasn't saved.`
      : '';
    const finished = finishedSessionOf(matches.map(match => match.id));
    if (finished) {
      // Above the router, so the way there is a page load.
      toast.message(
        `${finished.name} was completed in another tab.${editLost}`,
        {
          id: CLOSED_ELSEWHERE_TOAST_ID,
          action: {
            label: 'View',
            onClick: () =>
              window.location.assign(
                `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(finished.id)}`
              ),
          },
        }
      );
      return;
    }
    toast.message(
      `${data.sessionName || 'This session'} was closed in another tab.${editLost}`,
      { id: CLOSED_ELSEWHERE_TOAST_ID }
    );
  }, []);

  /**
   * Catch up with what another tab has stored since this tab last looked:
   * take its session, or go back to a fresh one if the session this tab was
   * showing has been completed, cancelled or signed out of there. A tab that
   * is showing a completed session, or running the tutorial, is left alone.
   *
   * 'kept' and 'own' both leave this tab's session in place for it to store:
   * 'kept' because nothing is stored, 'own' because what the other tab
   * stored is the session this tab already had with only its clocks put
   * right, while this tab holds a change that is not stored yet.
   */
  const syncFromStorage = useCallback(():
    | 'unchanged'
    | 'adopted'
    | 'reset'
    | 'kept'
    | 'own' => {
    if (tutorialActiveRef.current || envRef.current.completed)
      return 'unchanged';
    const token = readSessionToken();
    if (token === lastSeenTokenRef.current) return 'unchanged';

    const stored = token === null ? null : loadStoredSession(false);
    if (stored) {
      const synced = lastSyncedStateRef.current;
      const { data, flags } = unsavedRef.current;
      if (
        holdsStoredSessionRef.current &&
        stateSignatureOf(stored.sessionData, stored.clock, flagsOf(stored)) ===
          synced &&
        stateSignatureOf(data, clockRef.current, flags) !== synced
      ) {
        lastSeenTokenRef.current = token;
        return 'own';
      }
      adoptStoredSession(stored, token);
      return 'adopted';
    }

    lastSeenTokenRef.current = token;
    if (!holdsStoredSessionRef.current) return 'kept';
    sayClosedElsewhere();
    resetState();
    return 'reset';
  }, [adoptStoredSession, resetState, sayClosedElsewhere]);

  // The tutorial plays with real session state and puts it back when it
  // closes; other tabs' changes are picked up once it has.
  useEffect(() => {
    tutorialActiveRef.current = isTutorialActive;
    if (!isTutorialActive) syncFromStorage();
  }, [isTutorialActive, syncFromStorage]);

  /**
   * Nothing is stored while the tutorial has the session, so a write still
   * waiting out its delay is made first. Storage then holds the session as
   * the tutorial found it, which is what a reload mid-tutorial comes back to.
   */
  const setIsTutorialActive = useCallback((active: boolean) => {
    if (active) pendingPersistRef.current?.();
    setTutorialActive(active);
  }, []);

  /**
   * Bumped whenever the names a new session is numbered past may have
   * changed: the account, or its saved sessions read or saved.
   */
  const [namesVersion, setNamesVersion] = useState(0);
  useEffect(() => {
    const bump = () => setNamesVersion(version => version + 1);
    window.addEventListener(SESSION_NAMES_CHANGED_EVENT, bump);
    return () => window.removeEventListener(SESSION_NAMES_CHANGED_EVENT, bump);
  }, []);

  /**
   * Wipe the in-progress session when the signed-in account goes away (sign
   * out, or a different account signs in). Auth starts out null on every page
   * load, so only a change away from a known account counts — reacting to the
   * initial null would erase the session a reload just restored.
   */
  const prevUidRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.uid ?? null;
    const prevUid = prevUidRef.current;
    prevUidRef.current = uid;
    if (prevUid === uid) return;

    // A new session is numbered among this account's sessions, or among
    // this browser's for a guest.
    setSessionNamesOwner(uid);
    setNamesVersion(version => version + 1);

    if (prevUid) {
      forgetSessionNames();
      resetState();
      lastSeenTokenRef.current = null;
      removeStoredSession();
      return;
    }

    // A guest signed in (or up) and keeps the session they were running,
    // stored as it was: refresh the clocks for the account.
    if (prevUid === null) setClockNonce(n => n + 1);
  }, [user, authLoading, resetState]);

  // A session not started yet carries the next number of its type. Its name
  // was given before the account's sessions were known (a page load signs
  // in afterwards), or before one was saved under that number (in another
  // tab, on another device), or in the older dated form: it is given again.
  // A name the user typed is left alone (even "Practice 1"), and so is one a
  // started session already carries.
  const freshSession =
    !sessionData.isSessionCompleted &&
    !hasStarted &&
    !matchActive &&
    (sessionData.matches?.length ?? 0) === 0 &&
    !isTutorialActive;
  useEffect(() => {
    const type = sessionData.sessionType ?? 'Practice';
    if (
      !freshSession ||
      sessionData.sessionNameTyped ||
      !isStaleDefaultName(sessionData.sessionName, type)
    ) {
      return;
    }
    const name = defaultSessionName(type);
    if (name === sessionData.sessionName) return;
    setSessionData(prev =>
      prev.sessionName === sessionData.sessionName
        ? { ...prev, sessionName: name }
        : prev
    );
  }, [
    freshSession,
    sessionData.sessionName,
    sessionData.sessionNameTyped,
    sessionData.sessionType,
    namesVersion,
  ]);

  // Keep the clocks in step with the session they belong to, and replay any
  // phase change that fell due — after a start, pause or skip in this tab,
  // or once the session is started or completed.
  useEffect(() => {
    envRef.current = {
      matchType: sessionData.matchType,
      completed: sessionData.isSessionCompleted,
      sessionRunning: hasStarted,
    };
    tick();
  }, [
    sessionData.matchType,
    sessionData.isSessionCompleted,
    hasStarted,
    clockNonce,
    tick,
  ]);

  // Between matches the clock is sized for the selected match type, so every
  // Start Match begins with the right length and phase.
  useEffect(() => {
    if (matchActive || isTimerRunning || sessionData.isSessionCompleted) {
      return;
    }
    commitClock(
      clock => ({ ...clock, ...idleMatchClock(sessionData.matchType) }),
      true
    );
  }, [
    sessionData.matchType,
    sessionData.isSessionCompleted,
    matchActive,
    isTimerRunning,
    commitClock,
  ]);

  /**
   * A tab whose clock is running is a tab the session is open in, even when
   * nothing in it changes for an hour. Say so about once a minute, so that
   * a second window opened then, or a background tab woken up, does not
   * take the quiet stretch for time away. Not when what is stored is not
   * this tab's clock as it now stands.
   */
  const markSeenIfDue = useCallback(() => {
    const now = Date.now();
    if (Math.abs(now - lastMarkedSeenRef.current) < SEEN_MARK_INTERVAL_MS) {
      return;
    }
    if (
      holdsStoredSessionRef.current &&
      lastSyncedRef.current !== null &&
      readSessionToken() === lastSeenTokenRef.current
    ) {
      lastMarkedSeenRef.current = now;
      markStoredSessionSeen();
    }
  }, []);

  const clockIsLive =
    !sessionData.isSessionCompleted &&
    (hasStarted || isTimerRunning || matchPhase === 'controller_pickup');

  // Re-read the clocks each time one of them is due to show a new second.
  // Timed against the wall clock, so the display never drifts and each
  // period ends on the tick that reaches 0:00.
  useEffect(() => {
    if (!clockIsLive) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const run = () => {
      tick();
      markSeenIfDue();
      const wait = msUntilNextChange(clockRef.current, Date.now());
      timeout = setTimeout(
        run,
        Math.min(
          Math.max(wait ?? CLOCK_TICK_MS, CLOCK_MIN_TICK_MS),
          CLOCK_TICK_MS
        )
      );
    };
    run();

    return () => {
      clearTimeout(timeout);
    };
  }, [clockIsLive, clockNonce, tick, markSeenIfDue]);

  useEffect(() => {
    if (hasStarted && !sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now();
    }
  }, [hasStarted]);

  useEffect(() => {
    if (!matchActive) {
      matchStartTimeRef.current = 0;
    } else if (!matchStartTimeRef.current) {
      matchStartTimeRef.current = Date.now();
    }
  }, [matchActive]);

  // No match, no match audio, whichever page is showing when the match goes.
  useEffect(() => {
    if (!matchActive) stopMatchAudio();
  }, [matchActive]);

  useEffect(() => {
    // Going out of sight may be the last this page runs: store what is
    // pending, and note that the stored session was still open at this
    // point (unless what is stored is not this tab's clock as it now stands).
    const handleHide = () => {
      tick();
      pendingPersistRef.current?.();
      if (
        holdsStoredSessionRef.current &&
        lastSyncedRef.current !== null &&
        readSessionToken() === lastSeenTokenRef.current
      ) {
        markStoredSessionSeen();
      }
    };
    // Timers are throttled or stopped while the page is hidden or frozen;
    // catch up the moment it is back, and pick up other tabs' changes.
    const handleWake = () => {
      if (document.visibilityState === 'hidden') {
        handleHide();
        return;
      }
      tick();
      syncFromStorage();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === null || event.key === SESSION_REV_KEY) {
        syncFromStorage();
      }
    };
    // Sign-out clears the stored session from outside this provider. What
    // is in memory is now unsaved: store it again on the next change
    // instead of mistaking the gap for another tab's doing.
    const handleClearedHere = () => {
      lastSeenTokenRef.current = null;
      lastSyncedRef.current = null;
      holdsStoredSessionRef.current = false;
    };

    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('pageshow', handleWake);
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(SESSION_STORAGE_CLEARED_EVENT, handleClearedHere);
    return () => {
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('pageshow', handleWake);
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(
        SESSION_STORAGE_CLEARED_EVENT,
        handleClearedHere
      );
    };
  }, [tick, syncFromStorage]);

  /**
   * While a saved match is open for editing, `sessionData` holds that match's
   * values and the real in-progress match waits in `currentMatchData`. What
   * gets stored is always the in-progress match, so a reload can never turn
   * the match being edited into the current one.
   */
  const liveSessionData = useMemo<SessionFormData>(
    () =>
      editingMatchId && currentMatchData
        ? { ...sessionData, ...currentMatchData }
        : sessionData,
    [sessionData, editingMatchId, currentMatchData]
  );

  // On every commit, so that what another tab stores meanwhile is weighed
  // against the session as it stands, not as it last rendered an effect.
  useLayoutEffect(() => {
    unsavedRef.current = {
      data: liveSessionData,
      flags: { hasStarted, matchActive },
    };
    openEditRef.current = editingMatchId
      ? { matchId: editingMatchId, fields: pickScoringFields(sessionData) }
      : null;
  });

  // The match open for editing is kept with this tab (see matchEditDraft),
  // as it is edited, and let go of when the editor closes.
  useEffect(() => {
    if (editingMatchId) saveMatchEditDraft(editingMatchId, sessionData);
    else clearMatchEditDraft();
  }, [editingMatchId, sessionData]);

  const persistNow = useCallback(
    (data: SessionFormData, flags: SessionFlags) => {
      // Never store anchors that are out of step with the wall clock
      readWallClock();
      const clock = clockRef.current;
      const signature = signatureOf(data, clock, flags);
      if (signature === lastSyncedRef.current) return;

      // Another tab has written since this one last looked: take its
      // version rather than overwrite it with a stale copy, unless all it
      // did was put its clocks right under a change this tab has yet to store.
      if (readSessionToken() !== lastSeenTokenRef.current) {
        const synced = syncFromStorage();
        if (synced !== 'kept' && synced !== 'own') return;
      }

      // Only a session worth restoring is kept: one that was started, has
      // saved matches, or is a draft with notes or changed settings. A
      // brand-new session is not stored (nor is one taken back to that).
      if (!isWorthStoring(data, flags.hasStarted)) {
        if (lastSeenTokenRef.current !== null) {
          lastSeenTokenRef.current = null;
          removeStoredSession();
        }
        holdsStoredSessionRef.current = false;
        lastSyncedRef.current = signature;
        lastSyncedStateRef.current = stateSignatureOf(data, clock, flags);
        return;
      }

      const now = Date.now();
      const token = saveSessionToStorage(data, {
        sessionTimer: sessionSeconds(clock, now),
        matchTimer: matchSecondsLeft(clock, now),
        isTimerRunning: clock.running,
        hasStarted: flags.hasStarted,
        sessionStartTime: sessionStartTimeRef.current,
        matchStartTime: matchStartTimeRef.current,
        matchPhase: clock.phase,
        matchActive: flags.matchActive,
        phaseTimer: pickupSecondsLeft(clock, now),
        isPickupPaused: clock.pickupPaused,
        clock,
      });
      if (token === null) return;
      lastSeenTokenRef.current = token;
      holdsStoredSessionRef.current = true;
      lastSyncedRef.current = signature;
      lastSyncedStateRef.current = stateSignatureOf(data, clock, flags);
    },
    [readWallClock, syncFromStorage]
  );

  // Store the session after this tab changes it. Running clocks are stored
  // as deadlines, so a tick is not a change and never writes; nothing is
  // written once the session is completed, or while the tutorial is using
  // the session state for practice.
  useEffect(() => {
    if (sessionData.isSessionCompleted || isTutorialActive) {
      return;
    }

    const flags: SessionFlags = { hasStarted, matchActive };
    const write = () => {
      clearTimeout(timeout);
      if (pendingPersistRef.current !== write) return;
      pendingPersistRef.current = null;
      persistNow(liveSessionData, flags);
    };
    const timeout = setTimeout(write, PERSIST_DELAY_MS);
    pendingPersistRef.current = write;

    return () => {
      clearTimeout(timeout);
      if (pendingPersistRef.current === write) {
        pendingPersistRef.current = null;
      }
    };
  }, [
    liveSessionData,
    sessionData.isSessionCompleted,
    isTutorialActive,
    hasStarted,
    matchActive,
    clockNonce,
    persistNow,
  ]);

  const updateSessionData = useCallback((updates: Partial<SessionFormData>) => {
    setSessionData(prev => {
      const next = { ...prev, ...updates };
      // A name the app gave follows the session type; one the user typed
      // is left alone.
      if (
        updates.sessionType &&
        updates.sessionType !== prev.sessionType &&
        updates.sessionName === undefined &&
        !prev.sessionNameTyped
      ) {
        const renamed = retypeDefaultSessionName(
          prev.sessionName,
          updates.sessionType
        );
        if (renamed) next.sessionName = renamed;
      }
      return next;
    });
  }, []);

  const replaceSessionData = useCallback((data: SessionFormData) => {
    setSessionData(data);
  }, []);

  const completeSession = useCallback(
    (timerValue: string) => {
      setSessionData(prev => ({
        ...prev,
        sessionDuration: timerValue,
        isSessionCompleted: true,
      }));
      // Stop every clock now, including a controller pickup that would
      // otherwise roll on into TELEOP. The match clock goes back to its
      // between-matches reading, as no match is in progress any more.
      envRef.current = { ...envRef.current, completed: true };
      commitClock(
        clock => ({ ...clock, ...idleMatchClock(envRef.current.matchType) }),
        true
      );
      setMatchActive(false);
      lastSeenTokenRef.current = null;
      removeStoredSession();
      setSessionEpoch(epoch => epoch + 1);
    },
    [commitClock]
  );

  const resetTimer = useCallback(() => {
    commitClock(
      clock => ({
        ...clock,
        ...idleMatchClock(sessionData.matchType),
        running: clock.running,
      }),
      true
    );
  }, [sessionData.matchType, commitClock]);

  const startEditingMatch = useCallback(
    (match: Match) => {
      // The tutorial puts the session data back when it closes, but not
      // this: an edit opened under it would be left over the wrong fields.
      if (isTutorialActive) return;
      // Going from one saved match straight to another: the fields hold the
      // one being left, and the in-progress match is already waiting.
      if (!editingMatchId) setCurrentMatchData(pickScoringFields(sessionData));
      setSessionData(prev => ({ ...prev, ...pickScoringFields(match) }));
      setEditingMatchId(match.id);
    },
    [sessionData, isTutorialActive, editingMatchId]
  );

  const returnToCurrentMatch = useCallback(() => {
    if (currentMatchData) {
      setSessionData(prev => ({ ...prev, ...currentMatchData }));
    }
    setEditingMatchId(null);
    setCurrentMatchData(null);
  }, [currentMatchData]);

  const saveEditedMatch = useCallback(() => {
    if (!editingMatchId) return;

    setSessionData(prev => {
      const edited = pickScoringFields(prev);
      const updatedMatches = prev.matches.map(match => {
        if (match.id !== editingMatchId) return match;
        // Scored as the kind of match it was, not the type selected now
        const scored = { ...edited, matchType: match.matchType };
        return { ...match, ...edited, finalScore: calculateTotal(scored) };
      });

      return {
        ...prev,
        matches: updatedMatches,
        ...(currentMatchData ?? emptyScoringFields()),
      };
    });

    setEditingMatchId(null);
    setCurrentMatchData(null);
  }, [editingMatchId, currentMatchData]);

  const resetSession = useCallback(
    ({ discardDraft = false }: { discardDraft?: boolean } = {}) => {
      // A draft is what the user has typed into the session they are about
      // to start, so going to a new session ("Start your first session" on
      // Sessions) carries it on rather than wiping it. Only an explicit
      // discard (Discard Session, which has its Undo) throws it away.
      const { data, flags } = unsavedRef.current;
      if (
        !discardDraft &&
        !data.isSessionCompleted &&
        !flags.hasStarted &&
        !flags.matchActive &&
        (data.matches?.length ?? 0) === 0 &&
        hasDraftContent(data)
      ) {
        // Still pick up a session another tab has started since.
        if (readSessionToken() !== lastSeenTokenRef.current) syncFromStorage();
        return;
      }
      resetState();
      const token = readSessionToken();
      if (token !== null && token !== lastSeenTokenRef.current) {
        // Another tab has a session going that this one never loaded (this
        // tab was showing a completed one). Join it instead of wiping it.
        syncFromStorage();
        return;
      }
      lastSeenTokenRef.current = null;
      removeStoredSession();
    },
    [resetState, syncFromStorage]
  );

  const skipToTeleop = useCallback(() => {
    const clock = clockRef.current;
    if (
      envRef.current.matchType !== 'Full Game' ||
      (clock.phase !== 'auton' && clock.phase !== 'controller_pickup')
    ) {
      return;
    }
    // A paused match stays paused, as with Skip to 1:00: TELEOP starts
    // on Resume, and so does its audio.
    const wasRunning =
      clock.phase === 'controller_pickup' ? !clock.pickupPaused : clock.running;
    cueMatchAudio(TELEOP_AUDIO_OFFSET, wasRunning);

    commitClock(
      current => ({
        ...current,
        phase: 'teleop',
        running: wasRunning,
        remainingMs: GAME_TIMING.TELEOP_DURATION_SECONDS * 1000,
        deadline: null,
        pickupRemainingMs: 0,
        pickupDeadline: null,
        pickupPaused: false,
      }),
      true
    );
  }, [commitClock]);

  const skipToFlowers = useCallback(() => {
    const clock = clockRef.current;
    const flowersMs = GAME_TIMING.FLOWERS_UNLOCK_REMAINING * 1000;
    // Only ever forward: once FLOWERS are unlocked, the skip is to the end.
    if (
      clock.phase !== 'teleop' ||
      matchSecondsLeft(clock, Date.now()) <=
        GAME_TIMING.FLOWERS_UNLOCK_REMAINING
    ) {
      return;
    }
    // The wind chimes start the track's 1:00, so they sound as the clock
    // lands there (or on Resume, if paused).
    cueMatchAudio(
      matchAudioTime(
        envRef.current.matchType,
        'teleop',
        GAME_TIMING.FLOWERS_UNLOCK_REMAINING
      ),
      false
    );
    commitClock(
      current => ({ ...current, remainingMs: flowersMs, deadline: null }),
      true
    );
  }, [commitClock]);

  const skipToEnd = useCallback(() => {
    if (clockRef.current.phase === 'ended') return;
    const { matchType } = envRef.current;
    // The buzzer ends the match's last period. Earlier in a Full Game (the
    // 3-2-1, AUTO, controller pickup) the match goes straight there.
    const lastPeriod: MatchPhase =
      matchType === 'Autonomous' ? 'auton' : 'teleop';
    // The buzzer, from the track, as at a natural end; the match audio
    // stops after its tail as usual.
    cueMatchAudio(matchAudioTime(matchType, lastPeriod, 0), true);
    // Run the last period's clock out now, then let the tick end the match:
    // the same phase change (and the same stored clock for other tabs) as a
    // match whose time ran out.
    commitClock(
      current => ({
        ...current,
        phase: lastPeriod,
        running: true,
        remainingMs: 0,
        deadline: null,
        pickupRemainingMs: 0,
        pickupDeadline: null,
        pickupPaused: false,
      }),
      true
    );
    tick();
  }, [commitClock, tick]);

  const holdMatchClock = useCallback((): HeldMatchClock => {
    // Brought up to now first: a phase change may have fallen due since the
    // last tick.
    tick();
    return {
      clock: clockRef.current,
      match: matchStartTimeRef.current,
      ...lastReadRef.current,
    };
  }, [tick]);

  const resumeMatchClock = useCallback(
    (held: HeldMatchClock): SessionClockState => {
      // Started when it was: a discarded match that is put back is still
      // the match it was (see `isCurrentMatch`).
      if (held.match) matchStartTimeRef.current = held.match;
      // What was counting is due when it would have been had it never
      // stopped; the tick then replays every phase change that fell due
      // meanwhile, as for a page that was asleep. Its anchors move as those
      // of a clock that kept counting would (see `readWallClock`): back with
      // a device clock that was set back, and not at all when the device
      // clock got ahead of the page's own, which stops while the device
      // sleeps. The session clock is left as it is.
      commitClock((clock, now) => {
        const shift = Math.min(
          0,
          now - held.wall - (performance.now() - held.steady)
        );
        const { deadline, pickupDeadline } = held.clock;
        return {
          ...held.clock,
          deadline: deadline === null ? null : deadline + shift,
          pickupDeadline:
            pickupDeadline === null ? null : pickupDeadline + shift,
          sessionAccumulatedMs: clock.sessionAccumulatedMs,
          sessionResumedAt: clock.sessionResumedAt,
        };
      }, true);
      tick();
      return clockRef.current;
    },
    [commitClock, tick]
  );

  // A tab frozen in the background misses another tab discarding the match
  // and starting the next one under the same number: only its start time
  // tells the two apart.
  const isCurrentMatch = useCallback(
    (held: HeldMatchClock) => held.match === matchStartTimeRef.current,
    []
  );

  const hasActiveSession =
    !sessionData.isSessionCompleted &&
    (hasStarted || sessionData.matches.length > 0);

  const isMatchCountdown = timer > PLAYING_SECONDS;

  // Rebuilt only when something other than a clock reading changes, so the
  // components that read it are left alone by the once-a-second tick.
  const core = useMemo<SessionCoreContextType>(
    () => ({
      sessionData,
      updateSessionData,
      replaceSessionData,
      completeSession,
      resetSession,
      sessionEpoch,
      getTimers,
      getMatchClock,
      setTimer,
      setSessionTimer,
      isTimerRunning,
      setIsTimerRunning,
      resetTimer,
      formatTime: formatTimeUtil,
      matchPhase,
      setMatchPhase,
      setPhaseTimer,
      isPickupPaused,
      setIsPickupPaused,
      isMatchCountdown,
      hasActiveSession,
      hasStarted,
      setHasStarted,
      editingMatchId,
      startEditingMatch,
      returnToCurrentMatch,
      saveEditedMatch,
      matchActive,
      setMatchActive,
      skipToTeleop,
      skipToFlowers,
      skipToEnd,
      holdMatchClock,
      resumeMatchClock,
      isCurrentMatch,
      getDisplayTimer: getDisplayTimerUtil,
      isTutorialActive,
      setIsTutorialActive,
    }),
    [
      sessionData,
      updateSessionData,
      replaceSessionData,
      completeSession,
      resetSession,
      sessionEpoch,
      getTimers,
      getMatchClock,
      setTimer,
      setSessionTimer,
      isTimerRunning,
      setIsTimerRunning,
      resetTimer,
      matchPhase,
      setMatchPhase,
      setPhaseTimer,
      isPickupPaused,
      setIsPickupPaused,
      isMatchCountdown,
      hasActiveSession,
      hasStarted,
      editingMatchId,
      startEditingMatch,
      returnToCurrentMatch,
      saveEditedMatch,
      matchActive,
      skipToTeleop,
      skipToFlowers,
      skipToEnd,
      holdMatchClock,
      resumeMatchClock,
      isCurrentMatch,
      isTutorialActive,
      setIsTutorialActive,
    ]
  );

  const timers = useMemo<SessionTimers>(
    () => ({ timer, sessionTimer, phaseTimer }),
    [timer, sessionTimer, phaseTimer]
  );

  return (
    <SessionCoreContext.Provider value={core}>
      <SessionTimerContext.Provider value={timers}>
        {children}
      </SessionTimerContext.Provider>
    </SessionCoreContext.Provider>
  );
};

/**
 * The session without its clocks. Use this wherever no clock is shown: the
 * value only changes when the session itself does, never on a tick.
 */
export const useSessionCore = (): SessionCoreContextType => {
  const context = useContext(SessionCoreContext);
  if (!context) {
    throw new Error('useSessionCore must be used within a SessionProvider');
  }
  return context;
};

/**
 * The session and its clocks. A component that calls this re-renders every
 * second while a clock is counting; one that shows no clock should use
 * `useSessionCore` instead.
 */
export const useSession = (): SessionContextType => {
  const core = useContext(SessionCoreContext);
  const timers = useContext(SessionTimerContext);
  if (!core || !timers) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return useMemo(() => ({ ...core, ...timers }), [core, timers]);
};
