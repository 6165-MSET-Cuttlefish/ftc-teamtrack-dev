import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useSession, useTheme, useAuth, useTeam } from '@/contexts';
import { useEscapeKey, useFirebase } from '@/hooks';
import { GAME_TIMING, ROUTES, STORAGE_KEYS, UI_TIMING } from '@/constants';
import {
  calculateScore,
  emptyScoringFields,
  generateId,
  pickScoringFields,
} from '@/lib';
import type { Match } from '@/types';

export interface LiveControlsProps {
  onOpenSessionSetup?: () => void;
  onTryStartWithoutSetup?: () => void;
  isSessionSetupSaved?: boolean;
  onSessionReset?: () => void;
}

export const useLiveControlsState = ({
  onOpenSessionSetup,
  onTryStartWithoutSetup,
  isSessionSetupSaved = false,
  onSessionReset,
}: LiveControlsProps) => {
  const {
    sessionData,
    completeSession,
    timer,
    sessionTimer,
    isTimerRunning,
    setIsTimerRunning,
    formatTime,
    resetSession,
    resetTimer,
    setExpandedSection,
    updateSessionData,
    hasStarted,
    setHasStarted,
    showTeleopTransition,
    setShowTeleopTransition,
    setHasTransitionedToTeleop,
    matchPhase,
    setMatchPhase,
    setPhaseTimer,
    editingMatchId,
    saveEditedMatch,
    startEditingMatch,
    returnToCurrentMatch,
    matchActive,
    setMatchActive,
    skipToTeleop,
  } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { team } = useTeam();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();

  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [cancelConfirm, setCancelConfirm] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cancelMatchConfirm, setCancelMatchConfirm] = useState<boolean>(false);
  const [newSessionConfirm, setNewSessionConfirm] = useState<boolean>(false);
  /** ID the completed session was saved under, so analysis can open (and share) it */
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  /** Whether the match clock was running when Cancel Session was pressed */
  const [resumeAfterCancel, setResumeAfterCancel] = useState<boolean>(false);
  const [showSaveSessionDialog, setShowSaveSessionDialog] =
    useState<boolean>(false);
  const [, setPendingEditMatch] = useState<Match | null>(null);
  const [showUnsavedEditWarning, setShowUnsavedEditWarning] =
    useState<boolean>(false);
  const preMatchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest session data, for undo callbacks that fire after later edits */
  const sessionDataRef = useRef(sessionData);
  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  useEffect(() => {
    const ref = preMatchDelayRef;
    return () => {
      if (ref.current) {
        clearTimeout(ref.current);
      }
    };
  }, []);

  /** Points entered for the current, not-yet-saved match */
  const currentMatchScore = calculateScore(sessionData);
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

  useEffect(() => {
    const checkSessionLimit = async () => {
      if (user?.uid && !sessionData.isSessionCompleted) {
        const { firebaseService } = await import('@/services/firebaseService');
        const { SESSION_LIMITS } = await import('@/constants');

        const sessions = team
          ? await firebaseService.getTeamSessions(team.id)
          : await firebaseService.getUserSessions(user.uid);

        const sessionLimit = team
          ? SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5
          : SESSION_LIMITS.MAX_SESSIONS_PER_USER;

        if (sessions.length >= sessionLimit) {
          setSessionLimitReached(true);
          toast.error(
            `You've reached the maximum of ${sessionLimit} sessions. Please delete old sessions before creating new ones.`,
            {
              duration: 10000,
            }
          );
        } else {
          setSessionLimitReached(false);
        }
      }
    };

    checkSessionLimit();
  }, [user?.uid, sessionData.isSessionCompleted, team]);

  // FTC phase transition: autonomous → controller pickup (only for Full Game)
  // For Autonomous mode: no transition, timer just counts down to 0
  // For Teleop mode: starts in teleop phase, no transition needed
  useEffect(() => {
    if (
      sessionData.matchType === 'Full Game' &&
      timer === GAME_TIMING.AUTON_END_REMAINING && // 120 seconds remaining = end of autonomous
      isTimerRunning &&
      matchPhase === 'auton'
    ) {
      setIsTimerRunning(false);
      setMatchPhase('controller_pickup');
      setPhaseTimer(GAME_TIMING.CONTROLLER_PICKUP_SECONDS);
    }
  }, [
    timer,
    isTimerRunning,
    sessionData.matchType,
    matchPhase,
    setIsTimerRunning,
    setMatchPhase,
    setPhaseTimer,
  ]);

  const handleContinueToTeleop = () => {
    setShowTeleopTransition(false);
    setHasTransitionedToTeleop(true);
    setExpandedSection('Teleop Score');
    // Don't reset timer - continue from autonomous phase
    setIsTimerRunning(true);
  };

  const handleSkipTeleop = () => {
    setShowTeleopTransition(false);
    setHasTransitionedToTeleop(true);
    // Don't auto-start timer or change section
  };

  const handleViewAnalysis = () => {
    navigate(
      savedSessionId
        ? `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(savedSessionId)}`
        : ROUTES.ANALYSIS
    );
  };

  const handleNewSession = () => {
    if (
      sessionData.matches &&
      sessionData.matches.length > 0 &&
      !sessionData.isSessionCompleted
    ) {
      setNewSessionConfirm(true);
      return;
    }

    setSavedSessionId(null);
    resetSession();
    onSessionReset?.();
    setCancelConfirm(false);
    setNewSessionConfirm(false);
  };

  const handleConfirmNewSession = () => {
    setSavedSessionId(null);
    resetSession();
    onSessionReset?.();
    setCancelConfirm(false);
    setNewSessionConfirm(false);
  };

  /** First tap on Cancel Session: pause, and remember whether to resume. */
  const handleRequestCancelSession = () => {
    setResumeAfterCancel(isTimerRunning);
    if (isTimerRunning) setIsTimerRunning(false);
    setCancelConfirm(true);
  };

  /** Confirmed: discard everything and go straight back to a fresh setup. */
  const handleConfirmCancelSession = () => {
    resetSession();
    onSessionReset?.();
    setCancelConfirm(false);
    setResumeAfterCancel(false);
    toast.success('Session cancelled');
  };

  /** Backed out: only restart the clock if it was running before. */
  const handleKeepSession = () => {
    setCancelConfirm(false);
    if (resumeAfterCancel) setIsTimerRunning(true);
    setResumeAfterCancel(false);
  };

  /** Split out of the Start/Save button so both layouts share one code path */
  const handleStartMatch = () => {
    if (!isSessionSetupSaved && !sessionData.sessionName?.trim()) {
      onTryStartWithoutSetup?.();
      return;
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

  const handleSaveMatch = () => {
    if (!hasStarted) {
      toast.error('Please start the match timer before saving');
      return;
    }

    const scoring = pickScoringFields(sessionData);
    const breakdown = calculateScore(scoring);

    if (breakdown.earned === 0 && breakdown.penalties === 0) {
      toast.error('Please enter some scoring data before saving a match');
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

    resetTimer();
    // Keep hasStarted=true to maintain continuous sessionTimer
    setMatchActive(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleop(false);

    toast.success(`Match ${updatedMatches.length} saved successfully!`);
  };

  /**
   * Checks the session can be saved, then asks the user to confirm its name.
   * The save itself happens in handleCompleteSession once they confirm.
   */
  const handleRequestCompleteSession = () => {
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

    setShowSaveSessionDialog(true);
  };

  const handleCompleteSession = async (confirmedName: string) => {
    setShowSaveSessionDialog(false);
    updateSessionData({ sessionName: confirmedName });

    let userSessions: { sessionName?: string }[] = [];
    if (user?.uid) {
      const { firebaseService } = await import('@/services/firebaseService');
      const { SESSION_LIMITS } = await import('@/constants');

      const sessions = team
        ? await firebaseService.getTeamSessions(team.id)
        : await firebaseService.getUserSessions(user.uid);
      userSessions = sessions;

      const sessionLimit = team
        ? SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5
        : SESSION_LIMITS.MAX_SESSIONS_PER_USER;

      if (sessions.length >= sessionLimit) {
        toast.error(
          `You've reached the maximum of ${sessionLimit} sessions. Please delete old sessions before creating new ones.`
        );
        return;
      }
    } else {
      userSessions = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
      );
    }

    const totalSessionTime = formatTime(sessionTimer);
    setIsTimerRunning(false);

    let finalSessionName = confirmedName.trim();
    if (!finalSessionName) {
      const untitledSessions = userSessions.filter(s =>
        s.sessionName?.startsWith('Untitled Session #')
      );
      const numbers = untitledSessions
        .map(s => {
          const match = s.sessionName?.match(/Untitled Session #(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => !isNaN(n));
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      finalSessionName = `Untitled Session #${nextNumber}`;
    }

    const sessionToSave = {
      sessionName: finalSessionName,
      sessionType: sessionData.sessionType || 'Practice',
      matchType: sessionData.matchType || 'Full Game',
      sessionDuration: totalSessionTime,

      userId:
        user?.uid || localStorage.getItem('teamtrack-guest-id') || 'guest',
      userEmail: user?.email || '',
      ...(team ? { teamId: team.id } : {}),

      selectedFeature: sessionData.selectedFeature || '',
      notes: sessionData.notes || '',
      matches: sessionData.matches || [],

      completedAt: new Date().toISOString(),
    };

    try {
      if (user?.uid) {
        const result = await createSession(sessionToSave);
        if (result && result.id) {
          setSavedSessionId(result.id);
          completeSession(totalSessionTime);
          toast.success('Session saved successfully!');
        } else {
          toast.error('Failed to save session. Please try again.');
          setIsTimerRunning(false); // Keep timer stopped but don't clear data
          return;
        }
      } else {
        const existing = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
        );
        const guestSession = {
          ...sessionToSave,
          id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date().toISOString(),
        };
        existing.unshift(guestSession);
        setSavedSessionId(guestSession.id);
        localStorage.setItem(
          STORAGE_KEYS.GUEST_SESSIONS,
          JSON.stringify(existing)
        );
        completeSession(totalSessionTime);
        toast.success('Session saved locally!');
      }

      const { markSessionCompleted } = await import('@/lib/sessionPersistence');
      markSessionCompleted();
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving session', error);
      toast.error(
        'An error occurred while saving the session. Your data is preserved — please try again.'
      );
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    const before = sessionData.matches || [];
    const index = before.findIndex(m => m.id === matchId);
    if (index === -1) return;
    const deleted = before[index];

    const renumber = (matches: Match[]) =>
      matches.map((m, i) => ({ ...m, matchNumber: i + 1 }));

    updateSessionData({ matches: renumber(before.filter(m => m.id !== matchId)) });
    setDeleteConfirmId(null);
    toast.success(`Match ${deleted.matchNumber} deleted`, {
      duration: UI_TIMING.UNDO_WINDOW,
      action: {
        label: 'Undo',
        onClick: () => {
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
  useEscapeKey(showSaveSessionDialog && !loading, () =>
    setShowSaveSessionDialog(false)
  );

  const handleCancelCurrentMatch = () => {
    updateSessionData(emptyScoringFields());
    resetTimer();
    setHasStarted(false);
    setMatchActive(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleop(false);
    setCancelMatchConfirm(false);
    toast.success('Current match discarded');
  };

  return {
    sessionData,
    isDarkMode,
    loading,
    isTimerRunning,
    setIsTimerRunning,
    matchPhase,
    matchActive,
    hasStarted,
    editingMatchId,
    showTeleopTransition,
    startEditingMatch,
    saveEditedMatch,
    returnToCurrentMatch,
    skipToTeleop,
    resetSession,

    sessionLimitReached,
    cancelConfirm,
    setCancelConfirm,
    deleteConfirmId,
    setDeleteConfirmId,
    cancelMatchConfirm,
    setCancelMatchConfirm,
    newSessionConfirm,
    setNewSessionConfirm,
    showSaveSessionDialog,
    setShowSaveSessionDialog,
    setPendingEditMatch,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,

    isSessionSetupSaved,
    onOpenSessionSetup,
    onSessionReset,

    handleContinueToTeleop,
    handleSkipTeleop,
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
