import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { teamService } from '@/services';
import type { Team } from '@/types';
import { logger } from '@/lib';

interface TeamContextType {
  /** The user's current (and only) team, or null if not in a team */
  team: Team | null;
  loading: boolean;
  createTeam: (name: string) => Promise<Team | null>;
  joinTeam: (inviteCode: string, skipConfirmation?: boolean) => Promise<Team | null>;
  leaveTeam: () => Promise<void>;
  refreshTeam: () => Promise<void>;
  regenerateInviteCode: () => Promise<string | null>;
  transferOwnership: (newOwnerId: string) => Promise<boolean>;
  kickMember: (targetUserId: string) => Promise<boolean>;
  updateMemberDisplayName: (newDisplayName: string) => Promise<void>;
  renameTeam: (name: string) => Promise<boolean>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export const TeamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeam = async () => {
      if (!user) {
        setTeam(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const teams = await teamService.getUserTeams(user.uid);
        if (teams.length > 0) {
          setTeam(teams[0]);
        } else {
          setTeam(null);
        }
      } catch (error) {
        logger.error('Error loading team:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [user]);

  const createTeam = async (name: string): Promise<Team | null> => {
    if (!user) return null;

    try {
      const newTeam = await teamService.createTeam({
        name,
        createdBy: user.uid,
        createdByEmail: user.email || '',
        createdByName: user.displayName || undefined,
      });

      if (newTeam) {
        setTeam(newTeam);
      }

      return newTeam;
    } catch (error) {
      logger.error('Error creating team:', error);
      throw error;
    }
  };

  const joinTeam = async (inviteCode: string, skipConfirmation = false): Promise<Team | null> => {
    if (!user) return null;

    try {
      // If already in a team, require confirmation before leaving
      if (team && !skipConfirmation) {
        const confirmed = await new Promise<boolean>((resolve) => {
          const event = new CustomEvent('teamtrack-confirm-leave-team', {
            detail: {
              teamName: team.name,
              resolve,
            },
          });
          // If no listener handles it within 100ms, fall back to window.confirm
          let handled = false;
          const handler = () => { handled = true; };
          window.addEventListener('teamtrack-confirm-leave-team-handled', handler, { once: true });
          window.dispatchEvent(event);
          setTimeout(() => {
            window.removeEventListener('teamtrack-confirm-leave-team-handled', handler);
            if (!handled) {
              resolve(window.confirm(
                `You are currently in "${team.name}". Joining a new team will remove you from your current team. Continue?`
              ));
            }
          }, 100);
        });
        if (!confirmed) return null;
        await teamService.leaveTeam(team.id, user.uid);
      }

      const newTeam = await teamService.joinTeam(
        inviteCode,
        user.uid,
        user.email || '',
        user.displayName || undefined
      );

      if (newTeam) {
        setTeam(newTeam);
      }

      return newTeam;
    } catch (error) {
      logger.error('Error joining team:', error);
      throw error;
    }
  };

  const leaveTeam = async (): Promise<void> => {
    if (!user || !team) return;

    try {
      await teamService.leaveTeam(team.id, user.uid);
      setTeam(null);
    } catch (error) {
      logger.error('Error leaving team:', error);
      throw error;
    }
  };

  const refreshTeam = async (): Promise<void> => {
    if (!user) return;

    try {
      if (team?.id) {
        const freshTeam = await teamService.getTeam(team.id);
        if (freshTeam && freshTeam.members.some(m => m.userId === user.uid)) {
          setTeam(freshTeam);
        } else {
          setTeam(null);
        }
        return;
      }

      const teams = await teamService.getUserTeams(user.uid);
      if (teams.length > 0) {
        setTeam(teams[0]);
      } else {
        setTeam(null);
      }
    } catch (error) {
      logger.error('Error refreshing team:', error);
    }
  };

  const regenerateInviteCode = async (): Promise<string | null> => {
    if (!team) return null;
    try {
      const newCode = await teamService.regenerateInviteCode(team.id);
      if (newCode) {
        await refreshTeam();
      }
      return newCode;
    } catch (error) {
      logger.error('Error regenerating invite code:', error);
      throw error;
    }
  };

  const transferOwnership = async (newOwnerId: string): Promise<boolean> => {
    if (!user || !team) return false;
    try {
      const success = await teamService.transferOwnership(team.id, user.uid, newOwnerId);
      if (success) {
        await refreshTeam();
      }
      return success;
    } catch (error) {
      logger.error('Error transferring ownership:', error);
      throw error;
    }
  };

  const kickMember = async (targetUserId: string): Promise<boolean> => {
    if (!user || !team) return false;
    try {
      const success = await teamService.kickMember(team.id, user.uid, targetUserId);
      if (success) {
        await refreshTeam();
      }
      return success;
    } catch (error) {
      logger.error('Error kicking member:', error);
      throw error;
    }
  };

  const updateMemberDisplayName = async (newDisplayName: string): Promise<void> => {
    if (!user || !team) return;
    try {
      await teamService.updateMemberDisplayName(team.id, user.uid, newDisplayName);
      await refreshTeam();
    } catch (error) {
      logger.error('Error updating member display name:', error);
    }
  };

  const renameTeam = async (name: string): Promise<boolean> => {
    if (!team) return false;
    try {
      const success = await teamService.updateTeamName(team.id, name.trim());
      if (success) {
        setTeam(prev => prev ? { ...prev, name: name.trim() } : prev);
      }
      return success;
    } catch (error) {
      logger.error('Error renaming team:', error);
      throw error;
    }
  };

  return (
    <TeamContext.Provider
      value={{
        team,
        loading,
        createTeam,
        joinTeam,
        leaveTeam,
        refreshTeam,
        regenerateInviteCode,
        transferOwnership,
        kickMember,
        updateMemberDisplayName,
        renameTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};
