import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useSessionCore, useTheme, useAuth, useTeam } from '@/contexts';
import type { HeldMatchClock } from '@/contexts/SessionContext';
import { useEscapeKey } from '@/hooks';
import { CURRENT_SEASON, ROUTES, STORAGE_KEYS, UI_TIMING } from '@/constants';
import {
  calculateScore,
  emptyScoringFields,
  FIELD_LIMITS,
  generateId,
  htmlToText,
  liveMatchType,
  logger,
  markSessionCompleted,
  normalizeForMatchType,
  pickScoringFields,
  readGuestSessions,
  sessionMatchType,
  writeGuestSessions,
} from '@/lib';
import { followMatchClock } from '@/lib/followMatchClock';
import { nextMatchNumber } from '@/lib/matchNumber';
import { formatPoints } from '@/lib/points';
import { firebaseService, teamService } from '@/services';
import type {
  Match,
  MatchScoringFields,
  Session,
  SessionFormData,
  Team,
} from '@/types';
import { absorbDoubleTap, watchTaps } from './doubleTap';
import { revealFirstStepperRow } from './revealStepperRow';
import { useCompactControls } from './useCompactControls';

export interface LiveControlsProps {
  onOpenSessionSetup?: () => void;
  onTryStartWithoutSetup?: () => void;
  isSessionSetupSaved?: boolean;
  onSessionReset?: () => void;
}

const UNREACHABLE_MESSAGE =
  "Can't reach the server - your matches are kept on this device, try again";
const RUNNING_MATCH_MESSAGE = 'Save or discard the running match first';
const SAVING_TOAST_ID = 'saving-session';
const TUTORIAL_TOAST_ID = 'walkthrough-open';
const CLEARED_TOAST_ID = 'cleared-before-start';
const DISCARDED_TOAST_ID = 'session-discarded';
/** One toast per reason Complete Session can't go ahead, however often it is pressed */
const COMPLETE_BLOCKED_TOAST_ID = 'complete-session-blocked';
const SAVE_BLOCKED_TOAST_ID = 'save-match-blocked';
const MATCH_SAVED_TOAST_ID = 'match-saved';
/**
 * Toasts about the gap between two matches, gone once the next one starts:
 * on a phone they sit over the header's clock, which counts that match in.
 */
const BETWEEN_MATCHES_TOAST_IDS = [
  MATCH_SAVED_TOAST_ID,
  SAVE_BLOCKED_TOAST_ID,
  COMPLETE_BLOCKED_TOAST_ID,
];
/** An Undo that waits for the match open for editing to be closed */
const EDIT_OPEN_TOAST_ID = 'match-edit-open';
/** An Undo that waits for the Save Session dialog to be closed */
const SAVE_DIALOG_OPEN_TOAST_ID = 'save-dialog-open';
/** Why "Match N ended early - Undo" can't put the match back (yet) */
const END_EARLY_UNDO_REFUSED_TOAST_ID = 'end-early-undo-refused';
/** The Match Entry section that holds Flowers, Left in Hive and Garden */
const END_OF_MATCH_SECTION = '[data-tutorial="end-of-match"]';

/**
 * The questions /active can ask before it acts. Only one is ever open:
 * asking another closes the one before it.
 *
 * - `endEarly`: end the running match before the buzzer
 * - `saveZeroEom`: save a finished match with nothing counted at the end
 * - `discardMatch`: throw the running match away
 * - `discardSession`: throw the whole session away
 * - `completeWithStray`: finish the session with numbers in Match Entry
 *   that belong to no saved match
 */
export type PendingConfirm =
  | 'endEarly'
  | 'saveZeroEom'
  | 'discardMatch'
  | 'discardSession'
  | 'completeWithStray';

/**
 * Whether a question takes the place of the Start / Save button. Questions
 * about the match always do. The two about the session are asked where
 * their own button is: Discard Session's with the session buttons, and
 * Complete Session's wherever that button is on this screen (in the bar on
 * a phone).
 */
export const isPrimarySlotConfirm = (
  pending: PendingConfirm | null,
  isCompact: boolean
): boolean =>
  pending === 'endEarly' ||
  pending === 'saveZeroEom' ||
  pending === 'discardMatch' ||
  (pending === 'completeWithStray' && isCompact);

/** How long the whole signed-in save (checks + write) may take before giving up */
const SAVE_TIMEOUT_MS = 12000;
/** Taps on the Start/Save button closer together than this are one tap */
const PRIMARY_ACTION_DEBOUNCE_MS = 500;

/** Limits enforced by firestore.rules (name, notes, matches) and by Firestore itself (1 MiB) */
const MAX_SESSION_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 50000;
const MAX_MATCHES_PER_SESSION = 200;
const MAX_SESSION_BYTES = 950 * 1024;

/** Browsers give localStorage about 5 MB; warn guests before it runs out */
const GUEST_STORAGE_QUOTA = 5 * 1024 * 1024;
const GUEST_STORAGE_WARN_RATIO = 0.8;
let guestStorageWarned = false;

/**
 * ID the completed session was saved under. Kept outside the hook so
 * "View Full Analysis Report" still opens it after leaving /active and
 * coming back; cleared when a new session starts.
 */
let lastSavedSessionId: string | null = null;

/**
 * A save that outlived its timeout. Firestore still delivers the write once
 * the network returns, so it is tracked until it settles: a retry of the
 * same session rejoins it instead of writing a second copy.
 */
interface PendingSave {
  /** Identifies the write: the session content plus the team it is filed under */
  key: string;
  /** The session content alone, to tell whether it was edited afterwards */
  content: string;
  promise: Promise<Session | null>;
  /** Complete attempts currently awaiting this write */
  waiting: number;
  watched: boolean;
  epoch: unknown;
  duration: string;
}
let pendingSave: PendingSave | null = null;

class SaveTimeoutError extends Error {}

/** "178 pts", "1 pt": the shared one, for the controls that import it from here */
export { formatPoints };

/**
 * Reject with SaveTimeoutError if `promise` hasn't settled by `deadline`, a
 * performance.now() reading: a change to the device clock mid-save neither
 * cuts the wait short nor stretches it.
 */
const withDeadline = <T>(promise: Promise<T>, deadline: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new SaveTimeoutError()),
        Math.max(0, deadline - performance.now())
      );
    }),
  ]).finally(() => clearTimeout(timeout));
};

/** Firestore error code ('permission-denied', 'unavailable', …), or '' */
const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code).replace(/^firestore\//, '')
    : '';

/** localStorage refused a write because the browser's quota is used up */
const isQuotaError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22
  );
};

/** Why Firestore would refuse this session, or null if it fits */
export const sessionSaveProblem = (session: {
  sessionName?: string;
  notes?: string;
  matches?: Match[];
}): string | null => {
  if ((session.sessionName?.length ?? 0) > MAX_SESSION_NAME_LENGTH) {
    return `Session names can be up to ${MAX_SESSION_NAME_LENGTH} characters. Shorten the name, then save again.`;
  }
  const matchCount = session.matches?.length ?? 0;
  if (matchCount > MAX_MATCHES_PER_SESSION) {
    return `A session can hold up to ${MAX_MATCHES_PER_SESSION} matches and this one has ${matchCount}. Delete some matches before completing it.`;
  }
  if ((session.notes?.length ?? 0) >= MAX_NOTES_LENGTH) {
    return 'Your notes are too long to save (formatting counts toward the 50,000 character limit). Shorten them, then complete the session again.';
  }
  const bytes = new Blob([JSON.stringify(session)]).size;
  if (bytes > MAX_SESSION_BYTES) {
    return `This session is too large to save (${Math.round(bytes / 1024)} KB of about ${Math.round(MAX_SESSION_BYTES / 1024)} KB). Delete some matches or shorten the notes.`;
  }
  return null;
};

/** What to tell the user when the save itself was refused */
export const saveErrorMessage = (error: unknown): string => {
  if (error instanceof SaveTimeoutError) return UNREACHABLE_MESSAGE;
  switch (errorCode(error)) {
    case 'unavailable':
    case 'deadline-exceeded':
      return UNREACHABLE_MESSAGE;
    case 'permission-denied':
    case 'unauthenticated':
      return "You don't have permission to save this session. Sign out and back in, then try again - your matches are kept on this device.";
    case 'invalid-argument':
      return "The server rejected this session as too large or malformed. Delete some matches or shorten the notes, then try again - retrying as-is won't work.";
    case 'resource-exhausted':
      return 'The server is over its usage limit right now. Your matches are kept on this device - try again later.';
    default:
      return 'Failed to save session. Your data is preserved — please try again.';
  }
};

/**
 * `extra` scored on top of `current`: each count adds up (to its field's
 * limit), and a robot's LEAVE or PARK holds if either has it.
 */
const addScoring = (current: SessionFormData, extra: MatchScoringFields) => {
  const count = (field: keyof typeof FIELD_LIMITS) =>
    Math.min(FIELD_LIMITS[field], (current[field] ?? 0) + (extra[field] ?? 0));
  return {
    tipping: count('tipping'),
    garden: count('garden'),
    flower: count('flower'),
    flowerBonus: count('flowerBonus'),
    ballsInHive: count('ballsInHive'),
    minorPenalties: count('minorPenalties'),
    majorPenalties: count('majorPenalties'),
    robot1Leave: current.robot1Leave || extra.robot1Leave,
    robot2Leave: current.robot2Leave || extra.robot2Leave,
    robot1ParkAuto: current.robot1ParkAuto || extra.robot1ParkAuto,
    robot2ParkAuto: current.robot2ParkAuto || extra.robot2ParkAuto,
    robot1ParkTeleop: current.robot1ParkTeleop || extra.robot1ParkTeleop,
    robot2ParkTeleop: current.robot2ParkTeleop || extra.robot2ParkTeleop,
  };
};

/**
 * A session this tab saved although another tab had discarded it while the
 * save was on its way: that tab's "Session discarded - Undo" must not put
 * it back in progress, where completing it again would store it twice.
 */
const noteSavedElsewhere = (matches: Match[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.SESSION_SAVED_ELSEWHERE,
      JSON.stringify(matches.map(match => match.id))
    );
  } catch {
    // Storage full or blocked: the other tab's Undo stays on offer.
  }
};

/** Whether another tab has saved the session these matches belong to */
const wasSavedElsewhere = (matchIds: string[]): boolean => {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.SESSION_SAVED_ELSEWHERE) ?? '[]'
    );
    return Array.isArray(saved) && matchIds.some(id => saved.includes(id));
  } catch {
    return false;
  }
};

/** In place of "Session discarded - Undo" once the session turns out to be stored */
const SAVED_ELSEWHERE_MESSAGE =
  "Another tab saved this session, so it can't be put back here. Find it in Sessions.";

const localStorageUsage = (): number => {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) chars += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  return chars;
};

export const useLiveControlsState = ({
  onOpenSessionSetup,
  onTryStartWithoutSetup,
  isSessionSetupSaved = false,
  onSessionReset,
}: LiveControlsProps) => {
  const {
    sessionData,
    completeSession,
    getTimers,
    isTimerRunning,
    setIsTimerRunning,
    formatTime,
    resetSession,
    resetTimer,
    updateSessionData,
    hasStarted,
    setHasStarted,
    matchPhase,
    setMatchPhase,
    editingMatchId,
    saveEditedMatch,
    startEditingMatch,
    returnToCurrentMatch,
    matchActive,
    setMatchActive,
    skipToTeleop,
    skipToEndgame,
    skipToEnd,
    sessionEpoch,
    isTutorialActive,
    replaceSessionData,
    setSessionTimer,
    holdMatchClock,
    resumeMatchClock,
    isCurrentMatch,
  } = useSessionCore();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { team, refreshTeam } = useTeam();
  const navigate = useNavigate();
  const uid = user?.uid;
  /**
   * Where toasts go while the tutorial is open. On a full-size screen its
   * card docks in the bottom-right corner, under Sonner's toasts, which
   * covered the card's Skip and Next: the very buttons a "Close the
   * tutorial to undo" sends the user to. Those toasts go to the top-right
   * corner instead. On a phone toasts are at the top already.
   */
  const walkthroughToastPosition = useCompactControls()
    ? undefined
    : ('top-right' as const);

  const [pendingConfirmState, setPendingConfirm] =
    useState<PendingConfirm | null>(null);
  const [deleteConfirmId, setDeleteConfirmIdState] = useState<string | null>(
    null
  );
  const [newSessionConfirm, setNewSessionConfirm] = useState<boolean>(false);
  /** ID the completed session was saved under, so analysis can open (and share) it */
  const [savedSessionId, setSavedSessionIdState] = useState<string | null>(
    () => (sessionData.isSessionCompleted ? lastSavedSessionId : null)
  );
  const setSavedSessionId = (id: string | null) => {
    lastSavedSessionId = id;
    setSavedSessionIdState(id);
  };
  const [showSaveSessionDialog, setShowSaveSessionDialog] =
    useState<boolean>(false);
  /**
   * Another match was tapped while the one open for editing has changes.
   * The Match Log alone says so, under the row that was tapped; Save and
   * Discard close it.
   */
  const [showUnsavedEditWarning, setShowUnsavedEditWarning] =
    useState<boolean>(false);
  /** True from the moment a save is confirmed until it succeeds or fails */
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const completingRef = useRef(false);
  /**
   * When Start / Skip to Buzzer / End Match / Save Match / Save Changes /
   * the session save last went through, to absorb double taps. On the
   * page's own clock (performance.now()): the device clock can be set back,
   * which would leave these buttons dead until it caught up.
   */
  const lastPrimaryActionAt = useRef(-Infinity);
  /** Latest session data, for undo callbacks that fire after later edits */
  const sessionDataRef = useRef(sessionData);
  const matchActiveRef = useRef(matchActive);
  const hasStartedRef = useRef(hasStarted);
  const editingMatchIdRef = useRef(editingMatchId);
  const tutorialActiveRef = useRef(isTutorialActive);
  const saveSessionDialogRef = useRef(showSaveSessionDialog);
  const matchPhaseRef = useRef(matchPhase);
  useEffect(() => {
    sessionDataRef.current = sessionData;
    matchActiveRef.current = matchActive;
    matchPhaseRef.current = matchPhase;
    hasStartedRef.current = hasStarted;
    editingMatchIdRef.current = editingMatchId;
    tutorialActiveRef.current = isTutorialActive;
    saveSessionDialogRef.current = showSaveSessionDialog;
  }, [
    sessionData,
    matchActive,
    matchPhase,
    hasStarted,
    editingMatchId,
    isTutorialActive,
    showSaveSessionDialog,
  ]);
  /**
   * "Match N deleted - Undo" toasts that may still restore their match, by
   * toast id, with their text (to show one again somewhere else).
   */
  const undoToastIdsRef = useRef(new Map<string, string>());
  /**
   * The session epoch a "Session discarded - Undo" toast may still restore
   * into: the fresh session that replaced the discarded one, for as long as
   * nothing has been done with it.
   */
  const discardUndoEpochRef = useRef<number | null>(null);
  /** The saved matches of the session that toast would put back */
  const discardedMatchIdsRef = useRef<string[]>([]);
  /** The "Match N discarded - Undo" toast still on offer, if any */
  const matchDiscardToastRef = useRef<string | null>(null);
  /**
   * The "Match N ended early - Undo" toast still on offer, if any, with what
   * it puts back (to offer it again when a discard of the match is undone)
   */
  const endedEarlyToastRef = useRef<{
    id: string;
    held: HeldMatchClock;
    scrolledTo: number;
  } | null>(null);
  /** Counts the matches started here, to tell one from the next */
  const matchRunRef = useRef(0);
  /** Which of them was saved last */
  const savedRunRef = useRef(-1);
  /**
   * Where the page was when End early asked: before a question in two rows
   * on a phone lifted it, and before the buzzer brought End of Match into
   * view.
   */
  const endEarlyScrollRef = useRef(0);
  const mountedRef = useRef(true);

  const dismissUndoToasts = () => {
    undoToastIdsRef.current.forEach((_, id) => toast.dismiss(id));
    undoToastIdsRef.current.clear();
  };

  useEffect(() => {
    const undoToastIds = undoToastIdsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Their buttons act on this page's state, which is gone once it unmounts.
      undoToastIds.forEach((_, id) => toast.dismiss(id));
      undoToastIds.clear();
      toast.dismiss(CLEARED_TOAST_ID);
      toast.dismiss(DISCARDED_TOAST_ID);
    };
  }, []);

  /**
   * The team this session was being recorded for. Kept after the team goes
   * away (removed, or left on another device) so the save can say where the
   * session ended up instead.
   */
  const sessionTeamRef = useRef<Team | null>(team);
  useEffect(() => {
    if (team) sessionTeamRef.current = team;
  }, [team]);

  // A deleted match belongs to the session it was deleted from: once that
  // session is reset or replaced, its Undo must not reach the new one.
  const sessionEpochRef = useRef(sessionEpoch);
  useEffect(() => {
    if (sessionEpochRef.current === sessionEpoch) return;
    sessionEpochRef.current = sessionEpoch;
    sessionTeamRef.current = team;
    undoToastIdsRef.current.forEach((_, id) => toast.dismiss(id));
    undoToastIdsRef.current.clear();
    toast.dismiss(CLEARED_TOAST_ID);
    // The save dialog and any open question were about the session that is
    // gone (completed or discarded, here or in another tab). Left open, the
    // dialog would save the empty session that replaced it.
    setShowSaveSessionDialog(false);
    setPendingConfirm(null);
    setDeleteConfirmIdState(null);
  }, [sessionEpoch, team]);

  // "Session discarded - Undo" only puts the session back over an untouched
  // fresh one: once that has been started, or replaced in turn, the offer
  // goes.
  useEffect(() => {
    const undoEpoch = discardUndoEpochRef.current;
    if (undoEpoch === null) return;
    if (
      sessionEpoch !== undoEpoch ||
      hasStarted ||
      (sessionData.matches?.length ?? 0) > 0
    ) {
      discardUndoEpochRef.current = null;
      toast.dismiss(DISCARDED_TOAST_ID);
    }
  }, [sessionEpoch, hasStarted, sessionData.matches]);

  // Nor once another tab, whose save was on its way when the session was
  // discarded here, has stored it after all: the toast says so instead.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== STORAGE_KEYS.SESSION_SAVED_ELSEWHERE ||
        discardUndoEpochRef.current === null ||
        !wasSavedElsewhere(discardedMatchIdsRef.current)
      ) {
        return;
      }
      discardUndoEpochRef.current = null;
      toast.message(SAVED_ELSEWHERE_MESSAGE, {
        id: DISCARDED_TOAST_ID,
        action: undefined,
      });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // An Undo can't be used until the walkthrough is closed, so toasts still
  // offering one when it opens move clear of its card, and go back to where
  // toasts normally are when it closes, over the header's own buttons no
  // longer (shown again with the same id, they keep their Undo and get
  // their full time back). Once it has closed, "Close the tutorial to ..."
  // is done with, and would sit in front of the Undo it sent the user
  // to.
  const undoToastsMovedRef = useRef(false);
  useEffect(() => {
    const moveUndoToasts = (position: typeof walkthroughToastPosition) => {
      // `message` keeps each toast's own kind (and icon).
      undoToastIdsRef.current.forEach((title, id) =>
        toast.message(title, { id, position })
      );
      if (discardUndoEpochRef.current !== null) {
        toast.message('Session discarded', {
          id: DISCARDED_TOAST_ID,
          position,
        });
      }
    };
    if (!isTutorialActive) toast.dismiss(TUTORIAL_TOAST_ID);
    const position = isTutorialActive ? walkthroughToastPosition : undefined;
    if (position) {
      undoToastsMovedRef.current = true;
      moveUndoToasts(position);
    } else if (undoToastsMovedRef.current) {
      undoToastsMovedRef.current = false;
      moveUndoToasts(undefined);
    }
  }, [isTutorialActive, walkthroughToastPosition]);

  /**
   * Points in the scoring fields: the current, not-yet-saved match, or the
   * saved match open for editing, scored as the type it was run as.
   */
  const currentMatchScore = calculateScore({
    ...sessionData,
    matchType: liveMatchType(sessionData, editingMatchId),
  });
  const hasUnsavedMatchData =
    currentMatchScore.earned > 0 || currentMatchScore.penalties > 0;

  const hasSavedMatches = (sessionData.matches?.length ?? 0) > 0;
  const notesHaveText = useMemo(
    () => htmlToText(sessionData.notes ?? '') !== '',
    [sessionData.notes]
  );
  /** Something a discard would throw away: matches, numbers, notes */
  const hasUnsavedWork =
    !sessionData.isSessionCompleted &&
    (hasSavedMatches || hasUnsavedMatchData || notesHaveText);
  /**
   * Worth a "leave this page?" from the browser. Not notes on their own:
   * a draft is kept in this browser and comes back with the page, and it is
   * not a session in progress.
   */
  const warnBeforeUnload =
    !sessionData.isSessionCompleted && (hasSavedMatches || hasUnsavedMatchData);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (warnBeforeUnload) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [warnBeforeUnload]);

  // Lets the presses below that change what is under the pointer shrug off
  // the second half of a double tap.
  useEffect(() => watchTaps(), []);

  /** True when this press is the tail of a double tap on the primary button. */
  const isRepeatedPrimaryAction = () =>
    performance.now() - lastPrimaryActionAt.current <
    PRIMARY_ACTION_DEBOUNCE_MS;

  /**
   * Note that a press has just moved the match or the session on: for a
   * moment, a press on the button that takes its place (Pause, Save Match,
   * Start Match, …) is the tail of a double tap and does nothing.
   */
  const markPrimaryAction = () => {
    lastPrimaryActionAt.current = performance.now();
  };

  const handleViewAnalysis = () => {
    // The tail of a double tap on Save Session lands here once the completed
    // screen replaces the dialog.
    if (isRepeatedPrimaryAction()) return;
    navigate(
      savedSessionId
        ? `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(savedSessionId)}`
        : ROUTES.ANALYSIS
    );
  };

  const savedMatchCount = sessionData.matches?.length ?? 0;
  /**
   * The number the match in the fields will be saved under. Matches keep
   * their numbers when one is deleted, so it is one past the highest.
   */
  const matchNumber = nextMatchNumber(sessionData.matches);
  /** The buzzer has gone and the match is waiting to be saved */
  const matchEnded = matchActive && matchPhase === 'ended';
  /** Nothing counted in Flower, Flower Bonus, Left in Hive or Garden */
  const endOfMatchEmpty =
    !sessionData.flower &&
    !sessionData.flowerBonus &&
    !sessionData.ballsInHive &&
    !sessionData.garden;

  /**
   * The open question, for as long as what it asks about is still there: the
   * buzzer answers "end early?", a count answers "all 0?", and a match that
   * is saved or discarded takes its questions with it.
   */
  const confirmStillApplies = (() => {
    const liveMatch = matchActive && !editingMatchId;
    switch (pendingConfirmState) {
      case 'endEarly':
        return liveMatch && !matchEnded;
      case 'saveZeroEom':
        return liveMatch && matchEnded && endOfMatchEmpty;
      case 'discardMatch':
        return liveMatch;
      case 'discardSession':
        return !sessionData.isSessionCompleted;
      case 'completeWithStray':
        return (
          !matchActive &&
          !editingMatchId &&
          hasUnsavedMatchData &&
          savedMatchCount > 0 &&
          !sessionData.isSessionCompleted
        );
      default:
        return false;
    }
  })();
  const pendingConfirm = confirmStillApplies ? pendingConfirmState : null;
  // A question that no longer applies is closed for good, not kept back for
  // the next time its conditions happen to hold.
  useEffect(() => {
    if (pendingConfirmState !== null && !confirmStillApplies) {
      setPendingConfirm(null);
    }
  }, [pendingConfirmState, confirmStillApplies]);

  /** Ask `question`, closing whichever other question was open. */
  const askConfirm = (question: PendingConfirm) => {
    // The answer buttons appear where the pressed button was.
    absorbDoubleTap();
    setDeleteConfirmIdState(null);
    setNewSessionConfirm(false);
    setPendingConfirm(question);
  };

  /** The safe answer to every question: change nothing. */
  const handleKeepConfirm = () => {
    // The button that asked comes back where this one was.
    absorbDoubleTap();
    setPendingConfirm(null);
  };

  /** Ask before deleting a logged match (null: stop asking). */
  const setDeleteConfirmId = (matchId: string | null) => {
    absorbDoubleTap();
    if (matchId !== null) setPendingConfirm(null);
    setDeleteConfirmIdState(matchId);
  };

  /**
   * The walkthrough borrows the session for practice and puts back what it
   * found when it closes. Editing a logged match, and saving or discarding
   * the session, reach past what it can put back (which match the fields
   * belong to, the saved sessions, the stored copy a reload comes back to),
   * so they wait until it has closed.
   */
  const isInWalkthrough = (action: string) => {
    if (!isTutorialActive) return false;
    toast.info(`Close the tutorial to ${action}`, {
      id: TUTORIAL_TOAST_ID,
      position: walkthroughToastPosition,
    });
    return true;
  };

  const startFreshSession = () => {
    // The fresh session's Start Match can land where the pressed button
    // was: a double tap must not start its first match.
    absorbDoubleTap();
    dismissUndoToasts();
    setSavedSessionId(null);
    // New Session (after a completed one) or Discard Session: both are asked
    // for, so a draft of notes goes too (Discard has its Undo).
    resetSession({ discardDraft: true });
    onSessionReset?.();
    setPendingConfirm(null);
    setNewSessionConfirm(false);
  };

  const handleNewSession = () => {
    if (isRepeatedPrimaryAction()) return;
    if (isInWalkthrough('start a new session')) return;
    if (
      sessionData.matches &&
      sessionData.matches.length > 0 &&
      !sessionData.isSessionCompleted
    ) {
      setNewSessionConfirm(true);
      return;
    }

    startFreshSession();
  };

  const handleConfirmNewSession = () => {
    if (isInWalkthrough('start a new session')) return;
    startFreshSession();
  };

  /**
   * Discard Session only asks. The match clock is left alone: a mis-tap
   * during a match must not put the app out of step with the field.
   */
  const handleRequestDiscardSession = () => {
    if (isInWalkthrough('discard the session')) return;
    askConfirm('discardSession');
  };

  /**
   * Confirmed: discard everything and go straight back to a fresh setup,
   * with an Undo that puts the session back for as long as the fresh one
   * has not been used.
   */
  const handleConfirmDiscardSession = () => {
    if (isInWalkthrough('discard the session') || isSavingSession()) return;

    const worthKeeping = Boolean(hasUnsavedWork) || hasStarted;
    // A match that was running comes back un-started, with its numbers in
    // the fields; one open for editing comes back as it was last saved.
    const snapshot = {
      sessionData: JSON.parse(
        JSON.stringify({
          ...sessionData,
          ...(editingMatchId ? emptyScoringFields() : {}),
        })
      ) as SessionFormData,
      sessionTimer: getTimers().sessionTimer,
      // Without a saved match the session goes back to "not started", as it
      // does when a first match is discarded.
      hasStarted: hasStarted && savedMatchCount > 0,
    };

    startFreshSession();

    if (!worthKeeping) {
      toast.message('Session discarded', { id: DISCARDED_TOAST_ID });
      return;
    }
    // resetSession moves on to the next epoch: the fresh session's.
    const undoEpoch = sessionEpoch + 1;
    discardUndoEpochRef.current = undoEpoch;
    const discardedMatchIds = (snapshot.sessionData.matches ?? []).map(
      match => match.id
    );
    discardedMatchIdsRef.current = discardedMatchIds;
    const offerGone = () => {
      if (discardUndoEpochRef.current === undoEpoch) {
        discardUndoEpochRef.current = null;
      }
    };
    toast.message('Session discarded', {
      id: DISCARDED_TOAST_ID,
      duration: UI_TIMING.UNDO_WINDOW,
      onAutoClose: offerGone,
      onDismiss: offerGone,
      action: {
        label: 'Undo',
        onClick: event => {
          // The walkthrough would put its own snapshot back over this one
          // when it closes; the toast stays for when it has.
          if (tutorialActiveRef.current) {
            event.preventDefault();
            toast.info('Close the tutorial to undo', {
              id: TUTORIAL_TOAST_ID,
              position: walkthroughToastPosition,
            });
            return;
          }
          const fresh = sessionDataRef.current;
          if (
            discardUndoEpochRef.current !== sessionEpochRef.current ||
            hasStartedRef.current ||
            matchActiveRef.current ||
            (fresh.matches?.length ?? 0) > 0 ||
            fresh.isSessionCompleted
          ) {
            return;
          }
          discardUndoEpochRef.current = null;
          if (wasSavedElsewhere(discardedMatchIds)) {
            event.preventDefault();
            toast.message(SAVED_ELSEWHERE_MESSAGE, {
              id: DISCARDED_TOAST_ID,
              action: undefined,
            });
            return;
          }
          replaceSessionData(snapshot.sessionData);
          setSessionTimer(snapshot.sessionTimer);
          setHasStarted(snapshot.hasStarted);
        },
      },
    });
  };

  /**
   * While the session is being saved its matches must not change under the
   * save: what is stored and what the page shows would no longer agree. The
   * save dialog stays up over the page until the save settles; this covers
   * what can still be reached then (a toast's button, a key press).
   */
  const isSavingSession = () => {
    if (!completingRef.current) return false;
    toast.message('Saving the session…', { id: SAVING_TOAST_ID });
    return true;
  };

  /**
   * Say what Start Match cleared, with an Undo that puts it back into the
   * match that was started, on top of whatever has been scored since. Start
   * itself stays one tap.
   */
  const offerClearedUndo = (stray: MatchScoringFields, points: number) => {
    const epochAtStart = sessionEpoch;
    const matchesAtStart = savedMatchCount;
    toast.message(
      points > 0
        ? `Cleared ${formatPoints(points)} entered before the match started`
        : 'Cleared the penalties entered before the match started',
      {
        id: CLEARED_TOAST_ID,
        duration: UI_TIMING.UNDO_WINDOW,
        action: {
          label: 'Undo',
          onClick: () => {
            const current = sessionDataRef.current;
            // Only into the match they were cleared for.
            if (
              !matchActiveRef.current ||
              editingMatchIdRef.current ||
              sessionEpochRef.current !== epochAtStart ||
              (current.matches?.length ?? 0) !== matchesAtStart
            ) {
              return;
            }
            updateSessionData(addScoring(current, stray));
          },
        },
      }
    );
  };

  /** Split out of the Start/Save button so both layouts share one code path */
  const handleStartMatch = () => {
    if (matchActive || isRepeatedPrimaryAction() || isSavingSession()) return;
    if (!isSessionSetupSaved && !sessionData.sessionName?.trim()) {
      onTryStartWithoutSetup?.();
      return;
    }
    markPrimaryAction();
    matchRunRef.current++;
    // Pause takes this button's place: a double tap must not pause the
    // match it has just started.
    absorbDoubleTap();
    setPendingConfirm(null);
    BETWEEN_MATCHES_TOAST_IDS.forEach(id => toast.dismiss(id));

    // A match starts from nothing. Numbers entered between matches belong to
    // no match: left in, they would be saved as part of this one.
    const stray = pickScoringFields(sessionData);
    if (JSON.stringify(stray) !== JSON.stringify(emptyScoringFields())) {
      updateSessionData(emptyScoringFields());
    }
    if (hasUnsavedMatchData) {
      offerClearedUndo(stray, currentMatchScore.earned);
    }

    setHasStarted(true);
    setMatchActive(true);
    if (sessionData.matchType === 'Teleop') {
      setMatchPhase('teleop');
    } else {
      setMatchPhase('auton');
    }
    setIsTimerRunning(true);
    window.dispatchEvent(new Event('teamtrack-match-started'));
  };

  // The "Cleared … - Undo" toast is for the match that was just started,
  // and goes when that match does. So does "Match N ended early - Undo":
  // once the match is saved or discarded (here or in another tab) there is
  // no running match to put back; a discard that is undone offers it again.
  // "Match N discarded - Undo" goes when a match takes the discarded one's
  // place (or it is put back).
  useEffect(() => {
    const undoToastIds = undoToastIdsRef.current;
    if (!matchActive) {
      toast.dismiss(CLEARED_TOAST_ID);
      const endedEarly = endedEarlyToastRef.current;
      endedEarlyToastRef.current = null;
      if (endedEarly) {
        undoToastIds.delete(endedEarly.id);
        toast.dismiss(endedEarly.id);
      }
      return;
    }
    const discarded = matchDiscardToastRef.current;
    matchDiscardToastRef.current = null;
    if (discarded) {
      undoToastIds.delete(discarded);
      toast.dismiss(discarded);
    }
  }, [matchActive]);

  /** Log the running match as it stands. */
  const saveCurrentMatch = () => {
    if (!matchActive) return;

    const scoring = normalizeForMatchType(
      pickScoringFields(sessionData),
      sessionData.matchType
    );
    const breakdown = calculateScore(scoring);

    const newMatch: Match = {
      ...scoring,
      id: generateId(),
      matchNumber,
      matchType: sessionData.matchType,
      finalScore: breakdown.total,
      createdAt: new Date().toISOString(),
    };

    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
      ...emptyScoringFields(),
    });
    savedRunRef.current = matchRunRef.current;

    markPrimaryAction();
    // Start Match and Complete Session take the place of whatever saved.
    absorbDoubleTap();
    resetTimer();
    // Keep hasStarted=true to maintain continuous sessionTimer
    setMatchActive(false);
    setIsTimerRunning(false);
    setPendingConfirm(null);

    toast.success(
      `Match ${newMatch.matchNumber} saved · ${formatPoints(breakdown.total)}`,
      { id: MATCH_SAVED_TOAST_ID }
    );
  };

  /**
   * The match straight to its buzzer: Skip to Buzzer, or End Match in answer
   * to End early. It ends as at a natural buzzer (see `skipToEnd`): End of
   * Match and End park unlock, the page brings them into view, and Save
   * Match comes up where the pressed button was on a full-size screen. The
   * second press of a double tap must not save it.
   */
  const handleSkipToEnd = () => {
    if (!matchActive || matchEnded || editingMatchId) return;
    markPrimaryAction();
    absorbDoubleTap();
    // "End Match N now?" closes itself once the match has ended.
    skipToEnd();
  };

  /** Put a held match clock back, the match audio with it */
  const resumeMatch = (held: HeldMatchClock) => {
    const clock = resumeMatchClock(held);
    followMatchClock(clock, sessionDataRef.current.matchType);
    return clock.phase;
  };

  /**
   * "End Match", in answer to End early: the match ends as at its buzzer
   * (see `handleSkipToEnd`), with an Undo that brings it back as if it had
   * never been ended, for an answer that was not meant.
   */
  const handleConfirmEndMatch = () => {
    if (!matchActive || matchEnded || editingMatchId) return;
    const held = holdMatchClock();
    // The buzzer got there first.
    if (held.clock.phase === 'ended') return;
    handleSkipToEnd();
    offerEndedEarlyUndo(held, endEarlyScrollRef.current);
  };

  /**
   * "Match N ended early", with an Undo for as long as that match is still
   * waiting to be saved: the clock is put back where it would be had the
   * match never been ended (paused, it is still paused at the same second),
   * and the page where it was, with the live counters. What has been scored
   * is left as it is.
   */
  const offerEndedEarlyUndo = (held: HeldMatchClock, scrolledTo: number) => {
    const title = `Match ${matchNumber} ended early`;
    // The walkthrough's practice match goes back with the walkthrough.
    if (isTutorialActive) {
      toast.message(title, { position: walkthroughToastPosition });
      return;
    }
    // One Undo per match ended: a toast id is not reused while the one
    // before it may still be on its way out.
    const toastId = `undo-ended-early-${generateId()}`;
    const endedNumber = matchNumber;
    const epochAtEnd = sessionEpoch;
    const runAtEnd = matchRunRef.current;
    const savedAtEnd = new Set(
      (sessionData.matches ?? []).map(match => match.id)
    );
    const undoToastIds = undoToastIdsRef.current;
    if (endedEarlyToastRef.current) {
      undoToastIds.delete(endedEarlyToastRef.current.id);
      toast.dismiss(endedEarlyToastRef.current.id);
    }
    endedEarlyToastRef.current = { id: toastId, held, scrolledTo };
    undoToastIds.set(toastId, title);
    toast.message(title, {
      id: toastId,
      duration: UI_TIMING.UNDO_WINDOW,
      onAutoClose: () => undoToastIds.delete(toastId),
      onDismiss: () => undoToastIds.delete(toastId),
      action: {
        label: 'Undo',
        onClick: event => {
          // Withdrawn with the session it belonged to.
          if (!undoToastIdsRef.current.has(toastId)) return;
          const say = (why: string) =>
            toast.info(`Undo not available: ${why}`, {
              id: END_EARLY_UNDO_REFUSED_TOAST_ID,
              position: tutorialActiveRef.current
                ? walkthroughToastPosition
                : undefined,
            });
          // For good: the toast goes, saying why.
          const refuse = (why: string) => {
            undoToastIdsRef.current.delete(toastId);
            say(why);
          };
          // For now: the toast stays for when it can be used.
          const wait = (why: string) => {
            event.preventDefault();
            say(why);
          };
          const current = sessionDataRef.current;
          if (
            sessionEpochRef.current !== epochAtEnd ||
            current.isSessionCompleted
          ) {
            refuse('the session has changed');
            return;
          }
          if (matchRunRef.current !== runAtEnd) {
            refuse('another match has started');
            return;
          }
          // Saved here, or in another tab whose session this one took up. A
          // tab that was frozen meanwhile (in the background) may only see
          // the next match, started there: its clock is not this one's.
          if (
            savedRunRef.current === runAtEnd ||
            (current.matches ?? []).some(match => !savedAtEnd.has(match.id))
          ) {
            refuse(`Match ${endedNumber} has been saved`);
            return;
          }
          if (!matchActiveRef.current) {
            refuse(`Match ${endedNumber} was discarded`);
            return;
          }
          // Discarded in another tab while this one was frozen, and a new
          // match started there under the same number.
          if (!isCurrentMatch(held)) {
            refuse('another match has started');
            return;
          }
          // Back already (put back in another tab).
          if (matchPhaseRef.current !== 'ended') {
            undoToastIdsRef.current.delete(toastId);
            return;
          }
          if (isSavingSession()) {
            event.preventDefault();
            return;
          }
          // The walkthrough puts the session back as it found it when it
          // closes, the match with it.
          if (tutorialActiveRef.current) {
            wait('close the tutorial first');
            return;
          }
          // The match would run on behind the dialog, which then can't save.
          if (saveSessionDialogRef.current) {
            wait('close the Save Session dialog first');
            return;
          }
          undoToastIdsRef.current.delete(toastId);
          // Unless its time ran out meanwhile: then End of Match is still
          // where the scorer is needed.
          if (resumeMatch(held) !== 'ended' && window.scrollY !== scrolledTo) {
            window.scrollTo({ top: scrolledTo, behavior: 'instant' });
          }
        },
      },
    });
  };

  /**
   * End early. A match is only ever saved after its buzzer: what is left on
   * the field (Flowers, Left in Hive, Garden) can only be counted once play
   * has stopped. So ending early asks, then ends the match the way the
   * buzzer does, and it is saved from there like any other.
   */
  const handleRequestEndMatch = () => {
    if (isRepeatedPrimaryAction()) return;
    if (!matchActive || matchEnded || editingMatchId) return;
    endEarlyScrollRef.current = window.scrollY;
    askConfirm('endEarly');
  };

  /**
   * The Save button, after the buzzer. A press with nothing counted at the
   * end of the match is more often a slip than a decision, so that is asked
   * about first. A match with nothing scored at all is a legitimate result
   * (a failed run) and is covered by the same question.
   */
  const handleSaveMatch = () => {
    if (isRepeatedPrimaryAction()) return;
    if (!matchActive) {
      toast.error('Start the match before saving it', {
        id: SAVE_BLOCKED_TOAST_ID,
      });
      return;
    }
    if (!matchEnded) {
      handleRequestEndMatch();
      return;
    }
    if (endOfMatchEmpty) {
      askConfirm('saveZeroEom');
      return;
    }
    saveCurrentMatch();
  };

  /** "Save": the answer that saves a match with nothing counted at the end. */
  const handleConfirmSaveMatch = () => saveCurrentMatch();

  /**
   * "Count them first": back to the page, at the End of Match steppers,
   * shown as the buzzer shows them. Measured once Save Match is back in
   * the question's place: on a phone the question made the bar taller.
   */
  const handleCountFirst = () => {
    handleKeepConfirm();
    requestAnimationFrame(() => {
      const section = document.querySelector(END_OF_MATCH_SECTION);
      if (section) revealFirstStepperRow(section);
    });
  };

  /**
   * Open a logged match for editing; with another one open (and unchanged),
   * go straight over to this one.
   */
  const handleStartEditingMatch = (match: Match) => {
    if (isSavingSession() || isInWalkthrough('edit a match')) return;
    setShowUnsavedEditWarning(false);
    startEditingMatch(match);
  };

  /**
   * Save on a logged match; a double tap must not also start a match.
   * Returns false when nothing was saved: the press was the tail of a double
   * tap, or the session is being saved.
   */
  const handleSaveEditedMatch = (): boolean => {
    if (isRepeatedPrimaryAction() || isSavingSession()) return false;
    markPrimaryAction();
    // In the Match Log the editor closes onto the match's own row.
    absorbDoubleTap();
    saveEditedMatch();
    return true;
  };

  /**
   * Discard changes on a logged match. Closing the editor puts Start Match,
   * or in the Match Log the match's own row, where the button was.
   */
  const handleCancelEditedMatch = () => {
    absorbDoubleTap();
    returnToCurrentMatch();
  };

  /** Open the dialog that confirms the session's name and saves it. */
  const openSaveSessionDialog = () => {
    // The dialog opens over the pressed button: a second press would
    // dismiss it.
    absorbDoubleTap();
    setPendingConfirm(null);
    setShowSaveSessionDialog(true);
  };

  /**
   * Checks the session can be saved, then asks the user to confirm its name.
   * The save itself happens in handleCompleteSession once they confirm.
   */
  const handleRequestCompleteSession = () => {
    // On a phone this button shares the bar with Start Match, where Save
    // Match was a moment ago.
    if (completingRef.current || isRepeatedPrimaryAction()) return;
    if (isInWalkthrough('complete the session')) return;

    if (matchActive) {
      toast.error(RUNNING_MATCH_MESSAGE, { id: COMPLETE_BLOCKED_TOAST_ID });
      return;
    }

    if (editingMatchId) {
      toast.error('Save or discard your match edit first', {
        id: COMPLETE_BLOCKED_TOAST_ID,
      });
      return;
    }

    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error('Save at least one match before completing the session', {
        id: COMPLETE_BLOCKED_TOAST_ID,
      });
      return;
    }

    if (uid) {
      const problem = sessionSaveProblem({
        notes: sessionData.notes,
        matches: sessionData.matches,
      });
      if (problem) {
        toast.error(problem, {
          id: COMPLETE_BLOCKED_TOAST_ID,
          duration: UI_TIMING.UNDO_WINDOW,
        });
        return;
      }
    }

    // Numbers in Match Entry that belong to no saved match are not part of
    // the session: say so before finishing without them.
    if (hasUnsavedMatchData) {
      askConfirm('completeWithStray');
      return;
    }

    openSaveSessionDialog();
  };

  /**
   * "Discard them and finish". The numbers stay in the fields until the
   * session is actually saved, so backing out of the dialog loses nothing.
   */
  const handleConfirmCompleteWithStray = () => {
    if (completingRef.current) return;
    if (isInWalkthrough('complete the session')) return;
    openSaveSessionDialog();
  };

  /** Everything stored for a completed session, signed in or guest. */
  const buildSessionToSave = (sessionName: string, teamId?: string) => {
    const matches = sessionData.matches || [];
    return {
      sessionName,
      sessionType: sessionData.sessionType || 'Practice',
      matchType: sessionMatchType(
        matches,
        sessionData.matchType || 'Full Game'
      ),
      // Read as the session is saved: this hook doesn't follow the clock.
      sessionDuration: formatTime(getTimers().sessionTimer),

      userId: uid || localStorage.getItem('teamtrack-guest-id') || 'guest',
      userEmail: user?.email || '',
      ...(teamId ? { teamId } : {}),

      selectedFeature: sessionData.selectedFeature || '',
      notes: sessionData.notes || '',
      matches,

      completedAt: new Date().toISOString(),
    };
  };
  type SessionToSave = ReturnType<typeof buildSessionToSave>;

  /** What a save carries that the user can still change before it lands */
  const sessionContentKey = (session: {
    sessionName?: string;
    sessionType?: string;
    notes?: string;
    matches?: Match[];
  }) =>
    JSON.stringify([
      session.sessionName || '',
      session.sessionType || 'Practice',
      session.notes || '',
      session.matches || [],
    ]);

  /** The session is stored: show the completed screen. */
  const finishSavedSession = (id: string, duration: string) => {
    markPrimaryAction();
    dismissUndoToasts();
    setSavedSessionId(id);
    // A write that lands late gets here with the dialog reopened for a
    // retry: left open, it would come back over the next session.
    setShowSaveSessionDialog(false);
    setPendingConfirm(null);
    completeSession(duration);
    markSessionCompleted();
  };

  /**
   * A write that timed out has now landed. If nothing changed in the
   * meantime it is the session's save; otherwise it is a stale copy of a
   * session the user was told had not been saved, so take it back down.
   */
  const settleLateSave = (pending: PendingSave, saved: Session | null) => {
    // A retry is awaiting this same write and will finish the job itself.
    if (pending.waiting > 0) return;
    const superseded = pendingSave !== pending;
    if (!superseded) pendingSave = null;
    if (!saved?.id) return;

    const current = sessionDataRef.current;
    const unchanged =
      !superseded &&
      mountedRef.current &&
      sessionEpochRef.current === pending.epoch &&
      !current.isSessionCompleted &&
      !matchActiveRef.current &&
      // A match open for editing has changes that are not in `matches` yet:
      // completing now would drop them and close the editor.
      !editingMatchIdRef.current &&
      // Completed under the walkthrough, the session would be put back as in
      // progress when it closes, with this copy already saved.
      !tutorialActiveRef.current &&
      sessionContentKey(current) === pending.content;
    if (unchanged) {
      finishSavedSession(saved.id, pending.duration);
      toast.success('Session saved');
    } else {
      firebaseService.deleteSession(saved.id).catch(() => {});
    }
  };

  /** Write the session, giving up (but not losing track of it) at `deadline`. */
  const createSessionByDeadline = async (
    session: SessionToSave,
    deadline: number
  ): Promise<Session | null> => {
    const content = sessionContentKey(session);
    const key = `${session.teamId ?? ''}|${content}`;
    let pending = pendingSave;
    if (!pending || pending.key !== key || pending.epoch !== sessionEpoch) {
      // Anything still in flight is for an older version of the session;
      // settleLateSave removes it if it lands.
      pending = {
        key,
        content,
        promise: firebaseService.createSession(session),
        waiting: 0,
        watched: false,
        epoch: sessionEpoch,
        duration: session.sessionDuration,
      };
      pendingSave = pending;
    }

    const attempt = pending;
    attempt.waiting++;
    try {
      const saved = await withDeadline(attempt.promise, deadline);
      if (pendingSave === attempt) pendingSave = null;
      return saved;
    } catch (error) {
      if (!(error instanceof SaveTimeoutError)) {
        if (pendingSave === attempt) pendingSave = null;
      } else if (!attempt.watched) {
        attempt.watched = true;
        attempt.promise.then(
          saved => settleLateSave(attempt, saved),
          () => {
            if (pendingSave === attempt) pendingSave = null;
          }
        );
      }
      throw error;
    } finally {
      attempt.waiting--;
    }
  };

  /** Signed-in save. Returns false when it was refused with its own toast. */
  const saveToAccount = async (
    userId: string,
    sessionName: string
  ): Promise<boolean> => {
    if (!navigator.onLine) throw new SaveTimeoutError();
    const deadline = performance.now() + SAVE_TIMEOUT_MS;

    // The team is only loaded at sign-in, so membership may have ended
    // since: a session filed under a team the user isn't in is refused.
    // Captured now: finishing the save moves on to the next session epoch.
    const sessionTeam = team ?? sessionTeamRef.current;
    let teamId = team?.id;
    let savedAsPersonal = Boolean(sessionTeam && !team);
    let stillListed = false;
    if (team) {
      const freshTeam = await withDeadline(
        teamService.getTeam(team.id),
        deadline
      );
      // null is "couldn't tell" (ex-members can't read the team at all);
      // the save below settles it.
      stillListed = Boolean(freshTeam?.memberIds?.includes(userId));
      if (freshTeam && !stillListed) {
        teamId = undefined;
        savedAsPersonal = true;
      }
    }

    let sessionToSave = buildSessionToSave(sessionName, teamId);
    const problem = sessionSaveProblem(sessionToSave);
    if (problem) {
      toast.error(problem, { duration: UI_TIMING.UNDO_WINDOW });
      return false;
    }

    let saved: Session | null;
    try {
      saved = await createSessionByDeadline(sessionToSave, deadline);
    } catch (error) {
      if (!teamId || errorCode(error) !== 'permission-denied') throw error;
      savedAsPersonal = true;
      sessionToSave = buildSessionToSave(sessionName);
      saved = await createSessionByDeadline(sessionToSave, deadline);
    }

    if (!saved?.id) {
      toast.error(saveErrorMessage(null));
      return false;
    }

    // Nothing on this page can be changed while the dialog is up, but the
    // same session open in another tab can be.
    //
    // Edited there: what has just been stored is an older version. Take it
    // back down and leave the session open, rather than report the old one
    // as saved.
    //
    // Closed there (discarded, or completed) while this save was on its way:
    // what was stored is what was confirmed here, so it stays. A session
    // thrown away from a forgotten tab could not be got back; a second copy
    // can be deleted. This tab now holds that tab's next session, which is
    // left as it is rather than marked complete, and that tab's Undo of the
    // discard is withdrawn: it would put a stored session back in progress.
    //
    // Discarded there and put back with that Undo before this landed, it is
    // the session on screen again, and is finished (or not) as if it had
    // never gone.
    const current = sessionDataRef.current;
    const savedMatchIds = new Set(sessionToSave.matches.map(match => match.id));
    const closedElsewhere =
      sessionEpochRef.current !== sessionEpoch &&
      !(current.matches ?? []).some(match => savedMatchIds.has(match.id));
    if (
      !closedElsewhere &&
      // A match started there meanwhile is not in what was stored either.
      (matchActiveRef.current ||
        sessionContentKey({
          ...current,
          // The name was confirmed in the dialog as this save began.
          sessionName: sessionToSave.sessionName,
        }) !== sessionContentKey(sessionToSave))
    ) {
      firebaseService.deleteSession(saved.id).catch(() => {});
      toast.warning(
        'This session changed while it was being saved, so nothing was saved. Complete it again to save it as it is now.',
        { duration: UI_TIMING.UNDO_WINDOW }
      );
      return false;
    }

    if (closedElsewhere) {
      noteSavedElsewhere(sessionToSave.matches);
    } else {
      finishSavedSession(saved.id, sessionToSave.sessionDuration);
    }
    if (savedAsPersonal && sessionTeam) {
      if (team) void refreshTeam();
      toast.warning(
        stillListed
          ? `Couldn't save to ${sessionTeam.name}; saved as a personal session`
          : `You are no longer in ${sessionTeam.name}; saved as a personal session`,
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    } else if (closedElsewhere) {
      toast.success(
        'Session saved. Another tab closed it meanwhile, so a new session is open here.',
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    } else {
      toast.success('Session saved');
    }
    return true;
  };

  /** Guest save: the session goes to this browser's storage only. */
  const saveToBrowser = (sessionName: string) => {
    const sessionToSave = buildSessionToSave(sessionName);
    const guestSession = {
      ...sessionToSave,
      season: CURRENT_SEASON,
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date().toISOString(),
    };
    const existing = readGuestSessions();

    // The in-progress copy is about to be redundant; freeing it first can be
    // the difference between fitting and not when storage is nearly full.
    const draft = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    try {
      writeGuestSessions([guestSession, ...existing]);
    } catch (error) {
      if (draft !== null) {
        localStorage.setItem(STORAGE_KEYS.SESSION_DATA, draft);
      }
      throw error;
    }

    finishSavedSession(guestSession.id, sessionToSave.sessionDuration);
    toast.success('Session saved on this device');

    if (
      !guestStorageWarned &&
      localStorageUsage() > GUEST_STORAGE_QUOTA * GUEST_STORAGE_WARN_RATIO
    ) {
      guestStorageWarned = true;
      toast.warning(
        'Guest storage is almost full - sign in or delete old sessions to keep saving',
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    }
  };

  const handleCompleteSession = async (confirmedName: string) => {
    // A second tap while the first save is still in flight saves nothing.
    if (completingRef.current) return;
    if (isInWalkthrough('complete the session')) return;
    const sessionName = confirmedName.trim();
    if (!sessionName) return;
    if (matchActive) {
      toast.error(RUNNING_MATCH_MESSAGE, { id: COMPLETE_BLOCKED_TOAST_ID });
      return;
    }
    // A dialog left open over a session that has since been completed or
    // discarded (in another tab) must not save the empty one that replaced
    // it.
    if (!sessionData.matches?.length) {
      setShowSaveSessionDialog(false);
      return;
    }

    completingRef.current = true;
    setIsCompleting(true);
    // The dialog stays up until the save settles, so nothing under it can be
    // edited meanwhile: such an edit would not be in what was stored. It
    // then closes onto the page or the completed screen.
    absorbDoubleTap();
    updateSessionData({ sessionName });
    setIsTimerRunning(false);

    try {
      if (uid) {
        await saveToAccount(uid, sessionName);
      } else {
        saveToBrowser(sessionName);
      }
    } catch (error) {
      if (!(error instanceof SaveTimeoutError)) {
        logger.error('Error saving session', error);
      }
      if (!uid) {
        toast.error(
          isQuotaError(error)
            ? 'Guest storage is full - sign in or delete old sessions'
            : 'An error occurred while saving the session. Your data is preserved — please try again.'
        );
      } else {
        toast.error(saveErrorMessage(error));
      }
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
      setShowSaveSessionDialog(false);
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    if (isSavingSession()) return;
    const before = sessionData.matches || [];
    const index = before.findIndex(m => m.id === matchId);
    if (index === -1) return;
    const deleted = before[index];

    // Deleting the match that is open for editing closes the editor first,
    // so its Save isn't left pointing at a match that no longer exists.
    if (matchId === editingMatchId) {
      returnToCurrentMatch();
      setShowUnsavedEditWarning(false);
    }

    // The other matches keep their numbers: "Match 3" stays the third
    // match played, whatever happens to Match 2.
    updateSessionData({
      matches: before.filter(m => m.id !== matchId),
    });
    // The rows below move up to where the question was.
    absorbDoubleTap();
    setDeleteConfirmIdState(null);
    // "Match N saved" would now be about a match that may be gone.
    toast.dismiss(MATCH_SAVED_TOAST_ID);

    const toastId = `undo-match-${matchId}`;
    const epochAtDelete = sessionEpoch;
    const undoToastIds = undoToastIdsRef.current;
    const title = `Match ${deleted.matchNumber} deleted`;
    undoToastIds.set(toastId, title);
    const offerGone = () => undoToastIds.delete(toastId);
    // Neutral, like every delete or discard with an Undo: green is for saves.
    toast.message(title, {
      id: toastId,
      duration: UI_TIMING.UNDO_WINDOW,
      onAutoClose: offerGone,
      onDismiss: offerGone,
      action: {
        label: 'Undo',
        onClick: event => {
          // Not under a save; the toast stays for when the save is done.
          if (isSavingSession()) {
            event.preventDefault();
            return;
          }
          // Nor under the walkthrough, which puts the session back as it
          // found it when it closes: the restored match would go with it.
          if (tutorialActiveRef.current) {
            event.preventDefault();
            toast.info('Close the tutorial to undo', {
              id: TUTORIAL_TOAST_ID,
              position: walkthroughToastPosition,
            });
            return;
          }
          // Only while the session it was deleted from is still the open one.
          if (!undoToastIdsRef.current.delete(toastId)) return;
          if (
            sessionEpochRef.current !== epochAtDelete ||
            sessionDataRef.current.isSessionCompleted
          ) {
            return;
          }
          const current = sessionDataRef.current.matches || [];
          if (current.some(m => m.id === matchId)) return;
          // Back in its place, under the number it had. Deleting the last
          // match frees its number for the next one: if a match has been
          // saved under it since (started after the delete, or already
          // running), that match and any after it move up one, so the
          // numbers stay in the order the matches were played and no two
          // are the same.
          const taken = current.some(
            m => m.matchNumber === deleted.matchNumber
          );
          const restored = taken
            ? current.map(m =>
                m.matchNumber >= deleted.matchNumber
                  ? { ...m, matchNumber: m.matchNumber + 1 }
                  : m
              )
            : [...current];
          const at = restored.findIndex(
            m => m.matchNumber > deleted.matchNumber
          );
          restored.splice(at === -1 ? restored.length : at, 0, deleted);
          updateSessionData({ matches: restored });
          // "Match N saved" was about the match that has just moved up.
          if (taken) toast.dismiss(MATCH_SAVED_TOAST_ID);
        },
      },
    });
  };

  // Escape answers any open question with its safe choice.
  useEscapeKey(pendingConfirm !== null, () => setPendingConfirm(null));
  useEscapeKey(deleteConfirmId !== null, () => setDeleteConfirmIdState(null));
  useEscapeKey(newSessionConfirm, () => setNewSessionConfirm(false));

  /** The X beside the match controls: only asks. The clock keeps running. */
  const handleRequestDiscardMatch = () => {
    if (!matchActive || editingMatchId) return;
    askConfirm('discardMatch');
  };

  const handleDiscardCurrentMatch = () => {
    if (!matchActive) return;
    // What its Undo puts back: the numbers, and the clock as it stood.
    const discarded = {
      scoring: pickScoringFields(sessionData),
      clock: holdMatchClock(),
    };
    // "Match N ended early - Undo" goes with the match; undoing the discard
    // brings it back, if it was still on offer.
    const endedEarly =
      endedEarlyToastRef.current &&
      undoToastIdsRef.current.has(endedEarlyToastRef.current.id)
        ? endedEarlyToastRef.current
        : null;
    updateSessionData(emptyScoringFields());
    resetTimer();
    // The session (and its clock) carries on if matches are already logged;
    // only an abandoned first match takes the session back to "not started".
    if (!sessionData.matches?.length) {
      setHasStarted(false);
    }
    setMatchActive(false);
    setIsTimerRunning(false);
    setPendingConfirm(null);
    // Start Match comes back under the button that discarded.
    markPrimaryAction();
    absorbDoubleTap();

    const title = `Match ${matchNumber} discarded`;
    // The walkthrough's practice match goes back with the walkthrough.
    if (isTutorialActive) {
      toast.message(title);
      return;
    }
    // One Undo per discard: a toast id is not reused while the one before
    // it may still be on its way out.
    const toastId = `undo-discarded-match-${generateId()}`;
    const epochAtDiscard = sessionEpoch;
    const undoToastIds = undoToastIdsRef.current;
    if (matchDiscardToastRef.current) {
      undoToastIds.delete(matchDiscardToastRef.current);
      toast.dismiss(matchDiscardToastRef.current);
    }
    matchDiscardToastRef.current = toastId;
    undoToastIds.set(toastId, title);
    toast.message(title, {
      id: toastId,
      duration: UI_TIMING.UNDO_WINDOW,
      onAutoClose: () => undoToastIds.delete(toastId),
      onDismiss: () => undoToastIds.delete(toastId),
      action: {
        label: 'Undo',
        onClick: event => {
          // The toast stays for when the save, the walkthrough or the edit
          // is done.
          if (isSavingSession()) {
            event.preventDefault();
            return;
          }
          if (tutorialActiveRef.current) {
            event.preventDefault();
            toast.info('Close the tutorial to undo', {
              id: TUTORIAL_TOAST_ID,
              position: walkthroughToastPosition,
            });
            return;
          }
          // The fields hold the match being edited.
          if (editingMatchIdRef.current) {
            event.preventDefault();
            toast.info('Save or discard your match edit first', {
              id: EDIT_OPEN_TOAST_ID,
            });
            return;
          }
          // The match would run on behind the dialog, which then can't save.
          if (saveSessionDialogRef.current) {
            event.preventDefault();
            toast.info('Close the Save Session dialog to undo', {
              id: SAVE_DIALOG_OPEN_TOAST_ID,
            });
            return;
          }
          // Only while no other match has taken its place.
          if (!undoToastIdsRef.current.delete(toastId)) return;
          const current = sessionDataRef.current;
          if (
            sessionEpochRef.current !== epochAtDiscard ||
            matchActiveRef.current ||
            current.isSessionCompleted
          ) {
            return;
          }
          updateSessionData({
            ...addScoring(current, discarded.scoring),
            phaseLog: [
              ...(discarded.scoring.phaseLog ?? []),
              ...(current.phaseLog ?? []),
            ],
          });
          setHasStarted(true);
          setMatchActive(true);
          // A clock that was running has run on meanwhile, as the one on the
          // field has: the match comes back where the field is now.
          if (resumeMatch(discarded.clock) === 'ended' && endedEarly) {
            offerEndedEarlyUndo(endedEarly.held, endedEarly.scrolledTo);
          }
        },
      },
    });
  };

  /** The saved match open for editing, for the labels that name it */
  const editingMatchNumber =
    sessionData.matches?.find(match => match.id === editingMatchId)
      ?.matchNumber ?? null;

  return {
    sessionData,
    isDarkMode,
    loading: isCompleting,
    isTimerRunning,
    setIsTimerRunning,
    matchPhase,
    matchActive,
    hasStarted,
    editingMatchId,
    startEditingMatch: handleStartEditingMatch,
    saveEditedMatch: handleSaveEditedMatch,
    returnToCurrentMatch: handleCancelEditedMatch,
    skipToTeleop,
    skipToEndgame,
    skipToEnd: handleSkipToEnd,
    markPrimaryAction,

    /** Match number the fields will be saved under */
    matchNumber,
    savedMatchCount,
    /** After the buzzer, before the match is saved */
    matchEnded,
    /** Points in the scoring fields right now */
    currentMatchTotal: currentMatchScore.total,
    editingMatchNumber,

    pendingConfirm,
    handleKeepConfirm,
    deleteConfirmId,
    setDeleteConfirmId,
    newSessionConfirm,
    setNewSessionConfirm,
    showSaveSessionDialog,
    setShowSaveSessionDialog,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,

    isSessionSetupSaved,
    onOpenSessionSetup,

    handleViewAnalysis,
    handleNewSession,
    handleConfirmNewSession,
    handleRequestDiscardSession,
    handleConfirmDiscardSession,
    handleStartMatch,
    handleRequestEndMatch,
    handleConfirmEndMatch,
    handleSaveMatch,
    handleConfirmSaveMatch,
    handleCountFirst,
    handleRequestCompleteSession,
    handleConfirmCompleteWithStray,
    handleCompleteSession,
    handleDeleteMatch,
    handleRequestDiscardMatch,
    handleDiscardCurrentMatch,
  };
};

type LiveControlsValue = ReturnType<typeof useLiveControlsState>;

export const LiveControlsContext = createContext<LiveControlsValue | null>(
  null
);

export const useLiveControls = (): LiveControlsValue => {
  const value = useContext(LiveControlsContext);
  if (!value) {
    throw new Error(
      'Match controls must be rendered inside <LiveControlsProvider>'
    );
  }
  return value;
};
