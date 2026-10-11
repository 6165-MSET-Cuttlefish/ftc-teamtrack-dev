import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTeam, useTheme, useAuth } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { logger, copyToClipboard } from '@/lib';
import { rememberTeamName } from '@/lib/knownTeams';
import {
  OPEN_SHARE_SESSIONS_EVENT,
  OPEN_TEAM_DIALOG_EVENT,
  OPEN_TEAM_DIALOG_STATE,
} from '@/constants';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { CHIP_BASE, CHIP_SIZES, chipTone } from '@/components/ui/tokens';
import { Input } from '@/components/ui/input';
import { isArchived } from '@/lib/sessionFilters';
import { cn } from '@/lib/utils';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  UserMinus,
  Pencil,
  X,
  MoreVertical,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Session, TeamMember } from '@/types';
import { ShareSessionsPicker } from './ShareSessionsPicker';

interface TeamManagerProps {
  onTeamChange?: () => void;
  /**
   * Sized like the page's own small outline buttons (Button variant
   * "neutral", size "sm") from `sm` up, as on Profile. Without it the row
   * matches the 44px actions of the Sessions page.
   */
  compact?: boolean;
}

/** Longest team name the UI accepts, for both create and rename. */
const MAX_TEAM_NAME_LENGTH = 50;

/**
 * Something in the team dialog that is asked about before it happens, in
 * the shared ConfirmDialog on top of the team dialog (see `confirmCopy`).
 */
type PendingAction =
  | { type: 'transfer' | 'remove'; member: TeamMember }
  | { type: 'leave' }
  | { type: 'resetInvite' };

/** The words of a question. */
interface ConfirmCopy {
  question: string;
  /** One sentence: what happens */
  consequence: string;
  /** Label of the button that goes ahead. */
  action: string;
  destructive: boolean;
  icon: LucideIcon;
}

const memberName = (member: TeamMember) => member.displayName || member.email;

/** The next step after a team change the server didn't take */
const TRY_AGAIN = 'Check your connection and try again.';

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

export const TeamManager = ({
  onTeamChange,
  compact = false,
}: TeamManagerProps) => {
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
  /**
   * A question chosen from a menu, asked once that menu has closed: while it
   * is closing it keeps focus to itself and would take it from the question,
   * and the question hands focus back to the menu's button when it closes.
   */
  const menuActionRef = useRef<PendingAction | null>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  /** The team the share step is open for, as with `teamDialogFor`. */
  const [shareDialogFor, setShareDialogFor] = useState<string | null>(null);
  const [personalSessions, setPersonalSessions] = useState<Session[]>([]);
  /** The user has recorded sessions at all, shared or not */
  const [hasOwnSessions, setHasOwnSessions] = useState(false);
  /** Some of them stay with another team (one the user has left) */
  const [ownInOtherTeam, setOwnInOtherTeam] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  /** The share step couldn't read the user's sessions */
  const [loadFailed, setLoadFailed] = useState(false);
  /** Bumped by the share step's Try again, to read the list again */
  const [loadAttempt, setLoadAttempt] = useState(0);
  /** The share step's list was already read for this team by `offerShare` */
  const sharePreloadedFor = useRef<string | null>(null);

  const teamId = team?.id;
  const showTeamInfo = !!teamId && teamDialogFor === teamId;
  const showShareDialog = !!teamId && shareDialogFor === teamId;

  // Kept for once the user has left: their sessions stay filed under the
  // team, and the lists still name it.
  const currentName = team?.name;
  useEffect(() => {
    if (teamId && currentName) rememberTeamName(teamId, currentName);
  }, [teamId, currentName]);

  /** Show the user's sessions that `forTeamId` doesn't have, all ticked. */
  const showShareable = (sessions: Session[], forTeamId: string) => {
    // Personal sessions only. One filed under a team the user has left
    // stays with that team; archived ones are put away. Neither is offered.
    const shareable = sessions.filter(s => !s.teamId && !isArchived(s));
    setLoadFailed(false);
    setHasOwnSessions(sessions.length > 0);
    setOwnInOtherTeam(sessions.some(s => !!s.teamId && s.teamId !== forTeamId));
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
      setLoadFailed(false);
      setLoadingPersonal(true);
      try {
        const sessions = await firebaseService.getUserSessions(user.uid);
        showShareable(sessions, teamId);
      } catch {
        // Nothing from an earlier load stays ticked behind the error
        setPersonalSessions([]);
        setSelectedSessionIds(new Set());
        setLoadFailed(true);
      } finally {
        setLoadingPersonal(false);
      }
    };

    loadPersonalSessions();
  }, [showShareDialog, user?.uid, teamId, loadAttempt]);

  // Try again gives way to the spinner, which takes its focus with it: once
  // the list (or the error) is back, focus its first control.
  const shareBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loadingPersonal || !showShareDialog) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    shareBodyRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [loadingPersonal, showShareDialog]);

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
      toast.error('Enter a team name');
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
        else toast.success(`Created ${newTeam.name}`);
      } else {
        toast.error("Couldn't create the team", { description: TRY_AGAIN });
      }
    } catch (err) {
      // The raw error (often a bare Firestore permission message) goes to
      // the log; it means nothing to the person creating the team.
      logger.error('Create team error', err);
      toast.error("Couldn't create the team", { description: TRY_AGAIN });
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
          toast.success(`Joined ${joined.name}`);
        }
        if (offerShare) setShareDialogFor(joined.id);
      }
    } catch (err) {
      logger.error('Join team error', err);
      setJoinError(`Couldn't join the team. ${TRY_AGAIN}`);
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
      toast.success('Invite link copied');
      setTimeout(() => onCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the invite link", {
        description: `This browser blocked copying. Share the code ${team.inviteCode} instead.`,
      });
    }
  };

  const handleCopyInviteCode = async () => {
    if (!team?.inviteCode) return;

    try {
      await copyToClipboard(team.inviteCode);
      setCodeCopied(true);
      toast.success('Invite code copied');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the invite code", {
        description: `This browser blocked copying. Type ${team.inviteCode} where you want to share it.`,
      });
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
        toast.error("Couldn't rename the team", { description: TRY_AGAIN });
      }
    } catch {
      toast.error("Couldn't rename the team", { description: TRY_AGAIN });
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

  /** Ask about `action` over the team dialog, which stays as it was below. */
  const askFor = (action: PendingAction) => {
    handleCancelRename();
    setPendingAction(action);
  };

  /** For a menu item: ask once its menu has closed (see `menuActionRef`). */
  const askAfterMenu = (action: PendingAction) => {
    menuActionRef.current = action;
  };
  const onMenuClosed = () => {
    const action = menuActionRef.current;
    menuActionRef.current = null;
    if (action) askFor(action);
  };

  /**
   * Back to the team dialog. The question hands focus back to the control
   * that raised it; when that is gone (the member removed, or no longer the
   * owner's to manage) Done takes it instead.
   */
  const backToTeam = () => {
    setPendingAction(null);
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) doneButtonRef.current?.focus();
    });
  };

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
          destructive: false,
          icon: Crown,
        };
      case 'remove':
        return {
          question: `Remove ${memberName(activeAction.member)} from ${team.name}?`,
          // Removing someone replaces the invite code in the same write.
          consequence:
            "They lose access to team sessions, and the invite link changes so the old one can't let them back in.",
          action: 'Remove from team',
          destructive: true,
          icon: UserMinus,
        };
      case 'resetInvite':
        return {
          question: 'Reset the invite link?',
          consequence:
            'The current link and code stop working for everyone.',
          action: 'Reset invite link',
          destructive: true,
          icon: RefreshCw,
        };
      case 'leave': {
        if (leaveEffect?.kind === 'deleted') {
          return {
            question: `Leave ${team.name}?`,
            consequence:
              "You're the only member, so leaving deletes the team and its invite link. You keep your sessions.",
            action: 'Delete team and leave',
            destructive: true,
            icon: LogOut,
          };
        }
        return {
          question: `Leave ${team.name}?`,
          consequence:
            leaveEffect?.kind === 'handed-over'
              ? `You lose access to team sessions, and ${memberName(leaveEffect.newOwner)} becomes the owner. The ones you shared stay with the team, view-only for you.`
              : 'You lose access to team sessions. The ones you shared stay with the team, view-only for you.',
          action: 'Leave team',
          destructive: true,
          icon: LogOut,
        };
      }
    }
  })();

  const handleConfirm = async () => {
    // The question's own button waits out a double tap (useArmedAfterOpen).
    if (!team || !activeAction || acting) return;

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
        transfer: "Couldn't change the owner",
        remove: "Couldn't remove that member",
        resetInvite: "Couldn't reset the invite link",
        leave: `Couldn't leave ${team.name}`,
      };
      toast.error(failed[activeAction.type], { description: TRY_AGAIN });
    } finally {
      setActing(false);
    }
  };

  const primaryButton = `bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`;
  /** The row on the page: Sessions' 44px actions, or Profile's small outline kit */
  const rowButton = compact
    ? cn(
        buttonVariants({ variant: 'neutral', size: 'sm' }),
        'gap-1.5 [@media(pointer:coarse)]:min-h-11'
      )
    : `flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm min-h-[40px] sm:min-h-[44px] [@media(pointer:coarse)]:min-h-11 ${
        isDarkMode
          ? 'border-team-blue-40 hover:border-team-blue text-team-blue bg-team-dark-20'
          : 'border-gray-200 hover:border-team-blue text-team-blue bg-white'
      }`;
  const fieldLabel = `block text-sm font-medium mb-2 ${
    isDarkMode ? 'text-team-white-60' : 'text-gray-700'
  }`;
  const titleText = isDarkMode ? 'text-white' : 'text-gray-900';
  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-500';
  const iconButton = `inline-flex items-center justify-center rounded-lg transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
    isDarkMode
      ? 'text-team-white-60 hover:text-team-blue hover:bg-team-dark-20'
      : 'text-gray-500 hover:text-team-blue hover:bg-gray-100'
  }`;
  /** A menu's button while its menu is open: tinted, so it is clear whose menu it is */
  const openTrigger =
    'data-[state=open]:bg-team-blue/15 data-[state=open]:text-team-blue';

  // The team dialog's footer stays put while its body scrolls, and stays a
  // row on a phone too. On a phone zoomed to 200% (195px) the two buttons
  // can't share a row, so they stack, Done on top as in other dialogs.
  const footer = 'shrink-0 flex-row gap-3 px-5 max-[279px]:flex-col-reverse';
  // The buttons of the other dialogs' footers: full width when stacked on a
  // phone, and wide enough beside each other not to resize as a label changes.
  // On a phone zoomed to 200% a long label ('Select sessions to share') wraps
  // rather than run past the button and the dialog's edge.
  const footerButton =
    'h-11 rounded-xl sm:min-w-[7.5rem] max-[279px]:h-auto max-[279px]:min-h-11 max-[279px]:whitespace-normal';

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
              // Starts with what it shows, so it can be said by name
              aria-label={`${team.name} (${memberCount}), Manage team`}
              className={
                compact
                  ? cn(rowButton, 'min-w-0 justify-start')
                  : `flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer min-w-0 min-h-[40px] sm:min-h-[44px] [@media(pointer:coarse)]:min-h-11 ${
                      isDarkMode
                        ? 'border-team-blue-40 bg-team-dark-20 text-white hover:border-team-blue'
                        : 'border-gray-200 bg-white text-team-blue hover:border-team-blue'
                    }`
              }
            >
              <Users className="h-4 w-4 shrink-0 text-team-blue" />
              <span className="min-w-0 sm:max-w-[200px] truncate">{team.name}</span>
              {/* A phone has room for the name or the count, not both; the
                  name gets the room, with a chevron for "opens" */}
              <span
                className={`hidden sm:inline text-xs whitespace-nowrap ${muted}`}
              >
                ({memberCount})
              </span>
              <span className="hidden sm:inline ml-1 text-xs whitespace-nowrap text-team-blue">
                Manage
              </span>
              <ChevronRight
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 sm:hidden ${muted}`}
              />
            </button>

            <button
              type="button"
              onClick={() => copyInviteLink(setInviteCopied)}
              aria-label="Copy invite link"
              className={cn(
                rowButton,
                'shrink-0',
                inviteCopied &&
                  (isDarkMode
                    ? 'border-green-500 text-green-400'
                    : 'border-green-600 text-green-700')
              )}
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
              className={rowButton}
            >
              <Users className="h-4 w-4" />
              Create team
            </button>
            <button
              type="button"
              onClick={() => {
                setJoinError('');
                setShowJoinDialog(true);
              }}
              className={rowButton}
            >
              <UserPlus className="h-4 w-4" />
              Join team
            </button>
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent
          className={isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={titleText}>
              <Users className="h-5 w-5 text-team-blue" />
              Create a team
            </DialogTitle>
            <DialogDescription className={muted}>
              Teammates can see sessions you share. You pick which ones next.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pb-2">
            <div>
              <label htmlFor="team-create-name" className={fieldLabel}>
                Team name
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
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
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
              variant="neutral"
              className={footerButton}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim()}
              className={`${footerButton} ${primaryButton}`}
            >
              {creating ? <Spinner label="Creating team" /> : 'Create team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent
          className={isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={titleText}>
              <UserPlus className="h-5 w-5 text-team-blue" />
              Join a team
            </DialogTitle>
            <DialogDescription className={muted}>
              Enter the invite code or link shared by a team member. Sessions
              you record from now on are saved to the team and visible to
              teammates.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pb-2">
            <div>
              <label htmlFor="team-join-code" className={fieldLabel}>
                Invite code or link
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
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
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
              variant="neutral"
              className={footerButton}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTeam}
              disabled={joining || !inviteCode.trim()}
              className={`${footerButton} ${primaryButton}`}
            >
              {joining ? <Spinner label="Joining team" /> : 'Join team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showTeamInfo}
        onOpenChange={open => {
          // A question on top answers Escape and its backdrop itself.
          if (open || acting || activeAction) return;
          closeTeamDialog();
        }}
      >
        {/* At 200% zoom on a phone the stacked footer would leave the body a
            sliver, so there the whole dialog scrolls with the backdrop. */}
        <DialogContent
          className={`max-w-md flex flex-col max-h-[calc(100dvh-2rem)] max-[279px]:max-h-none ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          {/* The team's name once, as the title, renamed in place by its owner */}
          <DialogHeader className={`shrink-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
            <div className={isRenaming ? 'contents' : 'flex items-start gap-1'}>
              <DialogTitle
                className={`${titleText} ${isRenaming ? 'sr-only' : 'flex-1 min-w-0'}`}
              >
                {/* With the first line of a title that wraps */}
                <Users className="h-5 w-5 self-start mt-1 shrink-0 text-team-blue" />
                <span className="min-w-0 break-words">{team?.name}</span>
              </DialogTitle>
              {isOwner && !isRenaming && (
                <button
                  type="button"
                  onClick={handleStartRename}
                  aria-label="Rename team"
                  className={`h-9 w-9 -mr-2 shrink-0 ${iconButton}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            {isOwner && isRenaming && (
              <div className="flex items-center gap-2">
                <label htmlFor="team-rename" className="sr-only">
                  Team name
                </label>
                <Input
                  id="team-rename"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  className={`flex-1 h-11 rounded-xl text-base font-semibold ${
                    isDarkMode
                      ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
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
                  variant="neutral"
                  aria-label="Cancel rename"
                  className="h-11 w-11 px-0 rounded-xl"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            <section aria-labelledby="team-invite-heading">
              <div className="flex items-center justify-between gap-2 mb-2 min-h-9">
                <h3 id="team-invite-heading" className={EYEBROW_CLASS}>
                  Invite
                </h3>
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Invite link options"
                        className={`h-9 w-9 -mr-2 ${iconButton} ${openTrigger}`}
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[11rem]"
                      onCloseAutoFocus={onMenuClosed}
                    >
                      <DropdownMenuItem
                        onSelect={() => askAfterMenu({ type: 'resetInvite' })}
                        className="gap-2 [@media(pointer:coarse)]:min-h-11"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reset invite link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {/* The dialog's one filled button: inviting is what it is for */}
              <Button
                onClick={() => copyInviteLink(setCopied)}
                className={`w-full h-11 rounded-xl ${primaryButton}`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Invite link copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy invite link
                  </>
                )}
              </Button>
              <p className={`mt-1 text-sm text-center ${muted}`}>
                or share code{' '}
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  aria-label={`Copy invite code ${team?.inviteCode ?? ''}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 align-middle font-mono font-semibold tracking-wider transition-colors [@media(pointer:coarse)]:min-h-11 ${
                    isDarkMode
                      ? 'text-white hover:bg-team-dark-20'
                      : 'text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {team?.inviteCode}
                  {codeCopied ? (
                    <Check
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-green-500"
                    />
                  ) : (
                    <Copy
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 ${muted}`}
                    />
                  )}
                </button>
              </p>
            </section>

            <section aria-labelledby="team-members-heading">
              <h3 id="team-members-heading" className={`${EYEBROW_CLASS} mb-2`}>
                Members ({team?.members.length || 0})
              </h3>
              <ul
                aria-label="Team members"
                className={`rounded-xl border overflow-hidden divide-y ${
                  isDarkMode
                    ? 'border-team-blue-40 divide-team-blue-40'
                    : 'border-gray-200 divide-gray-100'
                }`}
              >
                {team?.members.map(member => {
                  const name = memberName(member);
                  const isYou = member.userId === user?.uid;
                  const canManage = isOwner && !isYou;
                  return (
                    <li
                      key={member.userId}
                      className={`flex items-center gap-3 pl-4 py-2 min-h-[3.75rem] transition-colors ${
                        canManage ? 'pr-2' : 'pr-4'
                      } ${
                        isDarkMode
                          ? 'bg-team-dark-20 has-[[data-state=open]]:bg-team-blue/10'
                          : 'bg-gray-50 has-[[data-state=open]]:bg-team-blue/10'
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          member.role === 'owner'
                            ? 'bg-team-blue/20 text-team-blue'
                            : isDarkMode
                              ? 'bg-team-white-10 text-white'
                              : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {member.role === 'owner' ? (
                          <Crown className="h-4 w-4" />
                        ) : (
                          name?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      {/* One line each: a long address is cut short, whole in its tooltip */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`flex items-baseline gap-2 text-sm font-medium ${titleText}`}
                        >
                          <span className="truncate" title={name}>
                            {name}
                          </span>
                          {isYou && (
                            <span className="shrink-0 text-xs font-normal opacity-60">
                              (you)
                            </span>
                          )}
                        </div>
                        {member.displayName && (
                          <div
                            className={`text-xs truncate ${muted}`}
                            title={member.email}
                          >
                            {member.email}
                          </div>
                        )}
                      </div>
                      {member.role === 'owner' && (
                        <span
                          className={`${CHIP_BASE} ${CHIP_SIZES.sm} ${chipTone('neutral', isDarkMode)} shrink-0`}
                        >
                          Owner
                        </span>
                      )}
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${name}`}
                              className={`h-11 w-11 flex-shrink-0 ${iconButton} ${openTrigger}`}
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          {/* Opens upwards: a menu hanging below the last row
                              would put "Remove from team" over the footer. It
                              names the member, as it covers the row above. */}
                          <DropdownMenuContent
                            side="top"
                            align="end"
                            className="min-w-[11rem] max-w-[16rem]"
                            onCloseAutoFocus={onMenuClosed}
                          >
                            <DropdownMenuLabel
                              className="truncate"
                              title={name}
                            >
                              {name}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() =>
                                askAfterMenu({ type: 'transfer', member })
                              }
                              className="gap-2 [@media(pointer:coarse)]:min-h-11"
                            >
                              <Crown className="h-4 w-4" />
                              Make owner
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                askAfterMenu({ type: 'remove', member })
                              }
                              className={`gap-2 [@media(pointer:coarse)]:min-h-11 ${
                                isDarkMode
                                  ? 'text-red-400 focus:text-red-400'
                                  : 'text-red-700 focus:text-red-700'
                              }`}
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
            </section>

            <Button
              onClick={() => team && openShareDialog(team.id)}
              variant="neutral"
              className="w-full h-11 rounded-xl"
            >
              <Share2 className="h-4 w-4" />
              Share my sessions…
            </Button>
          </div>

          <DialogFooter className={footer}>
            <Button
              onClick={() => askFor({ type: 'leave' })}
              variant="dangerOutline"
              className="h-11 px-3 min-w-[7.75rem] max-[279px]:min-w-0 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              Leave team
            </Button>
            <Button
              ref={doneButtonRef}
              onClick={closeTeamDialog}
              data-autofocus
              variant="neutral"
              className="flex-1 h-11 rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmCopy}
        onOpenChange={open => {
          if (!open) backToTeam();
        }}
        title={confirmCopy?.question ?? ''}
        description={confirmCopy?.consequence ?? ''}
        confirmLabel={confirmCopy?.action ?? ''}
        tone={confirmCopy?.destructive === false ? 'primary' : 'destructive'}
        icon={confirmCopy?.icon}
        busy={acting}
        onConfirm={() => void handleConfirm()}
      />

      <Dialog open={showShareDialog} onOpenChange={(open) => { if (!open) handleSkipShare(); }}>
        {/* On a phone zoomed to 200% the title and the words under it alone
            are taller than the screen, which left the list no room and
            pushed the buttons out of the dialog: there it grows to fit its
            sessions, and the backdrop scrolls instead. */}
        <DialogContent
          className={`max-w-lg flex flex-col max-h-[calc(100dvh-2rem)] max-[279px]:max-h-none ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          <DialogHeader className={`shrink-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
            <DialogTitle className={titleText}>
              <Share2 className="h-5 w-5 shrink-0 text-team-blue" />
              <span className="min-w-0 break-words">Share sessions with {team?.name}</span>
            </DialogTitle>
            {/* The same words as the invite page's share step */}
            <DialogDescription className={muted}>
              Teammates see shared sessions with their notes, and they stay with
              the team if you leave. New sessions are saved to the team
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={shareBodyRef}
            className="flex-1 min-h-0 overflow-y-auto p-6 pb-2"
          >
            {loadingPersonal ? (
              <div className="flex items-center justify-center py-8" role="status">
                <div
                  aria-hidden="true"
                  className="h-6 w-6 border-2 border-team-blue border-t-transparent rounded-full animate-spin"
                />
                <span className="sr-only">Loading your sessions</span>
              </div>
            ) : loadFailed ? (
              <div className={`text-center py-8 space-y-3 ${muted}`}>
                <p role="alert">
                  Couldn't load your sessions. Check your connection and try
                  again.
                </p>
                <Button
                  onClick={() => setLoadAttempt(n => n + 1)}
                  variant="neutral"
                  className={footerButton}
                >
                  Try again
                </Button>
              </div>
            ) : personalSessions.length === 0 ? (
              <div className={`text-center py-8 ${muted}`}>
                <p>
                  {ownInOtherTeam
                    ? 'No sessions left to share. The rest stay with the team you left.'
                    : hasOwnSessions
                      ? `All your sessions are already shared with ${team?.name}.`
                      : "You haven't recorded any sessions yet."}
                </p>
              </div>
            ) : (
              <ShareSessionsPicker
                sessions={personalSessions}
                selected={selectedSessionIds}
                onChange={setSelectedSessionIds}
                isDarkMode={isDarkMode}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 pt-3 pb-6">
            {personalSessions.length > 0 && !loadingPersonal && !loadFailed ? (
              <>
                <Button
                  onClick={handleSkipShare}
                  variant="neutral"
                  className={footerButton}
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
