import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useTeam, useTheme } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { ROUTES, APP_CONFIG, STORAGE_KEYS } from '@/constants';
import { clearPendingInvite } from '@/lib/pendingInvite';
import { Users, Check, AlertCircle, Share2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { ShareSessionsPicker } from '@/components/team/ShareSessionsPicker';
import { toast } from 'sonner';
import type { Session } from '@/types';
import { logger } from '@/lib';
import { isArchived } from '@/lib/sessionFilters';

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count !== 1 ? 's' : ''}`;

/** An invite code no team has (any more): reset, or the team deleted */
const INVITE_GONE =
  'This invite link no longer works. Ask a teammate for a new one.';

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
  /** Asking whether to leave the current team for the invited one */
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  /** The card's title: it takes the focus when the card's buttons go */
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `Join team - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (inviteCode) {
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_CODE, inviteCode);
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY, String(Date.now() + 60 * 60 * 1000));
      }
      // In place of this page, so Back from sign-in leaves rather than
      // coming here to be sent straight back again
      navigate(ROUTES.LOGIN, { replace: true });
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
      setErrorMessage(
        'This link has no invite code. Ask a teammate to send the invite link again.'
      );
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
          setErrorMessage(INVITE_GONE);
        }
      } catch {
        setStatus('error');
        setErrorMessage(
          "Couldn't look up this team. Check your connection, then reload the page."
        );
      }
    };

    doLookup();
  }, [user, authLoading, inviteCode, navigate]);

  /**
   * Find the user's own sessions that no team has yet. Resolves with them,
   * or null when they couldn't be looked up.
   */
  const loadShareable = async (): Promise<Session[] | null> => {
    if (!user?.uid) return null;
    setLoadingShareable(true);
    try {
      const allSessions = await firebaseService.getUserSessions(user.uid);
      // Personal ones only: archived sessions are put away, and one filed
      // under a team the user has left stays with that team.
      const shareable = allSessions.filter(s => !s.teamId && !isArchived(s));
      setShareableSessions(shareable as Session[]);
      setSelectedSessionIds(new Set(shareable.map(s => s.id)));
      return shareable;
    } catch (err) {
      logger.warn('Could not fetch sessions to share', err instanceof Error ? { message: err.message } : undefined);
      return null;
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
        setErrorMessage(INVITE_GONE);
        return;
      }

      const joined = result.team;
      setTeamName(joined.name);
      setTeamId(joined.id);
      setTeamUnloaded(result.status === 'joined-unloaded');
      clearPendingInvite();
      // Still "Joining" while the user's own sessions are looked up: with
      // some to share, this page asks about them; with none (or none found)
      // there is nothing more to do here, and Sessions offers any it finds.
      const shareable = await loadShareable();
      if (shareable && shareable.length > 0) {
        setStatus('success');
        return;
      }
      toast.success(`Joined ${joined.name}`, {
        description:
          result.status === 'joined-unloaded'
            ? "The team couldn't be loaded yet. Reload the page if it doesn't show up."
            : undefined,
      });
      navigate(ROUTES.SESSIONS, { replace: true });
    } catch {
      setStatus('error');
      setErrorMessage(
        "Couldn't join the team. Check your connection, then reload the page."
      );
    }
  };

  /** Leave the invite (turned down, or nothing left to do) for the list */
  const goToSessions = () => {
    clearPendingInvite();
    // The invite is answered: Back from Sessions doesn't bring it up again
    navigate(ROUTES.SESSIONS, { replace: true });
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
        await loadShareable();
        return;
      }
      toast.success(`Shared ${plural(count, 'session')} with ${teamName}`);
      const left = (shareableSessions ?? []).filter(
        s => !selectedSessionIds.has(s.id)
      );
      // Shared, the step is done; asked again only about the ones left
      if (left.length === 0 && status === 'success') {
        goToSessions();
        return;
      }
      setShareableSessions(left);
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

  // Each step of the card replaces the buttons of the one before (and Share
  // is disabled while it runs): where focus fell to the page, the new
  // title takes it.
  useEffect(() => {
    if (sharing) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    headingRef.current?.focus();
  }, [view, sharing]);
  const alreadyMember = !!team && team.id === teamId;
  const currentTeam = team && team.id !== teamId ? team : null;
  /** What leaving the current team to take this invite would do to it */
  const leaveEffect =
    currentTeam && user?.uid
      ? teamService.leaveOutcome(currentTeam, user.uid)
      : null;

  /**
   * A card's one fill. Each button wearing it is also `data-page-primary`,
   * so the header's New Session steps back to an outline beside it.
   */
  const primaryButton = `bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`;
  /** The card is the page: its title is the page's h1 */
  const heading = `${PAGE_TITLE_CLASS} mb-2 text-balance focus:outline-none`;
  const hasShareable = !!shareableSessions && shareableSessions.length > 0;

  /**
   * Matches the team dialog's share step: same picker, same words. Asks the
   * question itself unless the page's title already does (`titleAsks`).
   */
  const sharePanel = (titleAsks = false) =>
    hasShareable && (
      <div className="mb-6 text-left">
        <p
          className={`text-sm mb-2 ${
            isDarkMode ? 'text-team-white-60' : 'text-gray-600'
          }`}
        >
          {!titleAsks && (
            <>
              Share your{' '}
              <strong>{plural(shareableSessions.length, 'session')}</strong>{' '}
              with <strong>{teamName}</strong>?{' '}
            </>
          )}
          Teammates see shared sessions with their notes, and they stay with the
          team if you leave.
        </p>
        <ShareSessionsPicker
          sessions={shareableSessions}
          selected={selectedSessionIds}
          onChange={setSelectedSessionIds}
          isDarkMode={isDarkMode}
        />
      </div>
    );

  /**
   * A card's buttons: side by side from `sm` up, the main one last; stacked
   * full width on a phone with the main one on top.
   */
  const buttonRow = 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-center';
  const rowButton = 'w-full sm:w-auto';

  /**
   * While there is sharing to do: Not now (to Sessions) and Share. Otherwise
   * one filled Go to Sessions. One filled button per card either way.
   */
  const finishButtons = (extra?: ReactNode) => (
    <div className={buttonRow}>
      {hasShareable ? (
        <>
          <Button
            onClick={goToSessions}
            variant="neutral"
            className={rowButton}
          >
            Not now
          </Button>
          <Button
            onClick={handleShare}
            disabled={sharing || selectedSessionIds.size === 0}
            data-page-primary
            className={`${rowButton} ${primaryButton}`}
          >
            {selectedSessionIds.size > 0 && <Share2 className="h-4 w-4" />}
            {sharing
              ? 'Sharing…'
              : selectedSessionIds.size === 0
                ? 'Select sessions to share'
                : `Share ${plural(selectedSessionIds.size, 'session')}`}
          </Button>
        </>
      ) : (
        <>
          {extra}
          <Button
            onClick={goToSessions}
            data-page-primary
            className={`${rowButton} ${primaryButton}`}
          >
            Go to Sessions
          </Button>
        </>
      )}
    </div>
  );

  /** What leaving the current team for this one does to it, in one sentence */
  const switchConsequence = !currentTeam
    ? ''
    : leaveEffect?.kind === 'deleted'
      ? `You're its only member, so ${currentTeam.name} and its invite link are deleted. You keep your sessions.`
      : leaveEffect?.kind === 'handed-over'
        ? `${leaveEffect.newOwner.displayName || leaveEffect.newOwner.email} becomes the owner of ${currentTeam.name}, and sessions you shared there stay with it.`
        : `Sessions you shared with ${currentTeam.name} stay with that team.`;

  return (
    // flex-1 under the header (main is a flex column), not a second screen
    // height; on a phone the card starts at the top instead of mid-screen.
    <div
      className={`flex-1 flex items-start sm:items-center justify-center px-4 py-6 ${
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
              <div className="h-8 w-8 border-[3px] border-team-blue border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              {view === 'joining'
                ? teamName
                  ? `Joining ${teamName}…`
                  : 'Joining team…'
                : 'Opening invite…'}
            </h1>
          </>
        )}

        {view === 'preview' && alreadyMember && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-team-blue" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              You're already in {teamName}
            </h1>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              This invite is for the team you're in, so there's nothing to
              join.
            </p>
            {sharePanel()}
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
            {finishButtons(
              shareableSessions === null && (
                <Button
                  onClick={() => loadShareable()}
                  disabled={loadingShareable}
                  variant="neutral"
                  className={rowButton}
                >
                  <Share2 className="h-4 w-4" />
                  {loadingShareable ? 'Loading…' : 'Share more sessions'}
                </Button>
              )
            )}
          </>
        )}

        {/* The same invite whether or not the user is in another team; in
            one, Join asks before taking them out of it. */}
        {view === 'preview' && !alreadyMember && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-team-blue" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Join {teamName}?
            </h1>
            <p className={`mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              You've been invited to join this team.
            </p>
            {/* Bullets hang outside the text (pl-9 = the box's own 16px plus
                20px for the marker), so wrapped lines line up with the first */}
            <ul
              className={`mb-6 text-sm text-left rounded-lg pl-9 pr-4 py-3 space-y-1.5 list-disc break-words ${
                isDarkMode
                  ? 'bg-team-blue/10 text-team-white-60'
                  : 'bg-team-blue/5 text-gray-600'
              }`}
            >
              <li>
                Sessions you record from now on are saved to this team and
                visible to teammates.
              </li>
              {currentTeam ? (
                <li>
                  You can be in one team at a time, so joining takes you out of{' '}
                  <strong>{currentTeam.name}</strong>.
                </li>
              ) : (
                <li>You can be in one team at a time.</li>
              )}
            </ul>
            <div className={buttonRow}>
              <Button
                onClick={goToSessions}
                variant="neutral"
                className={rowButton}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  currentTeam ? setConfirmSwitch(true) : handleJoin(false)
                }
                data-page-primary
                className={`${rowButton} ${primaryButton}`}
              >
                <Users className="h-4 w-4" />
                Join team
              </Button>
            </div>
          </>
        )}

        {view === 'success' && (
          <>
            {/* Smaller while there is sharing to do, so that the buttons
                stay in view under the list */}
            <div
              className={`mx-auto rounded-full bg-green-500/15 flex items-center justify-center ${
                hasShareable ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-6'
              }`}
            >
              <Check
                className={`text-green-500 ${hasShareable ? 'h-6 w-6' : 'h-8 w-8'}`}
              />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              {hasShareable
                ? `Share your sessions with ${teamName}?`
                : `You're in ${teamName}`}
            </h1>
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

            {sharePanel(true)}

            {finishButtons()}
          </>
        )}

        {view === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Couldn't join
            </h1>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              {errorMessage}
            </p>
            <div className={buttonRow}>
              <Button
                onClick={() => navigate(ROUTES.SESSIONS)}
                variant="neutral"
                className={rowButton}
              >
                Go to Sessions
              </Button>
            </div>
          </>
        )}
      </div>

      {currentTeam && (
        <ConfirmDialog
          open={confirmSwitch && view === 'preview'}
          onOpenChange={setConfirmSwitch}
          title={`Leave ${currentTeam.name} and join ${teamName}?`}
          description={switchConsequence}
          confirmLabel={
            leaveEffect?.kind === 'deleted'
              ? 'Delete team and join'
              : 'Leave and join'
          }
          // Only deleting a team loses anything; moving teams does not.
          tone={leaveEffect?.kind === 'deleted' ? 'destructive' : 'primary'}
          icon={LogOut}
          onConfirm={() => {
            setConfirmSwitch(false);
            void handleJoin(true);
          }}
        />
      )}
    </div>
  );
};

export default JoinTeam;
