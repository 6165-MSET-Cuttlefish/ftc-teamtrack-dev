import { useState, useEffect } from 'react';
import { useTeam, useTheme, useAuth } from '@/contexts';
import { firebaseService } from '@/services';
import { formatDate, logger, copyToClipboard } from '@/lib';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  Link2,
  Copy,
  Check,
  RefreshCw,
  UserPlus,
  Crown,
  LogOut,
  Download,
  CheckSquare,
  Square,
  ArrowRightLeft,
  UserMinus,
  Pencil,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Session } from '@/types';

interface TeamManagerProps {
  onTeamChange?: () => void;
}

export const TeamManager = ({ onTeamChange }: TeamManagerProps) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const {
    team,
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
  const [showTeamInfo, setShowTeamInfo] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [transferring, setTransferring] = useState<string | null>(null);
  const [transferConfirm, setTransferConfirm] = useState<string | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [personalSessions, setPersonalSessions] = useState<Session[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!showImportDialog || !user?.uid) return;

    const loadPersonalSessions = async () => {
      setLoadingPersonal(true);
      try {
        const sessions = await firebaseService.getUserSessions(user.uid);
        const targetTeamId = pendingTeamId || team?.id;
        // Show all sessions that aren't already in the target team
        // This includes personal sessions AND sessions from old teams the user left
        const importable = sessions.filter(s => s.teamId !== targetTeamId);
        setPersonalSessions(importable);
        setSelectedSessionIds(new Set(importable.map(s => s.id)));
      } catch {
        toast.error('Failed to load your sessions');
      } finally {
        setLoadingPersonal(false);
      }
    };

    loadPersonalSessions();
  }, [showImportDialog, user?.uid, pendingTeamId, team?.id]);

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

  const handleImportSessions = async () => {
    const teamIdToUse = pendingTeamId || team?.id;
    if (!teamIdToUse || selectedSessionIds.size === 0) return;

    setImporting(true);
    try {
      const count = await firebaseService.importSessionsToTeam(
        Array.from(selectedSessionIds),
        teamIdToUse
      );
      toast.success(`Imported ${count} session${count !== 1 ? 's' : ''} to team`);
      setShowImportDialog(false);
      setPendingTeamId(null);
      onTeamChange?.();
    } catch {
      toast.error('Failed to import sessions');
    } finally {
      setImporting(false);
    }
  };

  const handleSkipImport = () => {
    setShowImportDialog(false);
    setPendingTeamId(null);
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setCreating(true);
    try {
      const newTeam = await createTeam(teamName.trim());
      if (newTeam) {
        toast.success(`Team "${newTeam.name}" created!`);
        onTeamChange?.();
        setShowCreateDialog(false);
        setTeamName('');
        setPendingTeamId(newTeam.id);
        setShowImportDialog(true);
      } else {
        toast.error('Failed to create team. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Create team error', err instanceof Error ? err : undefined);
      toast.error(`Failed to create team: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setJoining(true);
    try {
      const joinedTeam = await joinTeam(inviteCode.trim().toUpperCase());
      if (joinedTeam) {
        toast.success(`Joined team "${joinedTeam.name}"!`);
        onTeamChange?.();
        setShowJoinDialog(false);
        setInviteCode('');
        setPendingTeamId(joinedTeam.id);
        setShowImportDialog(true);
      } else {
        toast.error('Invalid invite code');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Join team error', err instanceof Error ? err : undefined);
      toast.error(`Failed to join team: ${message}`);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!leaveConfirm) {
      setLeaveConfirm(true);
      setTimeout(() => setLeaveConfirm(false), 5000);
      return;
    }

    setLeaving(true);
    try {
      await leaveTeam();
      toast.success('You left the team');
      onTeamChange?.();
      setShowTeamInfo(false);
      setLeaveConfirm(false);
    } catch {
      toast.error('Failed to leave team');
    } finally {
      setLeaving(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!team) return;

    const inviteUrl = `${window.location.origin}/join/${team.inviteCode}`;
    try {
      await copyToClipboard(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const newCode = await regenerateInviteCode();
      if (newCode) {
        toast.success('Invite code regenerated');
      }
    } catch {
      toast.error('Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId: string, memberName: string) => {
    if (transferConfirm !== newOwnerId) {
      setTransferConfirm(newOwnerId);
      setTimeout(() => setTransferConfirm(prev => prev === newOwnerId ? null : prev), 5000);
      return;
    }

    setTransferConfirm(null);
    setTransferring(newOwnerId);
    try {
      const success = await transferOwnership(newOwnerId);
      if (success) {
        toast.success(`Ownership transferred to ${memberName}`);
      } else {
        toast.error('Failed to transfer ownership');
      }
    } catch {
      toast.error('Failed to transfer ownership');
    } finally {
      setTransferring(null);
    }
  };

  const handleKickMember = async (targetUserId: string, memberName: string) => {
    if (kickConfirm !== targetUserId) {
      setKickConfirm(targetUserId);
      setTimeout(() => setKickConfirm(prev => prev === targetUserId ? null : prev), 5000);
      return;
    }

    setKickConfirm(null);
    setKicking(targetUserId);
    try {
      const success = await kickMember(targetUserId);
      if (success) {
        toast.success(`${memberName} has been removed from the team`);
      } else {
        toast.error('Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setKicking(null);
    }
  };

  const handleStartRename = () => {
    setRenameValue(team?.name ?? '');
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
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

  const isOwner = team?.members.some(m => m.userId === user?.uid && m.role === 'owner') ?? false;

  return (
    <>
      <div
        className={`flex items-center gap-2 flex-wrap ${
          isDarkMode ? 'text-white' : 'text-team-blue'
        }`}
      >
        {team ? (
          <>
            <button
              onClick={async () => {
                await refreshTeam();
                setShowTeamInfo(true);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark-20 text-white hover:border-team-blue'
                  : 'border-gray-200 bg-white text-team-blue hover:border-team-blue'
              }`}
            >
              <Users className="h-4 w-4 text-team-blue" />
              <span className="max-w-[200px] truncate">{team.name}</span>
              <span className={`text-xs ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}>
                · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              </span>
            </button>

            <button
              onClick={async () => {
                if (!team?.inviteCode) return;
                const inviteUrl = `${window.location.origin}/join/${team.inviteCode}`;
                try {
                  await copyToClipboard(inviteUrl);
                } catch {
                  toast.error('Failed to copy');
                  return;
                }
                setInviteCopied(true);
                setTimeout(() => setInviteCopied(false), 2000);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm min-h-[40px] sm:min-h-[44px] ${
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
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Invite</span>
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowCreateDialog(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm min-h-[40px] sm:min-h-[44px] ${
                isDarkMode
                  ? 'border-team-blue-40 hover:border-team-blue text-team-blue bg-team-dark-20'
                  : 'border-gray-200 hover:border-team-blue text-team-blue bg-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Create Team
            </button>
            <button
              onClick={() => setShowJoinDialog(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm min-h-[40px] sm:min-h-[44px] ${
                isDarkMode
                  ? 'border-team-blue-40 hover:border-team-blue text-team-blue bg-team-dark-20'
                  : 'border-gray-200 hover:border-team-blue text-team-blue bg-white'
              }`}
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
              Create a team to share sessions with other members.
              All your sessions will be shared with the team.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                }`}
              >
                Team Name
              </label>
              <Input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g., Robotics Team 1234"
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

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowCreateDialog(false)}
                variant="outline"
                className={`flex-1 h-11 rounded-xl ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={creating || !teamName.trim()}
                className={`flex-1 h-11 rounded-xl bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                {creating ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Create Team'
                )}
              </Button>
            </div>
          </div>
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
              Enter the invite code or link shared by a team member.
              {team && ' You will leave your current team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                }`}
              >
                Invite Code / Link
              </label>
              <Input
                value={inviteCode}
                onChange={e => {
                  let val = e.target.value;
                  // If user pastes a join link, extract just the code
                  const joinMatch = val.match(/\/join\/([A-Za-z0-9]+)/);
                  if (joinMatch) {
                    val = joinMatch[1];
                  }
                  setInviteCode(val.toUpperCase());
                }}
                placeholder="Code or invite link"
                className={`h-12 rounded-xl text-center text-lg font-mono tracking-widest ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                    : 'bg-gray-50 border-gray-200 text-team-blue placeholder-gray-400'
                }`}
                maxLength={64}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleJoinTeam();
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowJoinDialog(false)}
                variant="outline"
                className={`flex-1 h-11 rounded-xl ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleJoinTeam}
                disabled={joining || !inviteCode.trim()}
                className={`flex-1 h-11 rounded-xl bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                {joining ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Join Team'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTeamInfo} onOpenChange={(open) => { setShowTeamInfo(open); if (!open) handleCancelRename(); }}>
        <DialogContent
          className={`max-w-md ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <Users className="h-5 w-5 text-team-blue" />
              {team?.name}
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Manage your team and invite members.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {isOwner && (
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                  }`}
                >
                  Team Name
                </label>
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className={`flex-1 h-10 rounded-xl ${
                        isDarkMode
                          ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                          : 'bg-gray-50 border-gray-200 text-team-blue'
                      }`}
                      maxLength={50}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameTeam();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                    />
                    <Button
                      onClick={handleRenameTeam}
                      disabled={renaming || !renameValue.trim()}
                      size="sm"
                      className={`h-10 px-3 rounded-xl bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`}
                      title="Save name"
                    >
                      {renaming ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelRename}
                      size="sm"
                      variant="outline"
                      className={`h-10 px-3 rounded-xl ${
                        isDarkMode
                          ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-1 text-sm font-semibold truncate ${
                        isDarkMode ? 'text-white' : 'text-team-blue'
                      }`}
                    >
                      {team?.name}
                    </span>
                    <button
                      onClick={handleStartRename}
                      title="Rename team"
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-team-white-40 hover:text-team-blue hover:bg-team-dark'
                          : 'text-gray-400 hover:text-team-blue hover:bg-gray-100'
                      }`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                className={`block text-sm font-medium mb-3 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                }`}
              >
                Invite Link
              </label>
              <div className="flex items-center gap-2">
                <div
                  className={`flex-1 px-4 py-3 rounded-xl border font-mono text-sm truncate ${
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
                  onClick={handleCopyInviteLink}
                  size="sm"
                  className={`h-11 px-3 rounded-xl bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleRegenerateCode}
                  size="sm"
                  disabled={regenerating}
                  variant="outline"
                  className={`h-11 px-3 rounded-xl ${
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Generate new invite code (old code will stop working)"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p
                className={`text-xs mt-2 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
              >
                Share this link to invite others. All members can invite new people.
              </p>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                }`}
              >
                Invite Code
              </label>
              <div
                className={`text-center py-3 rounded-xl border text-2xl font-mono font-bold tracking-[0.3em] ${
                  isDarkMode
                    ? 'bg-team-blue/10 border-team-blue-40 text-team-blue'
                    : 'bg-team-blue/5 border-team-blue/20 text-team-blue'
                }`}
              >
                {team?.inviteCode}
              </div>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-3 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-700'
                }`}
              >
                Members ({team?.members.length || 0})
              </label>
              <div
                className={`rounded-xl border overflow-hidden ${
                  isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
                }`}
              >
                <div className="max-h-[260px] overflow-y-auto">
                {team?.members.map((member, idx) => (
                  <div
                    key={member.userId}
                    className={`flex items-center gap-3 px-4 py-3 ${
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
                        (member.displayName || member.email)?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          isDarkMode ? 'text-white' : 'text-team-blue'
                        }`}
                      >
                        {member.displayName || member.email}
                        {member.userId === user?.uid && (
                          <span className="text-xs ml-2 opacity-60">(you)</span>
                        )}
                      </div>
                      {member.displayName && (
                        <div
                          className={`text-xs truncate ${
                            isDarkMode ? 'text-team-white-40' : 'text-gray-400'
                          }`}
                        >
                          {member.email}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOwner && member.userId !== user?.uid && (
                        <button
                          onClick={() => handleTransferOwnership(member.userId, member.displayName || member.email)}
                          disabled={transferring === member.userId}
                          title="Transfer ownership"
                          className={`flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
                            transferConfirm === member.userId
                              ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 px-2 py-1'
                              : isDarkMode
                                ? 'hover:bg-team-dark text-team-white-40 hover:text-team-blue p-1.5'
                                : 'hover:bg-gray-200 text-gray-400 hover:text-team-blue p-1.5'
                          } ${transferring === member.userId ? 'opacity-50' : ''}`}
                        >
                          {transferring === member.userId ? (
                            <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : transferConfirm === member.userId ? (
                            <>
                              Transfer ownership?
                              <Check className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {isOwner && member.userId !== user?.uid && (
                        <button
                          onClick={() => handleKickMember(member.userId, member.displayName || member.email)}
                          disabled={kicking === member.userId}
                          title="Remove member"
                          className={`flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
                            kickConfirm === member.userId
                              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2 py-1'
                              : isDarkMode
                                ? 'hover:bg-team-dark text-team-white-40 hover:text-red-400 p-1.5'
                                : 'hover:bg-gray-200 text-gray-400 hover:text-red-500 p-1.5'
                          } ${kicking === member.userId ? 'opacity-50' : ''}`}
                        >
                          {kicking === member.userId ? (
                            <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : kickConfirm === member.userId ? (
                            <>
                              Remove?
                              <Check className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          member.role === 'owner'
                            ? 'bg-team-blue/15 text-team-blue'
                            : isDarkMode
                              ? 'bg-team-dark text-team-white-40'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {member.role === 'owner' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleLeaveTeam}
                disabled={leaving}
                variant="outline"
                className={`h-11 rounded-xl ${
                  leaveConfirm
                    ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                    : isDarkMode
                      ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                      : 'border-red-300 text-red-500 hover:bg-red-50'
                }`}
              >
                {leaving ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-1.5" />
                    {leaveConfirm ? 'Confirm Leave' : 'Leave Team'}
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowTeamInfo(false)}
                className={`flex-1 h-11 rounded-xl bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
            <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) handleSkipImport(); }}>
        <DialogContent
          className={`max-w-lg ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          <DialogHeader className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
              <Download className="h-5 w-5 text-team-blue" />
              Import Sessions to Team
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Select which of your existing sessions to add to the team. Future sessions will be saved to the team automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {loadingPersonal ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 border-2 border-team-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : personalSessions.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                <p>No personal sessions to import.</p>
                <p className="text-sm mt-1">New sessions will automatically save to the team.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={toggleAll}
                  className={`flex items-center gap-2 text-sm font-medium w-full px-3 py-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-team-dark-20 text-team-white-60' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {selectedSessionIds.size === personalSessions.length ? (
                    <CheckSquare className="h-4 w-4 text-team-blue" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Select all ({personalSessions.length} session{personalSessions.length !== 1 ? 's' : ''})
                </button>

                <div className={`max-h-[300px] overflow-y-auto rounded-xl border ${
                  isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
                }`}>
                  {personalSessions.map((session, idx) => (
                    <button
                      key={session.id}
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
                          isDarkMode ? 'text-team-white-40' : 'text-gray-400'
                        }`}>
                          {formatDate(session.createdAt)} · {session.matches?.length || 0} match{(session.matches?.length || 0) !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSkipImport}
                variant="outline"
                className={`flex-1 h-11 rounded-xl ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark-20'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Skip
              </Button>
              {personalSessions.length > 0 && (
                <Button
                  onClick={handleImportSessions}
                  disabled={importing || selectedSessionIds.size === 0}
                  className={`flex-1 h-11 rounded-xl bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  {importing ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1.5" />
                      Import {selectedSessionIds.size} Session{selectedSessionIds.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
