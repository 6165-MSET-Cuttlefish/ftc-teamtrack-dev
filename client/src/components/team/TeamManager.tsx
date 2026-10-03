import { useState, useEffect, useId, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTeam, useTheme, useAuth } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { logger, copyToClipboard } from '@/lib';
import {
  OPEN_SHARE_SESSIONS_EVENT,
  OPEN_TEAM_DIALOG_EVENT,
  OPEN_TEAM_DIALOG_STATE,
} from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Link2,
  Copy,
  Check,
  RefreshCw,
  UserPlus,
  Crown,
  LogOut,
  Share2,
  CheckSquare,
  Square,
  UserMinus,
  Pencil,
  X,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Session, TeamMember } from '@/types';
import { sessionSummary } from './sessionSummary';

interface TeamManagerProps {
  onTeamChange?: () => void;
}

/** Longest team name the UI accepts, for both create and rename. */
const MAX_TEAM_NAME_LENGTH = 50;

/**
 * How long a confirm view ignores its action button after appearing, so the
 * second tap of a double-tap can't confirm what the first one only asked for.
 */
const CONFIRM_GUARD_MS = 500;

/**
 * Something in the team dialog that is asked about before it happens. The
 * question replaces the dialog's body (see `confirmCopy`), away from the
 * control that raised it.
 */
type PendingAction =
  | { type: 'transfer' | 'remove'; member: TeamMember }
  | { type: 'leave' }
  | { type: 'resetInvite' };

/** The words of a confirm view. */
interface ConfirmCopy {
  question: string;
  consequence: string;
  /** Label of the button that goes ahead. */
  action: string;
  /** Shown in place of the label while it runs, for screen readers. */
  busy: string;
  destructive: boolean;
  icon: ReactNode;
}

const memberName = (member: TeamMember) => member.displayName || member.email;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count !== 1 ? 's' : ''}`;

const Spinner = ({ label }: { label: string }) => (
  <>
    <div
      aria-hidden="true"
      className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"
    />
    <span className="sr-only">{label}</span>
  </>
);

export const TeamManager = ({ onTeamChange }: TeamManagerProps) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    team,
    loading: teamLoading,
    createTeam,
    joinTeam,
    leaveTeam,
    regenerateInviteCode,
    refreshTeam,
    transferOwnership,
    kickMember,
    renameTeam,
  } = useTeam();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  /** The team whose dialog is open. A dialog never outlives its team. */
  const [teamDialogFor, setTeamDialogFor] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [acting, setActing] = useState(false);
  /** The dialog's height when a question replaced its body, kept while asking */
  const [confirmMinHeight, setConfirmMinHeight] = useState<number>();
  const confirmShownAt = useRef(0);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const teamBodyRef = useRef<HTMLDivElement>(null);
  const confirmTextId = useId();
  /** `data-focus-key` of the control to hand focus back to after a question */
  const returnFocusKey = useRef<string | null>(null);
  /** How far the team view was scrolled when a question took its place */
  const teamScrollTop = useRef(0);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  /** The team the share step is open for, as with `teamDialogFor`. */
  const [shareDialogFor, setShareDialogFor] = useState<string | null>(null);
  const [personalSessions, setPersonalSessions] = useState<Session[]>([]);
  /** The user has recorded sessions at all, shared or not */
  const [hasOwnSessions, setHasOwnSessions] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  /** The share step's list was already read for this team by `offerShare` */
  const sharePreloadedFor = useRef<string | null>(null);

  const teamId = team?.id;
  const showTeamInfo = !!teamId && teamDialogFor === teamId;
  const showShareDialog = !!teamId && shareDialogFor === teamId;

  /** Show the user's sessions that `forTeamId` doesn't have, all ticked. */
  const showShareable = (sessions: Session[], forTeamId: string) => {
    // Personal sessions and ones left behind in a team the user has left
    const shareable = sessions.filter(s => s.teamId !== forTeamId);
    setHasOwnSessions(sessions.length > 0);
    setPersonalSessions(shareable);
    setSelectedSessionIds(new Set(shareable.map(s => s.id)));
    return shareable;
  };

  useEffect(() => {
    if (!showShareDialog || !user?.uid || !teamId) return;
    if (sharePreloadedFor.current === teamId) {
      sharePreloadedFor.current = null;
      return;
    }

    const loadPersonalSessions = async () => {
      setLoadingPersonal(true);
      try {
        const sessions = await firebaseService.getUserSessions(user.uid);
        showShareable(sessions, teamId);
      } catch {
        toast.error('Failed to load your sessions');
      } finally {
        setLoadingPersonal(false);
      }
    };

    loadPersonalSessions();
  }, [showShareDialog, user?.uid, teamId]);

  /**
   * Right after creating or joining a team: whether to go on to the share
   * step, which is skipped when the user has nothing to share. When it
   * opens, its title names the team, so the caller needs no toast of its
   * own (on a phone that toast would sit on top of the title).
   */
  const shouldOfferShare = async (forTeamId: string) => {
    if (!user?.uid) return true;
    try {
      const sessions = await firebaseService.getUserSessions(user.uid);
      if (showShareable(sessions, forTeamId).length === 0) return false;
      sharePreloadedFor.current = forTeamId;
    } catch {
      // The share step reads the list again, and says so if it can't.
    }
    return true;
  };

  const toggleSession = (id: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSessionIds.size === personalSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(personalSessions.map(s => s.id)));
    }
  };

  const handleShareSessions = async () => {
    if (!team || selectedSessionIds.size === 0) return;

    const chosen = selectedSessionIds.size;
    setSharing(true);
    try {
      const count = await firebaseService.importSessionsToTeam(
        Array.from(selectedSessionIds),
        team.id
      );
      if (count === 0) {
        toast.error(
          `Couldn't share your sessions with ${team.name}. They stay private; try again.`
        );
        return;
      }
      if (count < chosen) {
        toast.warning(
          `Shared ${count} of ${plural(chosen, 'session')} with ${team.name}. The rest stay private; try again from the team panel.`
        );
      } else {
        toast.success(`Shared ${plural(count, 'session')} with ${team.name}`);
      }
      setShareDialogFor(null);
      onTeamChange?.();
    } catch {
      toast.error(
        `Couldn't share your sessions with ${team.name}. They stay private; try again.`
      );
    } finally {
      setSharing(false);
    }
  };

  const handleSkipShare = () => {
    setShareDialogFor(null);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const closeTeamDialog = () => {
    setTeamDialogFor(null);
    setPendingAction(null);
    returnFocusKey.current = null;
    handleCancelRename();
  };

  /** Open the share step for a team, from the team panel or the page. */
  const openShareDialog = (forTeamId: string) => {
    closeTeamDialog();
    setShareDialogFor(forTeamId);
  };

  /**
   * Open the team dialog. Membership is re-checked first: someone who has
   * been removed is told so (by TeamContext), not shown a dialog about a
   * team they can no longer read.
   */
  const openTeamDialog = async () => {
    const fresh = await refreshTeam();
    if (!fresh) return;
    setShareDialogFor(null);
    setPendingAction(null);
    setTeamDialogFor(fresh.id);
  };

  // The sessions list and the account menu open these dialogs from outside.
  const openTeamDialogRef = useRef(openTeamDialog);
  useEffect(() => {
    openTeamDialogRef.current = openTeamDialog;
  });
  useEffect(() => {
    if (!teamId) return;
    const onOpenShare = () => {
      setTeamDialogFor(null);
      setPendingAction(null);
      setShareDialogFor(teamId);
    };
    const onOpenTeam = () => void openTeamDialogRef.current();
    window.addEventListener(OPEN_SHARE_SESSIONS_EVENT, onOpenShare);
    window.addEventListener(OPEN_TEAM_DIALOG_EVENT, onOpenTeam);
    return () => {
      window.removeEventListener(OPEN_SHARE_SESSIONS_EVENT, onOpenShare);
      window.removeEventListener(OPEN_TEAM_DIALOG_EVENT, onOpenTeam);
    };
  }, [teamId]);

  // Sent here from another page to manage the team: open once it is known.
  const openRequested =
    (location.state as Partial<typeof OPEN_TEAM_DIALOG_STATE> | null)
      ?.openTeamDialog === true;
  useEffect(() => {
    if (!openRequested || teamLoading) return;
    // Asked once: a reload or Back doesn't open it again.
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null }
    );
    void openTeamDialogRef.current();
  }, [
    openRequested,
    teamLoading,
    navigate,
    location.pathname,
    location.search,
    location.hash,
  ]);

  const handleCreateTeam = async () => {
    const name = teamName.trim();
    if (!name) {
      toast.error('Please enter a team name');
      return;
    }
    if (name.length > MAX_TEAM_NAME_LENGTH) {
      toast.error(`Team names can be up to ${MAX_TEAM_NAME_LENGTH} characters`);
      return;
    }

    setCreating(true);
    try {
      const newTeam = await createTeam(name);
      if (newTeam) {
        onTeamChange?.();
        const offerShare = await shouldOfferShare(newTeam.id);
        setShowCreateDialog(false);
        setTeamName('');
        if (offerShare) setShareDialogFor(newTeam.id);
        else toast.success(`Team "${newTeam.name}" created!`);
      } else {
        toast.error('Failed to create team. Please try again.');
      }
    } catch (err) {
      // The raw error (often a bare Firestore permission message) goes to
      // the log; it means nothing to the person creating the team.
      logger.error('Create team error', err);
      toast.error('Failed to create team. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      setJoinError('Enter an invite code or link.');
      return;
    }

    setJoining(true);
    setJoinError('');
    try {
      const result = await joinTeam(inviteCode.trim().toUpperCase());
      if (result.status === 'invalid') {
        setJoinError("That code doesn't match a team. Check it and try again.");
      } else if (result.status === 'cancelled') {
        // Only reachable if a team turned up while this dialog was open.
        // Switching teams is asked about on the invite page, not here.
        setJoinError(
          `You're already in ${result.teamName}. Open the invite link to switch teams.`
        );
      } else {
        const joined = result.team;
        onTeamChange?.();
        const offerShare = await shouldOfferShare(joined.id);
        setShowJoinDialog(false);
        setInviteCode('');
        if (result.status === 'joined-unloaded') {
          toast.warning("Joined, but couldn't load the team. Reload the page to see it.");
        } else if (!offerShare) {
          toast.success(`Joined team "${joined.name}"!`);
        }
        if (offerShare) setShareDialogFor(joined.id);
      }
    } catch (err) {
      logger.error('Join team error', err);
      setJoinError(
        "Couldn't join the team. The code may be invalid or expired."
      );
    } finally {
      setJoining(false);
    }
  };

  const copyInviteLink = async (onCopied: (copied: boolean) => void) => {
    if (!team?.inviteCode) return;

    const inviteUrl = `${window.location.origin}/join/${team.inviteCode}`;
    try {
      await copyToClipboard(inviteUrl);
      onCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => onCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCopyInviteCode = async () => {
    if (!team?.inviteCode) return;

    try {
      await copyToClipboard(team.inviteCode);
      setCodeCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleStartRename = () => {
    setRenameValue(team?.name ?? '');
    setIsRenaming(true);
  };

  const handleRenameTeam = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === team?.name) {
      handleCancelRename();
      return;
    }

    setRenaming(true);
    try {
      const success = await renameTeam(trimmed);
      if (success) {
        toast.success(`Team renamed to "${trimmed}"`);
        setIsRenaming(false);
        setRenameValue('');
      } else {
        toast.error('Failed to rename team');
      }
    } catch {
      toast.error('Failed to rename team');
    } finally {
      setRenaming(false);
    }
  };

  // Same test the Firestore rules apply, so the UI never offers an owner
  // action the server would reject. On teams saved before `ownerId` existed
  // that is the member holding the 'owner' role, not whoever created it.
  const isOwner =
    !!team && !!user?.uid && teamService.ownerOf(team) === user.uid;

  /**
   * The question being asked, if it still makes sense: the member may have
   * left, or ownership moved, while it was on screen.
   */
  const activeAction = ((): PendingAction | null => {
    if (!team || !showTeamInfo || !pendingAction) return null;
    if (pendingAction.type === 'leave') return pendingAction;
    if (!isOwner) return null;
    if (pendingAction.type === 'resetInvite') return pendingAction;
    const member = team.members.find(
      m => m.userId === pendingAction.member.userId
    );
    return member ? { type: pendingAction.type, member } : null;
  })();
  const asking = activeAction !== null;

  /** Replace the dialog's body with a question about `action`. */
  const askFor = (action: PendingAction, focusKey: string) => {
    // The dialog keeps its size, so the answer buttons sit where its footer
    // was rather than under the control that was just pressed.
    const panel = teamBodyRef.current?.closest<HTMLElement>('[role="dialog"]');
    setConfirmMinHeight(
      panel ? Math.round(panel.getBoundingClientRect().height) : undefined
    );
    confirmShownAt.current = performance.now();
    returnFocusKey.current = focusKey;
    teamScrollTop.current = teamBodyRef.current?.scrollTop ?? 0;
    handleCancelRename();
    setPendingAction(action);
  };

  const backToTeam = () => setPendingAction(null);

  // Focus follows the view: to Cancel (the safe answer) when a question
  // appears, back to the control that raised it when the list returns.
  useEffect(() => {
    if (!showTeamInfo) return;
    if (asking) {
      confirmCancelRef.current?.focus();
      return;
    }
    const key = returnFocusKey.current;
    returnFocusKey.current = null;
    const panel = teamBodyRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!key || !panel || !teamBodyRef.current) return;
    // The list comes back where it was left, not scrolled to its top.
    teamBodyRef.current.scrollTop = teamScrollTop.current;
    // A removed member's row is gone: Done takes the focus instead.
    const target =
      Array.from(
        panel.querySelectorAll<HTMLElement>('[data-focus-key]')
      ).find(el => el.dataset.focusKey === key) ??
      panel.querySelector<HTMLElement>('[data-autofocus]');
    target?.focus();
  }, [asking, showTeamInfo]);

  /** What leaving would do to the team: said before, and after. */
  const leaveEffect =
    team && user?.uid ? teamService.leaveOutcome(team, user.uid) : null;

  const confirmCopy = ((): ConfirmCopy | null => {
    if (!team || !activeAction) return null;
    switch (activeAction.type) {
      case 'transfer':
        return {
          question: `Make ${memberName(activeAction.member)} the owner of ${team.name}?`,
          consequence:
            "You become a regular member and can't undo this yourself.",
          action: 'Make owner',
          busy: 'Changing owner',
          destructive: false,
          icon: <Crown className="h-6 w-6" />,
        };
      case 'remove':
        return {
          question: `Remove ${memberName(activeAction.member)} from ${team.name}?`,
          // Removing someone replaces the invite code in the same write.
          consequence:
            "They lose access to team sessions. The invite link changes too, so the old one can't let them back in.",
          action: 'Remove from team',
          busy: 'Removing member',
          destructive: true,
          icon: <UserMinus className="h-6 w-6" />,
        };
      case 'resetInvite':
        return {
          question: 'Reset the invite link?',
          consequence:
            'The current link and code stop working for everyone.',
          action: 'Reset invite link',
          busy: 'Resetting invite link',
          destructive: true,
          icon: <RefreshCw className="h-6 w-6" />,
        };
      case 'leave': {
        const shared = 'Sessions you shared stay with the team.';
        if (leaveEffect?.kind === 'deleted') {
          return {
            question: `Leave ${team.name}?`,
            consequence:
              "You're the only member. Leaving deletes the team and its invite link.",
            action: 'Delete team and leave',
            busy: 'Deleting team',
            destructive: true,
            icon: <LogOut className="h-6 w-6" />,
          };
        }
        return {
          question: `Leave ${team.name}?`,
          consequence:
            leaveEffect?.kind === 'handed-over'
              ? `You'll lose access to team sessions. ${shared} ${memberName(leaveEffect.newOwner)} will become the owner.`
              : `You'll lose access to team sessions. ${shared}`,
          action: 'Leave team',
          busy: 'Leaving team',
          destructive: true,
          icon: <LogOut className="h-6 w-6" />,
        };
      }
    }
  })();

  const handleConfirm = async () => {
    if (!team || !activeAction || acting) return;
    if (performance.now() - confirmShownAt.current < CONFIRM_GUARD_MS) return;

    setActing(true);
    try {
      switch (activeAction.type) {
        case 'transfer': {
          const name = memberName(activeAction.member);
          const success = await transferOwnership(activeAction.member.userId);
          if (!success) throw new Error('Transfer rejected');
          toast.success(`${name} is now the owner of ${team.name}`);
          backToTeam();
          break;
        }
        case 'remove': {
          const name = memberName(activeAction.member);
          const success = await kickMember(activeAction.member.userId);
          if (!success) throw new Error('Removal rejected');
          toast.success(`${name} was removed from ${team.name}`);
          // Removing someone replaces the invite code, so the link they had
          // can't let them back in.
          toast.info('Invite link changed. Share the new one to invite people.');
          backToTeam();
          break;
        }
        case 'resetInvite': {
          const newCode = await regenerateInviteCode();
          if (!newCode) throw new Error('Reset rejected');
          toast.success('Invite link reset. Share the new one to invite people.');
          backToTeam();
          break;
        }
        case 'leave': {
          const outcome = await leaveTeam();
          if (outcome?.kind === 'deleted') {
            toast.success(`${team.name} was deleted`);
          } else if (outcome?.kind === 'handed-over') {
            toast.success(
              `You left ${team.name}. ${memberName(outcome.newOwner)} is now the owner.`
            );
          } else {
            toast.success(`You left ${team.name}`);
          }
          onTeamChange?.();
          closeTeamDialog();
          break;
        }
      }
    } catch {
      const failed: Record<PendingAction['type'], string> = {
        transfer: "Couldn't change the owner. Please try again.",
        remove: "Couldn't remove that member. Please try again.",
        resetInvite: "Couldn't reset the invite link. Please try again.",
        leave: `Couldn't leave ${team.name}. Please try again.`,
      };
      toast.error(failed[activeAction.type]);
    } finally {
      setActing(false);
    }
  };

  const quietButton = isDarkMode
    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
    : 'border-gray-200 text-gray-600 hover:bg-gray-50';
  const primaryButton = `bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`;
  const pageButton = `flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm min-h-[40px] sm:min-h-[44px] [@media(pointer:coarse)]:min-h-11 ${
    isDarkMode
      ? 'border-team-blue-40 hover:border-team-blue text-team-blue bg-team-dark-20'
      : 'border-gray-200 hover:border-team-blue text-team-blue bg-white'
  }`;
  const fieldLabel = `block text-sm font-medium mb-2 ${
    isDarkMode ? 'text-team-white-60' : 'text-gray-700'
  }`;
  const hint = `text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`;
  const iconButton = `inline-flex items-center justify-center rounded-lg transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
    isDarkMode
      ? 'text-team-white-60 hover:text-team-blue hover:bg-team-dark'
      : 'text-gray-500 hover:text-team-blue hover:bg-gray-100'
  }`;

  // The team dialog's footer stays put while its body scrolls, and holds the
  // answer buttons of a question in the same two slots: Cancel lands where
  // Leave Team was, never the action that was just asked about. So unlike
  // the other dialogs' footers it stays a row on a phone too: stacked, the
  // two would swap places between the team and the question.
  const footer = `shrink-0 flex-row gap-3 px-5 border-t ${
    isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
  }`;
  // The buttons of the other dialogs' footers: full width when stacked on a
  // phone, and wide enough beside each other not to resize as a label changes.
  const footerButton = 'h-11 rounded-xl sm:min-w-[7.5rem]';

  const memberCount = team ? plural(team.members.length, 'member') : '';

  return (
    <>
      <div
        className={`flex items-center gap-2 max-w-full ${
          // In a team the pill gives way (its name truncates) so the row
          // stays on one line on a phone; the two buttons simply wrap.
          team ? 'min-w-0' : 'flex-wrap'
        } ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
      >
        {team ? (
          <>
            <button
              type="button"
              onClick={openTeamDialog}
              aria-label={`${team.name} · ${memberCount} · Manage team`}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer min-w-0 min-h-[40px] sm:min-h-[44px] [@media(pointer:coarse)]:min-h-11 ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark-20 text-white hover:border-team-blue'
                  : 'border-gray-200 bg-white text-team-blue hover:border-team-blue'
              }`}
            >
              <Users className="h-4 w-4 shrink-0 text-team-blue" />
              <span className="min-w-0 sm:max-w-[200px] truncate">{team.name}</span>
              {/* A phone has room for the name or the count, not both */}
              <span className={`hidden sm:inline text-xs whitespace-nowrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                · {memberCount}
              </span>
              <span className="text-xs whitespace-nowrap text-team-blue">· Manage</span>
            </button>

            <button
              type="button"
              onClick={() => copyInviteLink(setInviteCopied)}
              aria-label="Copy invite link"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm shrink-0 min-h-[40px] sm:min-h-[44px] [@media(pointer:coarse)]:min-h-11 ${
                inviteCopied
                  ? 'border-green-500 text-green-500'
                  : isDarkMode
                    ? 'border-team-blue-40 hover:border-team-blue text-team-blue'
                    : 'border-gray-200 hover:border-team-blue text-team-blue'
              }`}
            >
              {inviteCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Invite
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className={pageButton}
            >
              <Users className="h-4 w-4" />
              Create Team
            </button>
            <button
              type="button"
              onClick={() => {
                setJoinError('');
                setShowJoinDialog(true);
              }}
              className={pageButton}
            >
              <UserPlus className="h-4 w-4" />
              Join Team
            </button>
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent
          className={isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <Users className="h-5 w-5 text-team-blue" />
              Create a Team
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Teammates can see sessions you share. You pick which ones next.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pb-2">
            <div>
              <label htmlFor="team-create-name" className={fieldLabel}>
                Team Name
              </label>
              <Input
                id="team-create-name"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g., Robotics Team 1234"
                maxLength={MAX_TEAM_NAME_LENGTH}
                className={`h-12 rounded-xl ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                    : 'bg-gray-50 border-gray-200 text-team-blue placeholder-gray-400'
                }`}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateTeam();
                }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="pb-6">
            <Button
              onClick={() => setShowCreateDialog(false)}
              variant="outline"
              className={`${footerButton} ${quietButton}`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim()}
              className={`${footerButton} ${primaryButton}`}
            >
              {creating ? <Spinner label="Creating team" /> : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent
          className={isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <UserPlus className="h-5 w-5 text-team-blue" />
              Join a Team
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Enter the invite code or link shared by a team member. Sessions
              you record from now on are saved to the team and visible to
              teammates.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pb-2">
            <div>
              <label htmlFor="team-join-code" className={fieldLabel}>
                Invite Code / Link
              </label>
              <Input
                id="team-join-code"
                value={inviteCode}
                onChange={e => {
                  let val = e.target.value;
                  // If user pastes (or types) a join link, extract just the
                  // code. Case-insensitive: the field upper-cases as you type.
                  const joinMatch = val.match(/\/join\/([A-Za-z0-9]+)/i);
                  if (joinMatch) {
                    val = joinMatch[1];
                  }
                  setInviteCode(val.toUpperCase());
                  setJoinError('');
                }}
                placeholder="Code or invite link"
                aria-invalid={joinError ? true : undefined}
                aria-describedby={joinError ? 'team-join-error' : undefined}
                className={`h-12 rounded-xl text-center text-lg font-mono tracking-widest ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                    : 'bg-gray-50 border-gray-200 text-team-blue placeholder-gray-400'
                } ${joinError ? '!border-red-500' : ''}`}
                maxLength={64}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleJoinTeam();
                }}
                autoFocus
              />
              {joinError && (
                <p
                  id="team-join-error"
                  role="alert"
                  className={`text-sm mt-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}
                >
                  {joinError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pb-6">
            <Button
              onClick={() => setShowJoinDialog(false)}
              variant="outline"
              className={`${footerButton} ${quietButton}`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTeam}
              disabled={joining || !inviteCode.trim()}
              className={`${footerButton} ${primaryButton}`}
            >
              {joining ? <Spinner label="Joining team" /> : 'Join Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showTeamInfo}
        onOpenChange={open => {
          if (open || acting) return;
          // Backing out of a question returns to the team, one step at a time.
          if (asking) backToTeam();
          else closeTeamDialog();
        }}
      >
        <DialogContent
          className={`max-w-md flex flex-col max-h-[calc(100dvh-2rem)] ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
          style={asking && confirmMinHeight ? { minHeight: confirmMinHeight } : undefined}
        >
          <DialogHeader className={`shrink-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <Users className="h-5 w-5 shrink-0 text-team-blue" />
              <span className="min-w-0 break-words">{team?.name}</span>
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Manage your team and invite members.
            </DialogDescription>
          </DialogHeader>

          {confirmCopy ? (
            <>
              <div
                key="question"
                className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col"
              >
                {/* Centred with auto margins, not justify-center: when the
                    text is taller than a short screen it must scroll from
                    its top, not be cut off above it. */}
                <div
                  id={confirmTextId}
                  className="my-auto flex flex-col items-center text-center"
                >
                  <div
                    aria-hidden="true"
                    // A phone held sideways has room for the words only.
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 shrink-0 [@media(max-height:500px)]:hidden ${
                      confirmCopy.destructive
                        ? 'bg-red-500/15 text-red-500'
                        : 'bg-team-blue/15 text-team-blue'
                    }`}
                  >
                    {confirmCopy.icon}
                  </div>
                  <p
                    className={`text-lg font-semibold break-words max-w-full ${
                      isDarkMode ? 'text-white' : 'text-team-blue'
                    }`}
                  >
                    {confirmCopy.question}
                  </p>
                  <p
                    className={`text-sm mt-2 break-words max-w-full ${
                      isDarkMode ? 'text-team-white-60' : 'text-gray-600'
                    }`}
                  >
                    {confirmCopy.consequence}
                  </p>
                </div>
              </div>

              <DialogFooter className={footer}>
                <Button
                  ref={confirmCancelRef}
                  onClick={backToTeam}
                  disabled={acting}
                  variant="outline"
                  aria-describedby={confirmTextId}
                  className={`h-11 min-w-[7.75rem] rounded-xl ${quietButton}`}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={acting}
                  className={`flex-1 min-w-0 h-auto min-h-11 px-3 whitespace-normal rounded-xl ${
                    confirmCopy.destructive
                      ? 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50'
                      : primaryButton
                  }`}
                >
                  {acting ? <Spinner label={confirmCopy.busy} /> : confirmCopy.action}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div
                key="team"
                ref={teamBodyRef}
                className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
              >
                {isOwner && (
                  <div>
                    {isRenaming ? (
                      <label htmlFor="team-rename" className={fieldLabel}>
                        Team Name
                      </label>
                    ) : (
                      <span className={fieldLabel}>Team Name</span>
                    )}
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="team-rename"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          className={`flex-1 h-11 rounded-xl ${
                            isDarkMode
                              ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                              : 'bg-gray-50 border-gray-200 text-team-blue'
                          }`}
                          maxLength={MAX_TEAM_NAME_LENGTH}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameTeam();
                            if (e.key === 'Escape') {
                              // Only the rename is backed out of, not the dialog.
                              e.preventDefault();
                              handleCancelRename();
                            }
                          }}
                        />
                        <Button
                          onClick={handleRenameTeam}
                          disabled={renaming || !renameValue.trim()}
                          size="sm"
                          aria-label="Save team name"
                          className={`h-11 w-11 px-0 rounded-xl ${primaryButton}`}
                        >
                          {renaming ? (
                            <Spinner label="Saving team name" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          onClick={handleCancelRename}
                          size="sm"
                          variant="outline"
                          aria-label="Cancel rename"
                          className={`h-11 w-11 px-0 rounded-xl ${quietButton}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex-1 min-w-0 text-sm font-semibold break-words ${
                            isDarkMode ? 'text-white' : 'text-team-blue'
                          }`}
                        >
                          {team?.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleStartRename}
                          aria-label="Rename team"
                          className={`h-9 w-9 shrink-0 ${iconButton}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <span className={fieldLabel}>Invite Link</span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex-1 min-w-0 px-4 py-3 rounded-xl border font-mono text-sm truncate ${
                        isDarkMode
                          ? 'bg-team-dark-20 border-team-blue-40 text-white'
                          : 'bg-gray-50 border-gray-200 text-team-blue'
                      }`}
                    >
                      {team
                        ? `${window.location.origin}/join/${team.inviteCode}`
                        : ''}
                    </div>
                    <Button
                      onClick={() => copyInviteLink(setCopied)}
                      size="sm"
                      className={`h-11 px-3 rounded-xl text-sm shrink-0 ${primaryButton}`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy link
                        </>
                      )}
                    </Button>
                  </div>
                  <p className={`${hint} mt-2`}>
                    Share this link to invite others. All members can invite new people.
                  </p>
                </div>

                <div>
                  <span className={fieldLabel}>Invite Code</span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    aria-label={`Copy invite code ${team?.inviteCode ?? ''}`}
                    className={`w-full text-center py-3 rounded-xl border transition-colors ${
                      isDarkMode
                        ? 'bg-team-blue/10 border-team-blue-40 text-team-blue hover:border-team-blue'
                        : 'bg-team-blue/5 border-team-blue/20 text-team-blue hover:border-team-blue'
                    }`}
                  >
                    <span className="block text-2xl font-mono font-bold tracking-[0.3em] pl-[0.3em]">
                      {team?.inviteCode}
                    </span>
                    <span className={`flex items-center justify-center gap-1 mt-1 ${hint}`}>
                      {codeCopied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy code
                        </>
                      )}
                    </span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => askFor({ type: 'resetInvite' }, 'reset-invite')}
                      data-focus-key="reset-invite"
                      className={`mt-1 inline-flex items-center text-xs underline underline-offset-2 rounded [@media(pointer:coarse)]:min-h-11 ${
                        isDarkMode
                          ? 'text-team-white-60 hover:text-white'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Reset invite link
                    </button>
                  )}
                </div>

                <div>
                  <span className={fieldLabel}>
                    Members ({team?.members.length || 0})
                  </span>
                  <ul
                    aria-label="Team members"
                    className={`rounded-xl border overflow-hidden ${
                      isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
                    }`}
                  >
                    {team?.members.map((member, idx) => {
                      const name = memberName(member);
                      const focusKey = `member-${member.userId}`;
                      const canManage = isOwner && member.userId !== user?.uid;
                      return (
                        <li
                          key={member.userId}
                          className={`flex items-center gap-3 pl-4 py-2 min-h-[3.75rem] ${
                            canManage ? 'pr-2' : 'pr-4'
                          } ${
                            idx > 0
                              ? isDarkMode
                                ? 'border-t border-team-blue-40'
                                : 'border-t border-gray-100'
                              : ''
                          } ${
                            isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'
                          }`}
                        >
                          <div
                            aria-hidden="true"
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              member.role === 'owner'
                                ? 'bg-team-blue/20 text-team-blue'
                                : isDarkMode
                                  ? 'bg-team-dark text-team-white-60'
                                  : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {member.role === 'owner' ? (
                              <Crown className="h-4 w-4" />
                            ) : (
                              name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium break-words ${
                                isDarkMode ? 'text-white' : 'text-team-blue'
                              }`}
                            >
                              {name}
                              {member.userId === user?.uid && (
                                <span className="text-xs ml-2 opacity-60">(you)</span>
                              )}
                            </div>
                            {member.displayName && (
                              <div
                                className={`text-xs break-all ${
                                  isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                                }`}
                              >
                                {member.email}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                              member.role === 'owner'
                                ? 'bg-team-blue/15 text-team-blue'
                                : `hidden sm:inline ${
                                    isDarkMode
                                      ? 'bg-team-dark text-team-white-60'
                                      : 'bg-gray-100 text-gray-500'
                                  }`
                            }`}
                          >
                            {member.role === 'owner' ? 'Owner' : 'Member'}
                          </span>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Actions for ${name}`}
                                  data-focus-key={focusKey}
                                  className={`h-11 w-11 flex-shrink-0 inline-flex items-center justify-center rounded-lg transition-colors ${
                                    isDarkMode
                                      ? 'text-team-white-60 hover:text-team-blue hover:bg-team-dark'
                                      : 'text-gray-500 hover:text-team-blue hover:bg-gray-200'
                                  }`}
                                >
                                  <MoreVertical className="h-5 w-5" />
                                </button>
                              </DropdownMenuTrigger>
                              {/* Opens upwards: a menu hanging below the
                                  last row would put "Remove from team" over
                                  the footer, where the question's own
                                  button then appears. */}
                              <DropdownMenuContent side="top" align="end" className="min-w-[11rem]">
                                <DropdownMenuItem
                                  onSelect={() => askFor({ type: 'transfer', member }, focusKey)}
                                  className="gap-2 [@media(pointer:coarse)]:min-h-11"
                                >
                                  <Crown className="h-4 w-4" />
                                  Make owner
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => askFor({ type: 'remove', member }, focusKey)}
                                  className="gap-2 text-red-500 focus:text-red-500 [@media(pointer:coarse)]:min-h-11"
                                >
                                  <UserMinus className="h-4 w-4" />
                                  Remove from team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <Button
                    onClick={() => team && openShareDialog(team.id)}
                    variant="outline"
                    className={`w-full h-11 rounded-xl ${
                      isDarkMode
                        ? 'border-team-blue-40 text-team-blue hover:bg-team-dark-20'
                        : 'border-gray-200 text-team-blue hover:bg-gray-50'
                    }`}
                  >
                    <Share2 className="h-4 w-4" />
                    Share my sessions...
                  </Button>
                  <p className={`${hint} mt-2`}>
                    Pick sessions you recorded on your own to share with the
                    team. The rest stay private to you.
                  </p>
                </div>
              </div>

              <DialogFooter className={footer}>
                <Button
                  onClick={() => askFor({ type: 'leave' }, 'leave-team')}
                  data-focus-key="leave-team"
                  variant="outline"
                  className={`h-11 px-3 min-w-[7.75rem] rounded-xl ${
                    isDarkMode
                      ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                      : 'border-red-300 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                  Leave Team
                </Button>
                <Button
                  onClick={closeTeamDialog}
                  data-autofocus
                  className={`flex-1 h-11 rounded-xl ${primaryButton}`}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={(open) => { if (!open) handleSkipShare(); }}>
        <DialogContent
          className={`max-w-lg flex flex-col max-h-[calc(100dvh-2rem)] ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          <DialogHeader className={`shrink-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <Share2 className="h-5 w-5 shrink-0 text-team-blue" />
              <span className="min-w-0 break-words">Share sessions with {team?.name}</span>
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Teammates can view sessions you share, including notes. A
              session belongs to one team at a time and stays with it if you
              leave. You can share more later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-2 space-y-4">
            {loadingPersonal ? (
              <div className="flex items-center justify-center py-8" role="status">
                <div
                  aria-hidden="true"
                  className="h-6 w-6 border-2 border-team-blue border-t-transparent rounded-full animate-spin"
                />
                <span className="sr-only">Loading your sessions</span>
              </div>
            ) : personalSessions.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                <p>
                  {hasOwnSessions
                    ? `All your sessions are already shared with ${team?.name}.`
                    : "You haven't recorded any sessions yet."}
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedSessionIds.size === personalSessions.length}
                  onClick={toggleAll}
                  className={`flex items-center justify-start gap-2 text-sm font-medium w-full px-3 py-2 rounded-lg transition-colors [@media(pointer:coarse)]:min-h-11 ${
                    isDarkMode ? 'hover:bg-team-dark-20 text-team-white-60' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {selectedSessionIds.size === personalSessions.length ? (
                    <CheckSquare className="h-4 w-4 text-team-blue" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Select all ({plural(personalSessions.length, 'session')})
                </button>

                <div className={`rounded-xl border overflow-hidden ${
                  isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
                }`}>
                  {personalSessions.map((session, idx) => (
                    <button
                      key={session.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selectedSessionIds.has(session.id)}
                      onClick={() => toggleSession(session.id)}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                        idx > 0
                          ? isDarkMode ? 'border-t border-team-blue-40' : 'border-t border-gray-100'
                          : ''
                      } ${
                        selectedSessionIds.has(session.id)
                          ? isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
                          : isDarkMode ? 'bg-team-dark-20 hover:bg-team-dark' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {selectedSessionIds.has(session.id) ? (
                        <CheckSquare className="h-4 w-4 text-team-blue flex-shrink-0" />
                      ) : (
                        <Square className={`h-4 w-4 flex-shrink-0 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${
                          isDarkMode ? 'text-white' : 'text-team-blue'
                        }`}>
                          {session.sessionName || 'Untitled Session'}
                        </div>
                        <div className={`text-xs ${
                          isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                        }`}>
                          {sessionSummary(session)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className={hint}>
              Sessions you record from now on are saved to the team
              automatically.
            </p>
          </div>

          <DialogFooter className="shrink-0 pt-3 pb-6">
            {personalSessions.length > 0 && !loadingPersonal ? (
              <>
                <Button
                  onClick={handleSkipShare}
                  variant="outline"
                  className={`${footerButton} ${quietButton}`}
                >
                  Not now
                </Button>
                <Button
                  onClick={handleShareSessions}
                  disabled={sharing || selectedSessionIds.size === 0}
                  className={`${footerButton} ${primaryButton}`}
                >
                  {sharing ? (
                    <Spinner label="Sharing sessions" />
                  ) : selectedSessionIds.size === 0 ? (
                    'Select sessions to share'
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      Share {plural(selectedSessionIds.size, 'session')}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSkipShare}
                className={`${footerButton} ${primaryButton}`}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
