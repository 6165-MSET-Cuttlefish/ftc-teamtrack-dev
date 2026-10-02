import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useSessionCore, useTheme, useAuth, useTeam } from '@/contexts';
import { useEscapeKey } from '@/hooks';
import {
  CURRENT_SEASON,
  ROUTES,
  SESSION_LIMITS,
  STORAGE_KEYS,
  UI_TIMING,
} from '@/constants';
import {
  calculateScore,
  emptyScoringFields,
  generateId,
  liveMatchType,
  logger,
  markSessionCompleted,
  normalizeForMatchType,
  pickScoringFields,
  readGuestSessions,
  sessionMatchType,
  writeGuestSessions,
} from '@/lib';
import { firebaseService, teamService } from '@/services';
import type { Match, Session, Team } from '@/types';
import { absorbDoubleTap, watchTaps } from './doubleTap';

export interface LiveControlsProps {
  onOpenSessionSetup?: () => void;
  onTryStartWithoutSetup?: () => void;
  isSessionSetupSaved?: boolean;
  onSessionReset?: () => void;
}

/** Shown by the banner, by Start and by Complete when the user is at the cap */
export const SESSION_LIMIT_MESSAGE = `You've reached the limit of ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} saved sessions. Delete some of your own old sessions to save new ones.`;

const UNREACHABLE_MESSAGE =
  "Can't reach the server - your matches are kept on this device, try again";
const RUNNING_MATCH_MESSAGE = 'Save or discard the running match first';
const SAVING_TOAST_ID = 'saving-session';
const WALKTHROUGH_TOAST_ID = 'walkthrough-open';

/** How long the whole signed-in save (checks + write) may take before giving up */
const SAVE_TIMEOUT_MS = 12000;
/** Taps on the Start/Save button closer together than this are one tap */
const PRIMARY_ACTION_DEBOUNCE_MS = 500;
const ZERO_MATCH_TOAST_ID = 'save-zero-point-match';

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
    sessionEpoch,
    isPickupPaused,
    setIsPickupPaused,
    isTutorialActive,
  } = useSessionCore();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { team, refreshTeam } = useTeam();
  const navigate = useNavigate();
  const uid = user?.uid;

  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [cancelConfirm, setCancelConfirm] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cancelMatchConfirm, setCancelMatchConfirm] = useState<boolean>(false);
  const [newSessionConfirm, setNewSessionConfirm] = useState<boolean>(false);
  /** ID the completed session was saved under, so analysis can open (and share) it */
  const [savedSessionId, setSavedSessionIdState] = useState<string | null>(
    () => (sessionData.isSessionCompleted ? lastSavedSessionId : null)
  );
  const setSavedSessionId = (id: string | null) => {
    lastSavedSessionId = id;
    setSavedSessionIdState(id);
  };
  /** Whether the match clock was running when Cancel Session was pressed */
  const [resumeAfterCancel, setResumeAfterCancel] = useState<boolean>(false);
  /** Whether Cancel Session froze the controller-pickup countdown */
  const pickupPausedByCancelRef = useRef(false);
  const [showSaveSessionDialog, setShowSaveSessionDialog] =
    useState<boolean>(false);
  const [showUnsavedEditWarning, setShowUnsavedEditWarning] =
    useState<boolean>(false);
  /** True from the moment a save is confirmed until it succeeds or fails */
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const completingRef = useRef(false);
  /**
   * When Start / Save Match / Save Changes / the session save last went
   * through, to absorb double taps. On the page's own clock
   * (performance.now()): the device clock can be set back, which would leave
   * these buttons dead until it caught up.
   */
  const lastPrimaryActionAt = useRef(-Infinity);
  /** Latest session data, for undo callbacks that fire after later edits */
  const sessionDataRef = useRef(sessionData);
  const matchActiveRef = useRef(matchActive);
  const tutorialActiveRef = useRef(isTutorialActive);
  useEffect(() => {
    sessionDataRef.current = sessionData;
    matchActiveRef.current = matchActive;
    tutorialActiveRef.current = isTutorialActive;
  }, [sessionData, matchActive, isTutorialActive]);
  /** "Match N deleted - Undo" toasts that may still restore their match */
  const undoToastIdsRef = useRef(new Set<string>());
  const zeroMatchToastOpenRef = useRef(false);
  const mountedRef = useRef(true);

  const dismissUndoToasts = () => {
    undoToastIdsRef.current.forEach(id => toast.dismiss(id));
    undoToastIdsRef.current.clear();
  };

  const dismissZeroMatchToast = () => {
    if (!zeroMatchToastOpenRef.current) return;
    zeroMatchToastOpenRef.current = false;
    toast.dismiss(ZERO_MATCH_TOAST_ID);
  };

  useEffect(() => {
    const undoToastIds = undoToastIdsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Their buttons act on this page's state, which is gone once it unmounts.
      undoToastIds.forEach(id => toast.dismiss(id));
      undoToastIds.clear();
      toast.dismiss(ZERO_MATCH_TOAST_ID);
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
    undoToastIdsRef.current.forEach(id => toast.dismiss(id));
    undoToastIdsRef.current.clear();
  }, [sessionEpoch, team]);

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

  const hasUnsavedWork =
    !sessionData.isSessionCompleted &&
    ((sessionData.matches && sessionData.matches.length > 0) ||
      hasUnsavedMatchData ||
      (sessionData.notes && sessionData.notes.trim().length > 0));

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedWork]);

  /**
   * Whether the signed-in user is at their session cap. Only their own
   * sessions count (team or not) — those are the only ones they can delete.
   */
  const limitCheckRef = useRef<{ uid: string; promise: Promise<void> } | null>(
    null
  );
  const refreshSessionLimit = useCallback((): Promise<void> => {
    if (!uid) {
      limitCheckRef.current = null;
      setSessionLimitReached(false);
      return Promise.resolve();
    }
    if (limitCheckRef.current?.uid === uid)
      return limitCheckRef.current.promise;

    const check = {
      uid,
      promise: firebaseService
        .countUserSessions(uid)
        .then(count => {
          if (limitCheckRef.current !== check) return;
          setSessionLimitReached(count >= SESSION_LIMITS.MAX_SESSIONS_PER_USER);
        })
        // Unknown (offline, …): leave the banner alone; saving re-checks.
        .catch(() => {})
        .finally(() => {
          if (limitCheckRef.current === check) limitCheckRef.current = null;
        }),
    };
    limitCheckRef.current = check;
    return check.promise;
  }, [uid]);

  // Checked on arrival, after a session is completed or reset, and whenever
  // the user comes back to the tab (they may have deleted sessions elsewhere).
  useEffect(() => {
    void refreshSessionLimit();
    const recheck = () => {
      if (document.visibilityState === 'visible') void refreshSessionLimit();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [refreshSessionLimit, sessionData.isSessionCompleted]);

  // Lets the presses below that change what is under the pointer shrug off
  // the second half of a double tap.
  useEffect(() => watchTaps(), []);

  /** True when this press is the tail of a double tap on the primary button. */
  const isRepeatedPrimaryAction = () =>
    performance.now() - lastPrimaryActionAt.current <
    PRIMARY_ACTION_DEBOUNCE_MS;

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

  /** Close the Cancel Session confirm without resuming anything. */
  const closeCancelConfirm = () => {
    setCancelConfirm(false);
    setResumeAfterCancel(false);
  };

  // However the Cancel Session confirm closes (kept, confirmed, match saved
  // or discarded, page left), let a frozen pickup run again.
  const setIsPickupPausedRef = useRef(setIsPickupPaused);
  useEffect(() => {
    setIsPickupPausedRef.current = setIsPickupPaused;
  }, [setIsPickupPaused]);
  useEffect(() => {
    if (!cancelConfirm && pickupPausedByCancelRef.current) {
      pickupPausedByCancelRef.current = false;
      setIsPickupPausedRef.current(false);
    }
  }, [cancelConfirm]);
  useEffect(
    () => () => {
      if (pickupPausedByCancelRef.current) {
        pickupPausedByCancelRef.current = false;
        setIsPickupPausedRef.current(false);
      }
    },
    []
  );

  /**
   * The walkthrough borrows the session for practice and puts back what it
   * found when it closes. Editing a logged match, and saving or discarding
   * the session, reach past what it can put back (which match the fields
   * belong to, the saved sessions, the stored copy a reload comes back to),
   * so they wait until it has closed.
   */
  const isInWalkthrough = (action: string) => {
    if (!isTutorialActive) return false;
    toast.info(`Close the walkthrough to ${action}`, {
      id: WALKTHROUGH_TOAST_ID,
    });
    return true;
  };

  const startFreshSession = () => {
    // The fresh session's Start Session can land where the pressed button
    // was: a double tap must not start its first match.
    absorbDoubleTap();
    dismissUndoToasts();
    dismissZeroMatchToast();
    setSavedSessionId(null);
    resetSession();
    onSessionReset?.();
    closeCancelConfirm();
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

  /** First tap on Cancel Session: pause, and remember whether to resume. */
  const handleRequestCancelSession = () => {
    if (isInWalkthrough('cancel the session')) return;
    setResumeAfterCancel(isTimerRunning);
    if (isTimerRunning) setIsTimerRunning(false);
    // The match clock is already stopped during pickup; freeze its countdown
    // too, or TELEOP starts while the confirm is still open. A pickup the
    // user paused themselves stays theirs to resume.
    if (matchActive && matchPhase === 'controller_pickup' && !isPickupPaused) {
      pickupPausedByCancelRef.current = true;
      setIsPickupPaused(true);
    }
    setCancelConfirm(true);
  };

  /** Confirmed: discard everything and go straight back to a fresh setup. */
  const handleConfirmCancelSession = () => {
    if (isInWalkthrough('cancel the session')) return;
    startFreshSession();
    toast.success('Session cancelled');
  };

  /**
   * Backed out: only restart the clock if it was running before, and the
   * match it belonged to is still being played.
   */
  const handleKeepSession = () => {
    if (
      resumeAfterCancel &&
      matchActive &&
      (matchPhase === 'auton' || matchPhase === 'teleop')
    ) {
      setIsTimerRunning(true);
    }
    closeCancelConfirm();
  };

  /**
   * While the session is being saved its matches must not change under the
   * save: what is stored and what the page shows would no longer agree. The
   * save dialog stays up over the page until the save settles; this covers
   * what can still be reached then (a toast's button, a key press).
   */
  const isSavingSession = () => {
    if (!completingRef.current) return false;
    toast.message('Saving the session - one moment', { id: SAVING_TOAST_ID });
    return true;
  };

  /** Split out of the Start/Save button so both layouts share one code path */
  const handleStartMatch = () => {
    if (matchActive || isRepeatedPrimaryAction() || isSavingSession()) return;
    if (!isSessionSetupSaved && !sessionData.sessionName?.trim()) {
      onTryStartWithoutSetup?.();
      return;
    }
    // Don't let a whole session be recorded that can't be saved afterwards.
    if (sessionLimitReached && !hasStarted && !sessionData.matches?.length) {
      toast.error(SESSION_LIMIT_MESSAGE);
      void refreshSessionLimit();
      return;
    }
    lastPrimaryActionAt.current = performance.now();
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

  /**
   * Log the running match. A match with nothing scored is a legitimate
   * result (a failed run), but is confirmed first in case it's a mis-tap.
   */
  const saveCurrentMatch = (confirmedScoreless: boolean) => {
    if (isRepeatedPrimaryAction()) return;
    if (!matchActive) {
      if (!confirmedScoreless) {
        toast.error('Please start the match timer before saving');
      }
      return;
    }

    const scoring = normalizeForMatchType(
      pickScoringFields(sessionData),
      sessionData.matchType
    );
    const breakdown = calculateScore(scoring);

    if (
      !confirmedScoreless &&
      breakdown.earned === 0 &&
      breakdown.penalties === 0
    ) {
      zeroMatchToastOpenRef.current = true;
      toast.message('No scoring entered - save as a 0-point match?', {
        id: ZERO_MATCH_TOAST_ID,
        duration: UI_TIMING.UNDO_WINDOW,
        action: {
          label: 'Save 0 pts',
          onClick: () => saveCurrentMatchRef.current(true),
        },
      });
      return;
    }

    const newMatch: Match = {
      ...scoring,
      id: generateId(),
      matchNumber: (sessionData.matches?.length || 0) + 1,
      matchType: sessionData.matchType,
      finalScore: breakdown.total,
      createdAt: new Date().toISOString(),
    };

    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
      ...emptyScoringFields(),
    });

    lastPrimaryActionAt.current = performance.now();
    resetTimer();
    // Keep hasStarted=true to maintain continuous sessionTimer
    setMatchActive(false);
    setIsTimerRunning(false);
    // The match a pending Cancel Session would have resumed is over.
    closeCancelConfirm();
    dismissZeroMatchToast();

    toast.success(`Match ${updatedMatches.length} saved successfully!`);
  };
  /** Latest version, for the confirm toast's button */
  const saveCurrentMatchRef = useRef(saveCurrentMatch);
  useEffect(() => {
    saveCurrentMatchRef.current = saveCurrentMatch;
  });

  // The 0-point confirm only makes sense for a running match with no score.
  useEffect(() => {
    if (!matchActive || hasUnsavedMatchData) {
      if (!zeroMatchToastOpenRef.current) return;
      zeroMatchToastOpenRef.current = false;
      toast.dismiss(ZERO_MATCH_TOAST_ID);
    }
  }, [matchActive, hasUnsavedMatchData]);

  const handleSaveMatch = () => saveCurrentMatch(false);

  /** Open a logged match for editing. */
  const handleStartEditingMatch = (match: Match) => {
    if (isSavingSession() || isInWalkthrough('edit a match')) return;
    startEditingMatch(match);
  };

  /**
   * Save Changes on a logged match; a double tap must not also start a match.
   * Returns false when nothing was saved: the press was the tail of a double
   * tap, or the session is being saved.
   */
  const handleSaveEditedMatch = (): boolean => {
    if (isRepeatedPrimaryAction() || isSavingSession()) return false;
    lastPrimaryActionAt.current = performance.now();
    // In the Match Log the editor closes onto the match's own row.
    absorbDoubleTap();
    saveEditedMatch();
    return true;
  };

  /**
   * Cancel on a logged match. Closing the editor puts Start Match, or in the
   * Match Log the match's own row, where Cancel was.
   */
  const handleCancelEditedMatch = () => {
    absorbDoubleTap();
    returnToCurrentMatch();
  };

  /**
   * Checks the session can be saved, then asks the user to confirm its name.
   * The save itself happens in handleCompleteSession once they confirm.
   */
  const handleRequestCompleteSession = () => {
    if (completingRef.current) return;
    if (isInWalkthrough('complete the session')) return;

    if (matchActive) {
      toast.error(RUNNING_MATCH_MESSAGE);
      return;
    }

    if (editingMatchId) {
      toast.error('Save or cancel your match edit first');
      return;
    }

    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error(
        'Please save at least one match before completing the session'
      );
      return;
    }

    if (hasUnsavedMatchData) {
      toast.error(
        'Please save the current match before completing the session, or reset the scoring fields'
      );
      return;
    }

    if (uid) {
      if (sessionLimitReached) {
        toast.error(SESSION_LIMIT_MESSAGE);
        void refreshSessionLimit();
        return;
      }

      const problem = sessionSaveProblem({
        notes: sessionData.notes,
        matches: sessionData.matches,
      });
      if (problem) {
        toast.error(problem, { duration: UI_TIMING.UNDO_WINDOW });
        return;
      }
    }

    // The dialog opens over this button: a second press would dismiss it.
    absorbDoubleTap();
    setShowSaveSessionDialog(true);
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
    notes?: string;
    matches?: Match[];
  }) =>
    JSON.stringify([
      session.sessionName || '',
      session.notes || '',
      session.matches || [],
    ]);

  /** The session is stored: show the completed screen. */
  const finishSavedSession = (id: string, duration: string) => {
    lastPrimaryActionAt.current = performance.now();
    dismissUndoToasts();
    setSavedSessionId(id);
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
      // Completed under the walkthrough, the session would be put back as in
      // progress when it closes, with this copy already saved.
      !tutorialActiveRef.current &&
      sessionContentKey(current) === pending.content;
    if (unchanged) {
      finishSavedSession(saved.id, pending.duration);
      toast.success('Session saved successfully!');
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

    const count = await withDeadline(
      firebaseService.countUserSessions(userId),
      deadline
    );
    const atLimit = count >= SESSION_LIMITS.MAX_SESSIONS_PER_USER;
    setSessionLimitReached(atLimit);
    if (atLimit) {
      toast.error(SESSION_LIMIT_MESSAGE);
      return false;
    }

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

    finishSavedSession(saved.id, sessionToSave.sessionDuration);
    if (savedAsPersonal && sessionTeam) {
      if (team) void refreshTeam();
      toast.warning(
        stillListed
          ? `Couldn't save to ${sessionTeam.name}; saved as a personal session`
          : `You are no longer in ${sessionTeam.name}; saved as a personal session`,
        { duration: UI_TIMING.UNDO_WINDOW }
      );
    } else {
      toast.success('Session saved successfully!');
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
    toast.success('Session saved locally!');

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
      toast.error(RUNNING_MATCH_MESSAGE);
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

    const renumber = (matches: Match[]) =>
      matches.map((m, i) => ({ ...m, matchNumber: i + 1 }));

    // Deleting the match that is open for editing closes the editor first,
    // so Save Changes isn't left pointing at a match that no longer exists.
    if (matchId === editingMatchId) {
      returnToCurrentMatch();
      setShowUnsavedEditWarning(false);
    }

    updateSessionData({
      matches: renumber(before.filter(m => m.id !== matchId)),
    });
    setDeleteConfirmId(null);

    const toastId = `undo-match-${matchId}`;
    const epochAtDelete = sessionEpoch;
    const undoToastIds = undoToastIdsRef.current;
    undoToastIds.add(toastId);
    toast.success(`Match ${deleted.matchNumber} deleted`, {
      id: toastId,
      duration: UI_TIMING.UNDO_WINDOW,
      onAutoClose: () => undoToastIds.delete(toastId),
      onDismiss: () => undoToastIds.delete(toastId),
      action: {
        label: 'Undo',
        onClick: event => {
          // Not under a save; the toast stays for when the save is done.
          if (isSavingSession()) {
            event.preventDefault();
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
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, deleted);
          updateSessionData({ matches: renumber(restored) });
        },
      },
    });
  };

  useEscapeKey(cancelConfirm, () => handleKeepSession());
  useEscapeKey(cancelMatchConfirm, () => setCancelMatchConfirm(false));
  useEscapeKey(deleteConfirmId !== null, () => setDeleteConfirmId(null));
  useEscapeKey(newSessionConfirm, () => setNewSessionConfirm(false));

  const handleCancelCurrentMatch = () => {
    updateSessionData(emptyScoringFields());
    resetTimer();
    // The session (and its clock) carries on if matches are already logged;
    // only an abandoned first match takes the session back to "not started".
    if (!sessionData.matches?.length) {
      setHasStarted(false);
    }
    setMatchActive(false);
    setIsTimerRunning(false);
    setCancelMatchConfirm(false);
    // The match a pending Cancel Session would have resumed is gone.
    closeCancelConfirm();
    dismissZeroMatchToast();
    toast.success('Current match discarded');
  };

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

    sessionLimitReached,
    cancelConfirm,
    deleteConfirmId,
    setDeleteConfirmId,
    cancelMatchConfirm,
    setCancelMatchConfirm,
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
    handleRequestCancelSession,
    handleConfirmCancelSession,
    handleKeepSession,
    handleStartMatch,
    handleSaveMatch,
    handleRequestCompleteSession,
    handleCompleteSession,
    handleDeleteMatch,
    handleCancelCurrentMatch,
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
