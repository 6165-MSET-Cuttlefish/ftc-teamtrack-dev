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
  robotCountOf,
  sessionMatchType,
  toDate,
  writeGuestSessions,
} from '@/lib';
import { followMatchClock } from '@/lib/followMatchClock';
import { nextMatchNumber } from '@/lib/matchNumber';
import { formatPoints } from '@/lib/points';
import { noteSessionFinished } from '@/lib/sessionFinished';
import { rememberSessionNames } from '@/lib/sessionName';
import { firebaseService, teamService } from '@/services';
import type {
  Match,
  MatchScoringFields,
  Session,
  SessionFormData,
  Team,
} from '@/types';
import {
  onCompleteRequest,
  takeCompleteRequest,
  type CompleteRequest,
} from './completeRequest';
import { absorbDoubleTap, watchTaps } from './doubleTap';
import { useCompactControls } from './useCompactControls';

/** The page passes nothing in: everything comes from the session itself. */
export type LiveControlsProps = Record<never, never>;

const UNREACHABLE_MESSAGE =
  "Can't reach the server - your matches are kept on this device, try again";
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
/** Why "Match N ended early - Undo" can't put the match back (yet) */
const END_EARLY_UNDO_REFUSED_TOAST_ID = 'end-early-undo-refused';

/**
 * A Save Session write this browser started, under the id it writes to:
 * `{ id, uid, matchIds }`. The same session is always written under the
 * same id, so a retry (after a reload, or a save that timed out) replaces
 * what an earlier attempt stored instead of adding a second copy, and a
 * reload in the middle of a save can find out that it landed.
 */
const PENDING_SAVE_KEY = 'teamtrack-pending-save';

interface PendingSaveNote {
  id: string;
  uid: string;
  matchIds: string[];
}

const readPendingSaveNote = (): PendingSaveNote | null => {
  try {
    const note: unknown = JSON.parse(
      localStorage.getItem(PENDING_SAVE_KEY) ?? ''
    );
    if (
      typeof note === 'object' &&
      note !== null &&
      typeof (note as PendingSaveNote).id === 'string' &&
      typeof (note as PendingSaveNote).uid === 'string' &&
      Array.isArray((note as PendingSaveNote).matchIds)
    ) {
      return note as PendingSaveNote;
    }
  } catch {
    /* none, or unreadable */
  }
  return null;
};

const writePendingSaveNote = (note: PendingSaveNote) => {
  try {
    localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(note));
  } catch {
    /* storage full: a retry after a reload gets an id of its own */
  }
};

const clearPendingSaveNote = () => {
  try {
    localStorage.removeItem(PENDING_SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
};

/** A new document id, made the way Firestore makes its own (20 characters) */
const newSessionId = (): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
};

/**
 * The id this session is saved under: the one an earlier attempt for the
 * same session used (it shares a saved match with it), or a new one.
 */
const sessionSaveId = (uid: string, matches: Match[]): string => {
  const note = readPendingSaveNote();
  const ids = matches.map(match => match.id);
  if (note && note.uid === uid && note.matchIds.some(id => ids.includes(id))) {
    writePendingSaveNote({ ...note, matchIds: ids });
    return note.id;
  }
  const id = newSessionId();
  writePendingSaveNote({ id, uid, matchIds: ids });
  return id;
};

/** Signed-in owners whose session names have been read on this page load */
const namesReadFor = new Set<string>();

/**
 * The questions /active can still ask before it acts (everything else acts
 * at once, with an Undo). Only one is ever open.
 *
 * - `completeWithStray`: finish the session with numbers in Match Entry
 *   that belong to no saved match
 */
export type PendingConfirm = 'completeWithStray';

/**
 * Whether a question takes the place of the Start / Save button: Complete
 * Session's is asked where that button is, beside Start.
 */
export const isPrimarySlotConfirm = (pending: PendingConfirm | null): boolean =>
  pending === 'completeWithStray';

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
  /** The name it is saved under, for the toast once it lands */
  name: string;
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

/**
 * When a session was played: its first match. A session finished on a later
 * day (left open overnight) is still dated, and sorted, by the day it was
 * played, not by the day it was saved.
 */
const sessionDateOf = (matches: readonly Match[]): Date => {
  const times = matches
    .map(match => (match.createdAt ? toDate(match.createdAt).getTime() : NaN))
    .filter(Number.isFinite);
  return new Date(times.length > 0 ? Math.min(...times) : Date.now());
};

const localStorageUsage = (): number => {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) chars += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  return chars;
};

// Nothing comes in through the props the provider passes on.
export const useLiveControlsState = (_props: LiveControlsProps) => {
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
    skipToFlowers,
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
  /** The small dialog that renames the session (from the session menu) */
  const [showRenameDialog, setShowRenameDialog] = useState<boolean>(false);
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
  const matchPhaseRef = useRef(matchPhase);
  useEffect(() => {
    sessionDataRef.current = sessionData;
    matchActiveRef.current = matchActive;
    matchPhaseRef.current = matchPhase;
    hasStartedRef.current = hasStarted;
    editingMatchIdRef.current = editingMatchId;
    tutorialActiveRef.current = isTutorialActive;
  }, [
    sessionData,
    matchActive,
    matchPhase,
    hasStarted,
    editingMatchId,
    isTutorialActive,
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
    // The rename dialog and any open question were about the session that
    // is gone (completed or discarded, here or in another tab).
    setShowRenameDialog(false);
    setPendingConfirm(null);
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
    // The other toasts about the gap between matches ("Match 1 saved")
    // would sit over the card's Skip and Next, and are done with once the
    // tutorial is up.
    if (isTutorialActive) {
      BETWEEN_MATCHES_TOAST_IDS.forEach(id => toast.dismiss(id));
    }
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
   * A saved match open for editing with changes not saved. They are kept
   * with this tab (see matchEditDraft): a reload brings them back, a closed
   * tab does not.
   */
  const editHasChanges = useMemo(() => {
    if (!editingMatchId) return false;
    const open = sessionData.matches?.find(m => m.id === editingMatchId);
    return (
      !open ||
      JSON.stringify(pickScoringFields(open)) !==
        JSON.stringify(pickScoringFields(sessionData))
    );
  }, [editingMatchId, sessionData]);

  // Worth a "leave this page?" from the browser only while the session is
  // being saved (leaving then may or may not keep the save), or while a
  // match edit has changes (a closed tab loses them). Everything else comes
  // back with the page (the session, its clocks), so the browser's "changes
  // may not be saved" would be false.
  const unloadLoses = isCompleting || editHasChanges;
  useEffect(() => {
    if (!unloadLoses) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unloadLoses]);

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

  const savedMatchCount = sessionData.matches?.length ?? 0;
  /**
   * The number the match in the fields will be saved under. Matches keep
   * their numbers when one is deleted, so it is one past the highest.
   */
  const matchNumber = nextMatchNumber(sessionData.matches);
  /** The buzzer has gone and the match is waiting to be saved */
  const matchEnded = matchActive && matchPhase === 'ended';
  /**
   * Why the session can't be completed (or a saved match opened) while a
   * match is on: "Save Match 3 first" once its buzzer has gone, "Finish
   * Match 3 first" while it is still being played.
   */
  const matchFirstMessage = `${matchEnded ? 'Save' : 'Finish'} Match ${matchNumber} first`;

  /**
   * The open question, for as long as what it asks about is still there: a
   * match started or opened, or the stray numbers gone, take it with them.
   */
  const confirmStillApplies =
    pendingConfirmState === 'completeWithStray' &&
    !matchActive &&
    !editingMatchId &&
    hasUnsavedMatchData &&
    savedMatchCount > 0 &&
    !sessionData.isSessionCompleted;
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
    setPendingConfirm(question);
  };

  /** The safe answer to every question: change nothing. */
  const handleKeepConfirm = () => {
    // The button that asked comes back where this one was.
    absorbDoubleTap();
    setPendingConfirm(null);
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

  /**
   * On to a fresh session, ready to start: after this one is saved, or
   * discarded (with its Undo). A draft of notes goes too.
   */
  const startFreshSession = () => {
    // The fresh session's Start Match can land where the pressed button
    // was: a double tap must not start its first match.
    absorbDoubleTap();
    dismissUndoToasts();
    resetSession({ discardDraft: true });
    setPendingConfirm(null);
  };

  /**
   * Discard Session, from the session menu: it goes at once, and the page
   * goes straight back to a fresh session, with an Undo that puts it back
   * for as long as the fresh one has not been used. A match that was being
   * played comes back where the field is now, its clock and audio with it,
   * as Discard Match's Undo brings one back: the app stays in step with the
   * field. One open for editing comes back as it was last saved.
   */
  const handleDiscardSession = () => {
    if (isInWalkthrough('discard the session') || isSavingSession()) return;
    // What is under the menu item must not take the second tap.
    absorbDoubleTap();

    const worthKeeping = Boolean(hasUnsavedWork) || hasStarted;
    const liveMatch = matchActive && !editingMatchId;
    // "Match N ended early - Undo" goes with the match; undoing the discard
    // brings it back, if it was still on offer.
    const endedEarly =
      liveMatch &&
      endedEarlyToastRef.current &&
      undoToastIdsRef.current.has(endedEarlyToastRef.current.id)
        ? endedEarlyToastRef.current
        : null;
    const snapshot = {
      sessionData: JSON.parse(
        JSON.stringify({
          ...sessionData,
          ...(editingMatchId ? emptyScoringFields() : {}),
        })
      ) as SessionFormData,
      sessionTimer: getTimers().sessionTimer,
      // The match being played, and its clock as it stood
      match: liveMatch ? holdMatchClock() : null,
      // Without a saved match or one being played, the session goes back to
      // "not started", as it does when a first match is discarded.
      hasStarted: hasStarted && (savedMatchCount > 0 || liveMatch),
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
          const held = snapshot.match;
          if (!held) return;
          setMatchActive(true);
          // The clock goes back once the session it belongs to is the one
          // in place (its match type decides how it runs on), after this
          // update has been applied.
          setTimeout(() => {
            if (!mountedRef.current) return;
            // A clock that was running has run on meanwhile, as the one on
            // the field has: the match comes back where the field is now.
            if (resumeMatch(held) === 'ended' && endedEarly) {
              offerEndedEarlyUndo(endedEarly.held, endedEarly.scrolledTo);
            }
          }, 0);
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
        : 'Cleared the fouls entered before the match started',
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
    // A session always has a name, unless one kept from an older build
    // lost it: ask for one first.
    if (!sessionData.sessionName?.trim()) {
      setShowRenameDialog(true);
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

  /** The running match as it stands, as a saved match dated `at` (epoch ms) */
  const runningMatchAsSaved = (at: number): Match & { finalScore: number } => {
    const scoring = normalizeForMatchType(
      pickScoringFields(sessionData),
      sessionData.matchType
    );
    return {
      ...scoring,
      // The robots it was played with, as the session had it then
      robotCount: robotCountOf(sessionData),
      id: generateId(),
      matchNumber,
      matchType: sessionData.matchType,
      finalScore: calculateScore(scoring).total,
      createdAt: new Date(at).toISOString(),
    };
  };

  /** Log the running match as it stands. */
  const saveCurrentMatch = () => {
    if (!matchActive) return;

    const newMatch = runningMatchAsSaved(Date.now());

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
      `Match ${newMatch.matchNumber} saved · ${formatPoints(newMatch.finalScore)}`,
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
   * End early. A match is only ever saved after its buzzer: what is left on
   * the field (Flowers, Left in Hive, Garden) can only be counted once play
   * has stopped. So End early ends the match at once, the way the buzzer
   * does (see `handleSkipToEnd`), and it is saved from there like any
   * other. Its Undo brings it back as if it had never been ended, for a
   * press that was not meant.
   */
  const handleEndEarly = () => {
    // Start (or Resume) was where this is a moment ago.
    if (isRepeatedPrimaryAction()) return;
    if (!matchActive || matchEnded || editingMatchId) return;
    const held = holdMatchClock();
    // The buzzer got there first.
    if (held.clock.phase === 'ended') return;
    // Where the page was, before the buzzer brings End of Match into view
    const scrolledTo = window.scrollY;
    handleSkipToEnd();
    offerEndedEarlyUndo(held, scrolledTo);
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
   * The Save button, after the buzzer: it saves the match as counted. A
   * count left at 0 by mistake is fixed afterwards from the Match Log.
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
      handleEndEarly();
      return;
    }
    saveCurrentMatch();
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

  /**
   * Whether the session can be completed now; when it can't, a toast says
   * why. Not under the walkthrough, which puts the session back as it found
   * it, nor with a match on or open for editing: the session is saved as
   * its saved matches stand.
   */
  const canCompleteSession = (): boolean => {
    if (completingRef.current) return false;
    if (isInWalkthrough('complete the session')) return false;

    if (matchActive) {
      toast.error(matchFirstMessage, { id: COMPLETE_BLOCKED_TOAST_ID });
      return false;
    }

    if (editingMatchId) {
      toast.error('Save or discard your match edit first', {
        id: COMPLETE_BLOCKED_TOAST_ID,
      });
      return false;
    }

    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error('Save at least one match before completing the session', {
        id: COMPLETE_BLOCKED_TOAST_ID,
      });
      return false;
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
        return false;
      }
    }
    return true;
  };

  /**
   * Complete Session: the session is saved under the name it has (renamed
   * from the session menu, if at all) and the page goes straight to its
   * Analysis. Nothing is asked first, unless numbers in Match Entry belong
   * to no saved match.
   */
  const handleRequestCompleteSession = () => {
    // On a phone this button shares the bar with Start Match, where Save
    // Match was a moment ago.
    if (isRepeatedPrimaryAction()) return;
    if (!canCompleteSession()) return;

    // Numbers in Match Entry that belong to no saved match are not part of
    // the session: say so before finishing without them.
    if (hasUnsavedMatchData) {
      askConfirm('completeWithStray');
      return;
    }

    void completeSessionNow({ openAnalysis: true });
  };

  /** "Discard them and finish". */
  const handleConfirmCompleteWithStray = () => {
    if (!canCompleteSession()) return;
    void completeSessionNow({ openAnalysis: true });
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

  /**
   * The session is stored. The page moves on to a fresh session at once,
   * ready for the next practice: the one just saved is in Sessions, and its
   * Analysis is where Complete Session goes. Another tab that had it open
   * is told what became of it, and the next session is numbered past it.
   */
  const finishSavedSession = (id: string, duration: string, name: string) => {
    markPrimaryAction();
    dismissUndoToasts();
    setPendingConfirm(null);
    noteSessionFinished(
      (sessionDataRef.current.matches ?? []).map(match => match.id),
      { id, name }
    );
    clearPendingSaveNote();
    if (uid) rememberSessionNames(uid, [name], { replace: false });
    completeSession(duration);
    markSessionCompleted();
    startFreshSession();
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
      finishSavedSession(saved.id, pending.duration, pending.name);
      toast.success(`${pending.name} saved`);
    } else if (!superseded) {
      // A newer save of the session writes over it under the same id; with
      // none on its way, the stale copy comes down.
      firebaseService.deleteSession(saved.id).catch(() => {});
    }
  };

  /**
   * Write the session under `id`, giving up (but not losing track of it) at
   * `deadline`.
   */
  const createSessionByDeadline = async (
    session: SessionToSave,
    id: string,
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
        promise: firebaseService.createSession(
          session,
          id,
          sessionDateOf(session.matches)
        ),
        waiting: 0,
        watched: false,
        epoch: sessionEpoch,
        duration: session.sessionDuration,
        name: session.sessionName,
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

  /**
   * Signed-in save. Returns the id the session was stored under, or null
   * when it was refused with its own toast. `leftOut` ends its toast (see
   * `completeSessionNow`).
   */
  const saveToAccount = async (
    userId: string,
    sessionName: string,
    leftOut = ''
  ): Promise<string | null> => {
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
      return null;
    }

    // Noted before anything is written: a reload from here on finds out
    // whether this landed (see the check as the page opens).
    const saveId = sessionSaveId(userId, sessionToSave.matches);
    let saved: Session | null;
    try {
      saved = await createSessionByDeadline(sessionToSave, saveId, deadline);
    } catch (error) {
      if (!teamId || errorCode(error) !== 'permission-denied') throw error;
      savedAsPersonal = true;
      sessionToSave = buildSessionToSave(sessionName);
      saved = await createSessionByDeadline(sessionToSave, saveId, deadline);
    }

    if (!saved?.id) {
      toast.error(saveErrorMessage(null));
      return null;
    }

    // What is on this page is held still while the save is on its way (its
    // buttons wait for it), but Notes can still be typed in, and the same
    // session open in another tab can be changed.
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
      return null;
    }

    if (closedElsewhere) {
      noteSavedElsewhere(sessionToSave.matches);
      clearPendingSaveNote();
    } else {
      finishSavedSession(
        saved.id,
        sessionToSave.sessionDuration,
        sessionToSave.sessionName
      );
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
        `${sessionToSave.sessionName} saved. Another tab closed it meanwhile, so a new session is open here.`,
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    } else {
      toast.success(`${sessionToSave.sessionName} saved${leftOut}`);
    }
    return saved.id;
  };

  /**
   * Guest save: the session goes to this browser's storage only. Returns
   * the id it was stored under. `leftOut` ends its toast (see
   * `completeSessionNow`).
   */
  const saveToBrowser = (sessionName: string, leftOut = ''): string => {
    const sessionToSave = buildSessionToSave(sessionName);
    const guestSession = {
      ...sessionToSave,
      season: CURRENT_SEASON,
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: sessionDateOf(sessionToSave.matches).toISOString(),
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

    finishSavedSession(
      guestSession.id,
      sessionToSave.sessionDuration,
      sessionName
    );
    toast.success(`${sessionName} saved in this browser${leftOut}`);

    if (
      !guestStorageWarned &&
      localStorageUsage() > GUEST_STORAGE_QUOTA * GUEST_STORAGE_WARN_RATIO
    ) {
      guestStorageWarned = true;
      toast.warning(
        'This browser is almost out of space. Sign in or delete old sessions to keep saving.',
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    }
    return guestSession.id;
  };

  /**
   * Save the session as it stands, under its name. Complete Session goes on
   * to its Analysis (`openAnalysis`); finishing an old session to start a
   * new one, or completing it before signing out (`onSaved`), stays put.
   * Either way the page is on a fresh session once it is saved. The checks
   * are the caller's (see `canCompleteSession`). `leftOut`: the number of a
   * match that was on and is not in it, for the toast to say so.
   */
  const completeSessionNow = async ({
    openAnalysis,
    onSaved,
    leftOut,
  }: {
    openAnalysis: boolean;
    onSaved?: () => void;
    leftOut?: number | null;
  }) => {
    // A second press while the first save is still in flight saves nothing.
    if (completingRef.current) return;
    const sessionName = sessionData.sessionName?.trim() ?? '';
    // One kept from an older build without a name gets one first.
    if (!sessionName) {
      setShowRenameDialog(true);
      return;
    }
    if (matchActive || !sessionData.matches?.length) return;

    completingRef.current = true;
    setIsCompleting(true);
    absorbDoubleTap();
    setPendingConfirm(null);

    const without = leftOut ? `, without the unfinished Match ${leftOut}` : '';
    let savedId: string | null = null;
    try {
      savedId = uid
        ? await saveToAccount(uid, sessionName, without)
        : saveToBrowser(sessionName, without);
    } catch (error) {
      if (!(error instanceof SaveTimeoutError)) {
        logger.error('Error saving session', error);
      }
      if (!uid) {
        toast.error(
          isQuotaError(error)
            ? 'This browser is out of space. Sign in or delete old sessions.'
            : "Couldn't save the session. Your matches are kept, try again."
        );
      } else {
        toast.error(saveErrorMessage(error));
      }
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
    }
    if (!savedId) return;
    onSaved?.();
    if (openAnalysis && mountedRef.current) {
      navigate(`${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(savedId)}`);
    }
  };

  /**
   * "Finish it, start new", for a session left open since an earlier day:
   * it is saved as it stands and a fresh session takes its place, without
   * leaving the page. A match left unsaved in it that reached its buzzer
   * with points is part of it, as Save Match would have made it, dated when
   * it was played. One stopped part way through is not a match: it goes,
   * and the toast says so. With no saved match there is nothing to save,
   * and it is discarded, with its Undo.
   */
  const handleFinishAndStartNew = () => {
    if (isRepeatedPrimaryAction()) return;
    if (isInWalkthrough('complete the session') || completingRef.current)
      return;
    if (savedMatchCount === 0) {
      handleDiscardSession();
      return;
    }
    if (editingMatchId) returnToCurrentMatch();
    let leftOut: number | null = null;
    if (matchActive) {
      const kept = matchEnded && hasUnsavedMatchData && !editingMatchId;
      if (!matchEnded && hasUnsavedMatchData) leftOut = matchNumber;
      updateSessionData({
        ...(kept && {
          matches: [
            ...(sessionData.matches ?? []),
            runningMatchAsSaved(lastActivityAt ?? Date.now()),
          ],
        }),
        ...emptyScoringFields(),
      });
      resetTimer();
      setMatchActive(false);
      setIsTimerRunning(false);
    }
    // Once that has been applied: the save goes by the session as it stands.
    setTimeout(() => {
      if (mountedRef.current) {
        void completeNowRef.current({ openAnalysis: false, leftOut });
      }
    }, 0);
  };

  /** The latest `completeSessionNow`, for a call made after a render */
  const completeNowRef = useRef(completeSessionNow);
  useEffect(() => {
    completeNowRef.current = completeSessionNow;
  });

  // "Complete session" from the sign-out question: picked up as the page
  // opens, or at once if it is open.
  const completeRequestRef = useRef<(request: CompleteRequest) => void>(
    () => {}
  );
  useEffect(() => {
    completeRequestRef.current = request => {
      if (!canCompleteSession()) return;
      void completeSessionNow({
        openAnalysis: false,
        onSaved: request.onSaved,
      });
    };
  });
  useEffect(() => {
    const take = () => {
      const request = takeCompleteRequest();
      if (request) completeRequestRef.current(request);
    };
    take();
    return onCompleteRequest(take);
  }, []);

  // A save this browser started and lost track of (the page was reloaded or
  // closed while it was on its way) may have landed: if the session it
  // wrote is there, it is this one, finished, and the page moves on.
  const pendingCheckedRef = useRef(false);
  useEffect(() => {
    if (!uid || pendingCheckedRef.current) return;
    pendingCheckedRef.current = true;
    const note = readPendingSaveNote();
    const matches = sessionData.matches ?? [];
    if (
      !note ||
      note.uid !== uid ||
      sessionData.isSessionCompleted ||
      matchActive ||
      !note.matchIds.some(id => matches.some(match => match.id === id))
    ) {
      return;
    }
    const epoch = sessionEpoch;
    void firebaseService.getSession(note.id).then(stored => {
      const current = sessionDataRef.current;
      const ids = (current.matches ?? []).map(match => match.id);
      const storedIds = (stored?.matches ?? []).map(match => match.id);
      if (
        !stored ||
        !mountedRef.current ||
        sessionEpochRef.current !== epoch ||
        matchActiveRef.current ||
        completingRef.current ||
        ids.length !== storedIds.length ||
        ids.some(id => !storedIds.includes(id))
      ) {
        return;
      }
      if (editingMatchIdRef.current) returnToCurrentMatch();
      finishSavedSession(
        note.id,
        stored.sessionDuration ?? '',
        stored.sessionName || current.sessionName
      );
      toast.success(`${stored.sessionName || current.sessionName} saved`, {
        action: {
          label: 'View',
          onClick: () =>
            navigate(
              `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(note.id)}`
            ),
        },
      });
    });
    // Once, as the page opens with the account known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // A new session is numbered past the account's own saved sessions: read
  // their names once per page load while one is about to be named.
  const freshSession = !hasStarted && !matchActive && savedMatchCount === 0;
  useEffect(() => {
    if (!uid || !freshSession || namesReadFor.has(uid) || !navigator.onLine) {
      return;
    }
    namesReadFor.add(uid);
    firebaseService
      .getUserSessions(uid)
      .then(sessions =>
        rememberSessionNames(
          uid,
          sessions
            .filter(session => session.userId === uid)
            .map(session => session.sessionName ?? '')
        )
      )
      // Offline or refused: numbered from what this browser remembers.
      .catch(() => namesReadFor.delete(uid));
  }, [uid, freshSession]);

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
    // The rows below move up to where the trash button was.
    absorbDoubleTap();
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

  // Escape answers the open question with its safe choice.
  useEscapeKey(pendingConfirm !== null, () => setPendingConfirm(null));

  /**
   * The X beside the match controls: the match goes at once, with an Undo
   * that brings it back where the field is now.
   */
  const handleDiscardMatch = () => {
    if (!matchActive || editingMatchId) return;
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

  /**
   * When the session was last used, in epoch ms: its newest saved match, or
   * the session or a match being started. Null for a session not started.
   */
  const lastActivityAt = useMemo(() => {
    if (!hasStarted && (sessionData.matches?.length ?? 0) === 0) return null;
    const readTime = (key: string) => {
      try {
        return Number(localStorage.getItem(key)) || 0;
      } catch {
        return 0;
      }
    };
    const times = [
      ...(sessionData.matches ?? []).map(match =>
        match.createdAt ? toDate(match.createdAt).getTime() || 0 : 0
      ),
      readTime(STORAGE_KEYS.SESSION_START_TIME),
      matchActive ? readTime(STORAGE_KEYS.MATCH_START_TIME) : 0,
    ];
    return Math.max(...times) || null;
  }, [hasStarted, matchActive, sessionData.matches]);

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
    skipToFlowers,
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
    showRenameDialog,
    setShowRenameDialog,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,
    /** "Save Match 3 first" / "Finish Match 3 first", while a match is on */
    matchFirstMessage,
    lastActivityAt,

    handleDiscardSession,
    handleStartMatch,
    handleEndEarly,
    handleSaveMatch,
    handleRequestCompleteSession,
    handleConfirmCompleteWithStray,
    handleFinishAndStartNew,
    handleDeleteMatch,
    handleDiscardMatch,
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
