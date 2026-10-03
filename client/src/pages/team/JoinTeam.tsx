import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useTeam, useTheme } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { ROUTES, APP_CONFIG, STORAGE_KEYS } from '@/constants';
import { clearPendingInvite } from '@/lib/pendingInvite';
import {
  Users,
  Check,
  AlertCircle,
  Share2,
  CheckSquare,
  Square,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sessionSummary } from '@/components/team/sessionSummary';
import { toast } from 'sonner';
import type { Session } from '@/types';
import { logger } from '@/lib';

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count !== 1 ? 's' : ''}`;

const JoinTeam = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { team, loading: teamLoading, joinTeam } = useTeam();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const hasAttemptedLookup = useRef(false);
  const hasAttemptedLookupId = useRef<string | null>(null);

  const [status, setStatus] = useState<'loading' | 'preview' | 'joining' | 'success' | 'error'>('loading');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  /** Joined, but the team itself could not be read back yet */
  const [teamUnloaded, setTeamUnloaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Own sessions not in the team yet; null until they have been looked up */
  const [shareableSessions, setShareableSessions] = useState<Session[] | null>(null);
  const [loadingShareable, setLoadingShareable] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [resolvedCode, setResolvedCode] = useState<string>('');

  useEffect(() => {
    document.title = `Join Team - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (inviteCode) {
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_CODE, inviteCode);
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY, String(Date.now() + 60 * 60 * 1000));
      }
      navigate(ROUTES.LOGIN);
      return;
    }

    const pendingCode = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_CODE);
    const pendingExpiry = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
    if (pendingCode && pendingExpiry && Date.now() > Number(pendingExpiry)) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_CODE);
      localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
    }
    const codeToUse = inviteCode || (pendingExpiry && Date.now() <= Number(pendingExpiry) ? pendingCode : null);

    if (!codeToUse) {
      setStatus('error');
      setErrorMessage('No invite code provided');
      return;
    }

    if (hasAttemptedLookup.current && hasAttemptedLookupId.current === codeToUse) return;
    hasAttemptedLookup.current = true;
    hasAttemptedLookupId.current = codeToUse;
    setResolvedCode(codeToUse);

    const doLookup = async () => {
      setStatus('loading');
      try {
        const invite = await teamService.getInviteByCode(codeToUse);
        if (invite) {
          setTeamName(invite.teamName);
          setTeamId(invite.teamId);
          setStatus('preview');
        } else {
          clearPendingInvite();
          setStatus('error');
          setErrorMessage('Invalid invite code. Please check the link and try again.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Failed to look up team. The invite code may be invalid or expired.');
      }
    };

    doLookup();
  }, [user, authLoading, inviteCode, navigate]);

  /** Find the user's own sessions that `forTeamId` doesn't have yet. */
  const loadShareable = async (forTeamId: string) => {
    if (!user?.uid) return;
    setLoadingShareable(true);
    try {
      const allSessions = await firebaseService.getUserSessions(user.uid);
      const shareable = allSessions.filter(s => s.teamId !== forTeamId);
      setShareableSessions(shareable as Session[]);
      setSelectedSessionIds(new Set(shareable.map(s => s.id)));
    } catch (err) {
      logger.warn('Could not fetch sessions to share', err instanceof Error ? { message: err.message } : undefined);
    } finally {
      setLoadingShareable(false);
    }
  };

  /**
   * Join the invited team. `leaveCurrent` is passed once the user has agreed,
   * on this page, to leave the team they are in.
   */
  const handleJoin = async (leaveCurrent: boolean) => {
    if (!resolvedCode) return;
    setStatus('joining');
    try {
      const result = await joinTeam(resolvedCode, leaveCurrent);

      if (result.status === 'cancelled') {
        // A team they are in turned up after the invite was shown: back to
        // the invite, which now asks about leaving it.
        setStatus('preview');
        return;
      }

      if (result.status === 'invalid') {
        clearPendingInvite();
        setStatus('error');
        setErrorMessage('Invalid invite code. Please check the link and try again.');
        return;
      }

      const joined = result.team;
      setTeamName(joined.name);
      setTeamId(joined.id);
      setTeamUnloaded(result.status === 'joined-unloaded');
      setStatus('success');
      clearPendingInvite();
      await loadShareable(joined.id);
    } catch {
      setStatus('error');
      setErrorMessage('Failed to join team. The invite code may be invalid or expired.');
    }
  };

  /** Leave the invite (turned down, or nothing left to do) for the list */
  const goToSessions = () => {
    clearPendingInvite();
    navigate(ROUTES.SESSIONS);
  };

  const handleShare = async () => {
    if (!user?.uid || selectedSessionIds.size === 0) return;
    const chosen = selectedSessionIds.size;
    setSharing(true);
    try {
      const ids = Array.from(selectedSessionIds);
      const count = await firebaseService.importSessionsToTeam(ids, teamId);
      if (count < chosen) {
        // Which ones went through isn't known: look again.
        if (count > 0) {
          toast.warning(
            `Shared ${count} of ${plural(chosen, 'session')} with ${teamName}. The rest stay private; you can share them later from the team panel.`
          );
        } else {
          toast.error(
            "Couldn't share your sessions. They stay private; you can share them later from the team panel."
          );
        }
        await loadShareable(teamId);
        return;
      }
      toast.success(`Shared ${plural(count, 'session')} with ${teamName}`);
      setShareableSessions(prev =>
        (prev ?? []).filter(s => !selectedSessionIds.has(s.id))
      );
      setSelectedSessionIds(new Set());
    } catch {
      toast.error(
        "Couldn't share your sessions. They stay private; you can share them later from the team panel."
      );
    } finally {
      setSharing(false);
    }
  };

  // The invite is read against the team the user is in, so that is waited
  // for: the card differs for someone already in this team, or in another.
  const view = status === 'preview' && teamLoading ? 'loading' : status;
  const alreadyMember = !!team && team.id === teamId;
  const currentTeam = team && team.id !== teamId ? team : null;
  /** What leaving the current team to take this invite would do to it */
  const leaveEffect =
    currentTeam && user?.uid
      ? teamService.leaveOutcome(currentTeam, user.uid)
      : null;

  const quietButton = isDarkMode
    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark'
    : 'border-gray-200 text-gray-600 hover:bg-gray-50';
  const primaryButton = `bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`;
  const heading = `text-xl font-bold mb-2 break-words ${
    isDarkMode ? 'text-white' : 'text-team-blue'
  }`;
  const hasShareable = !!shareableSessions && shareableSessions.length > 0;

  const sharePanel = hasShareable && (
    <div
      className={`rounded-xl border p-4 mb-4 text-left ${
        isDarkMode
          ? 'bg-team-dark border-team-blue-40'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <p
        className={`text-sm mb-3 ${
          isDarkMode ? 'text-team-white-60' : 'text-gray-600'
        }`}
      >
        Share your <strong>{plural(shareableSessions.length, 'session')}</strong>{' '}
        with <strong>{teamName}</strong>? Teammates see them with notes, and
        they stay with the team if you leave. The rest stay private.
      </p>

      <button
        type="button"
        role="checkbox"
        aria-checked={selectedSessionIds.size === shareableSessions.length}
        onClick={() => {
          if (selectedSessionIds.size === shareableSessions.length) {
            setSelectedSessionIds(new Set());
          } else {
            setSelectedSessionIds(new Set(shareableSessions.map(s => s.id)));
          }
        }}
        className={`flex items-center justify-start gap-2 text-xs font-medium mb-2 [@media(pointer:coarse)]:min-h-11 ${
          isDarkMode ? 'text-team-blue-60 hover:text-team-blue' : 'text-team-blue hover:text-team-blue/80'
        }`}
      >
        {selectedSessionIds.size === shareableSessions.length ? (
          <CheckSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {selectedSessionIds.size === shareableSessions.length ? 'Deselect All' : 'Select All'}
      </button>

      {/* Short enough to keep "Go to Sessions" in view under the panel */}
      <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
        {shareableSessions.map(session => {
          const isSelected = selectedSessionIds.has(session.id);
          return (
            <button
              key={session.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => {
                setSelectedSessionIds(prev => {
                  const next = new Set(prev);
                  if (next.has(session.id)) {
                    next.delete(session.id);
                  } else {
                    next.add(session.id);
                  }
                  return next;
                });
              }}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isDarkMode
                  ? isSelected
                    ? 'bg-team-blue/15 text-white'
                    : 'text-team-white-60 hover:bg-team-dark-20'
                  : isSelected
                    ? 'bg-team-blue/10 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 shrink-0 text-team-blue" />
              ) : (
                <Square className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`} />
              )}
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {session.sessionName || 'Untitled Session'}
                </span>
                <span
                  className={`block truncate text-xs ${
                    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }`}
                >
                  {sessionSummary(session)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleShare}
        disabled={sharing || selectedSessionIds.size === 0}
        className={`w-full ${primaryButton}`}
      >
        {selectedSessionIds.size > 0 && <Share2 className="h-4 w-4" />}
        {sharing
          ? 'Sharing...'
          : selectedSessionIds.size === 0
            ? 'Select sessions to share'
            : `Share ${plural(selectedSessionIds.size, 'session')}`}
      </Button>
    </div>
  );

  /** One filled button per card: Sessions steps back while there is sharing to do */
  const sessionsButton = (
    <Button
      onClick={goToSessions}
      variant={hasShareable ? 'outline' : 'default'}
      className={hasShareable ? quietButton : primaryButton}
    >
      Go to Sessions
    </Button>
  );

  return (
    <div
      className={`min-h-[100dvh] flex items-center justify-center px-4 py-6 ${
        isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
      }`}
    >
      <div
        className={`max-w-md w-full rounded-2xl border shadow-xl p-6 sm:p-8 text-center ${
          isDarkMode
            ? 'bg-team-dark-20 border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        {(view === 'loading' || view === 'joining') && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <div className="h-8 w-8 border-3 border-team-blue border-t-transparent rounded-full animate-spin" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              {view === 'joining' ? 'Joining Team...' : 'Looking up team...'}
            </h2>
            <p className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              {view === 'joining' ? 'Please wait while we add you to the team.' : 'Verifying invite code...'}
            </p>
          </>
        )}

        {view === 'preview' && alreadyMember && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-team-blue" />
            </div>
            <h2 className={heading}>You're already in {teamName}</h2>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              This invite is for the team you're in, so there's nothing to
              join.
            </p>
            {sharePanel}
            {shareableSessions?.length === 0 && (
              <p
                role="status"
                className={`mb-6 text-sm rounded-lg px-3 py-2 ${
                  isDarkMode
                    ? 'bg-team-blue/10 text-team-white-60'
                    : 'bg-team-blue/5 text-gray-600'
                }`}
              >
                All your sessions are already shared with {teamName}.
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              {sessionsButton}
              {shareableSessions === null && (
                <Button
                  onClick={() => loadShareable(teamId)}
                  disabled={loadingShareable}
                  variant="outline"
                  className={quietButton}
                >
                  <Share2 className="h-4 w-4" />
                  {loadingShareable ? 'Loading...' : 'Share more sessions'}
                </Button>
              )}
            </div>
          </>
        )}

        {view === 'preview' && currentTeam && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-6">
              <TriangleAlert className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className={heading}>Join {teamName}?</h2>
            <p className={`mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              You can be in one team at a time.
            </p>
            <div
              className={`mb-6 text-sm text-left rounded-lg border px-4 py-3 space-y-2 break-words ${
                isDarkMode
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <p>
                You're in <strong>{currentTeam.name}</strong>. Joining{' '}
                <strong>{teamName}</strong> removes you from it; sessions you
                shared there stay with that team.
              </p>
              {leaveEffect?.kind === 'handed-over' && (
                <p>
                  You own {currentTeam.name}:{' '}
                  {leaveEffect.newOwner.displayName || leaveEffect.newOwner.email}{' '}
                  will become its owner.
                </p>
              )}
              {leaveEffect?.kind === 'deleted' && (
                <p>
                  You're the only member of {currentTeam.name}, so leaving
                  deletes that team and its invite link.
                </p>
              )}
              <p>
                Sessions you record from now on are saved to {teamName} and
                visible to teammates.
              </p>
            </div>
            {/* Stacked: both labels carry a team name and rarely fit side by side */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={goToSessions}
                variant="outline"
                className={`h-auto min-h-10 [@media(pointer:coarse)]:min-h-11 whitespace-normal ${quietButton}`}
              >
                Stay in {currentTeam.name}
              </Button>
              <Button
                onClick={() => handleJoin(true)}
                className={`h-auto min-h-10 [@media(pointer:coarse)]:min-h-11 whitespace-normal ${primaryButton}`}
              >
                Leave and join {teamName}
              </Button>
            </div>
          </>
        )}

        {view === 'preview' && !team && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-team-blue" />
            </div>
            <h2 className={heading}>Join {teamName}?</h2>
            <p className={`mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              You've been invited to join this team.
            </p>
            <ul
              className={`mb-6 text-sm text-left rounded-lg px-4 py-3 space-y-1.5 list-disc list-inside ${
                isDarkMode
                  ? 'bg-team-blue/10 text-team-white-60'
                  : 'bg-team-blue/5 text-gray-600'
              }`}
            >
              <li>
                Sessions you record from now on are saved to this team and
                visible to teammates.
              </li>
              <li>You can be in one team at a time.</li>
            </ul>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={goToSessions}
                variant="outline"
                className={quietButton}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleJoin(false)}
                className={primaryButton}
              >
                <Users className="h-4 w-4" />
                Join Team
              </Button>
            </div>
          </>
        )}

        {view === 'success' && (
          <>
            {/* Smaller while there is sharing to do, so that "Go to
                Sessions" stays in view under the list */}
            <div
              className={`mx-auto rounded-full bg-green-500/15 flex items-center justify-center ${
                hasShareable ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-6'
              }`}
            >
              <Check
                className={`text-green-500 ${hasShareable ? 'h-6 w-6' : 'h-8 w-8'}`}
              />
            </div>
            <h2 className={heading}>Welcome to {teamName}!</h2>
            <p
              className={`${hasShareable ? 'mb-4' : 'mb-6'} ${
                isDarkMode ? 'text-team-white-60' : 'text-gray-500'
              }`}
            >
              You've joined the team. Sessions you record from now on are
              saved to it.
            </p>
            {teamUnloaded && (
              <p
                role="status"
                className={`mb-6 text-sm rounded-lg px-3 py-2 ${
                  isDarkMode
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                Joined, but couldn't load the team. Reload the page if it
                doesn't show up.
              </p>
            )}

            {sharePanel}

            {sessionsButton}
          </>
        )}

        {view === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Unable to Join
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              {errorMessage}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={() => navigate(ROUTES.SESSIONS)}
                variant="outline"
                className={quietButton}
              >
                Go to Sessions
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinTeam;
