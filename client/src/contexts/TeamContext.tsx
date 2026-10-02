import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { teamService } from '@/services';
import type { Team } from '@/types';
import type { JoinTeamResult } from '@/types/team';
import { logger, toDate } from '@/lib';

interface TeamContextType {
  /**
   * The user's current (and only) team, or null if not in a team. Kept live:
   * it becomes null by itself when the user is removed from the team, leaves
   * it on another device, or the team is deleted.
   */
  team: Team | null;
  loading: boolean;
  createTeam: (name: string) => Promise<Team | null>;
  /**
   * Join the team an invite code belongs to. The current team is only left
   * once the new one has been joined, so an invalid code, a declined
   * confirmation or a failed join all leave the user where they were.
   */
  joinTeam: (inviteCode: string, skipConfirmation?: boolean) => Promise<JoinTeamResult>;
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

/**
 * The app shows one team per user. Which one is remembered per account, so
 * that if a user ever turns out to be in more than one, the team they chose
 * stays the one they see.
 */
const rememberedTeamKey = (uid: string) => `teamtrack-team-${uid}`;

/**
 * A team the user agreed to leave (by joining another) but could not be
 * removed from at the time, e.g. because the connection dropped. Leaving it
 * is finished the next time the app loads.
 */
const leavingTeamKey = (uid: string) => `teamtrack-team-leaving-${uid}`;

const store = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode): the choice just isn't remembered.
  }
};

const stored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const rememberTeam = (uid: string, teamId: string | null) =>
  store(rememberedTeamKey(uid), teamId);

const rememberedTeam = (uid: string): string | null =>
  stored(rememberedTeamKey(uid));

/** Finish leaving a team that a previous join could not get the user out of. */
const finishLeaving = async (uid: string, teams: Team[], current: Team | null) => {
  const leavingId = stored(leavingTeamKey(uid));
  if (!leavingId) return;
  if (leavingId !== current?.id && teams.some(t => t.id === leavingId)) {
    try {
      if (!(await teamService.leaveTeam(leavingId, uid))) return;
    } catch (error) {
      logger.warn('Could not finish leaving previous team', {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
  store(leavingTeamKey(uid), null);
};

/** When this user joined the team, in ms (0 if the entry has no date). */
const joinedAtOf = (team: Team, uid: string): number => {
  const joinedAt = team.members?.find(m => m.userId === uid)?.joinedAt;
  const time = joinedAt ? toDate(joinedAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

/**
 * The team to show out of the ones the user is in: the remembered one, else
 * the one joined most recently. Never simply the first the query returned,
 * which is ordered by document ID.
 */
const pickTeam = (teams: Team[], uid: string): Team | null => {
  if (teams.length <= 1) return teams[0] ?? null;
  const remembered = rememberedTeam(uid);
  return (
    teams.find(t => t.id === remembered) ??
    [...teams].sort((a, b) => joinedAtOf(b, uid) - joinedAtOf(a, uid))[0]
  );
};

/** Ask before leaving the current team to join another. */
const confirmLeaveTeam = (teamName: string): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const event = new CustomEvent('teamtrack-confirm-leave-team', {
      detail: {
        teamName,
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
          `You are currently in "${teamName}". Joining a new team will remove you from your current team. Continue?`
        ));
      }
    }, 100);
  });

export const TeamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const uid = user?.uid;
  const teamId = team?.id;

  /** Latest team, for callbacks that outlive the render they were made in. */
  const teamRef = useRef<Team | null>(null);
  useEffect(() => {
    teamRef.current = team;
  }, [team]);

  /** A team the user is leaving on purpose: its loss needs no notice. */
  const leavingTeamId = useRef<string | null>(null);

  /** The initial team lookup, so actions can wait for it to settle. */
  const initialLoad = useRef<Promise<void>>(Promise.resolve());

  /** Show a team (or none) and remember the choice for this account. */
  const showTeam = useCallback((userId: string, next: Team | null) => {
    teamRef.current = next;
    setTeam(next);
    rememberTeam(userId, next?.id ?? null);
  }, []);

  /** The user is no longer in `lost`: clear it, and say so unless they left. */
  const membershipEnded = useCallback(
    (userId: string, lost: Team) => {
      if (teamRef.current?.id !== lost.id) return;
      showTeam(userId, null);
      if (leavingTeamId.current === lost.id) {
        leavingTeamId.current = null;
        return;
      }
      toast.info(`You are no longer a member of ${lost.name}`, {
        id: `team-membership-ended-${lost.id}`,
      });
    },
    [showTeam]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTeam = async () => {
      if (!user) {
        teamRef.current = null;
        setTeam(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const teams = await teamService.getUserTeams(user.uid);
        if (cancelled) return;
        const current = pickTeam(teams, user.uid);
        teamRef.current = current;
        setTeam(current);
        if (current) {
          rememberTeam(user.uid, current.id);
          // Fire-and-forget: backfills the owner fields and invite lookup
          // that older teams are missing.
          teamService.ensureOwnerSetup(current, user.uid);
        }
        finishLeaving(user.uid, teams, current);
      } catch (error) {
        logger.error('Error loading team:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialLoad.current = loadTeam();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep the team live. Being removed (or the team being deleted) otherwise
  // goes unnoticed until a reload, and sessions keep being filed under a
  // team the user is no longer in.
  useEffect(() => {
    if (!uid || !teamId) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    teamService
      .subscribeToTeam(teamId, uid, (fresh) => {
        if (!active) return;
        const shown = teamRef.current;
        if (shown?.id !== teamId) return;
        if (fresh) {
          teamRef.current = fresh;
          setTeam(fresh);
        } else {
          membershipEnded(uid, shown);
        }
      })
      .then((stop) => {
        if (typeof stop !== 'function') return;
        if (active) unsubscribe = stop;
        else stop();
      })
      .catch((error) => logger.error('Error watching team:', error));

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [uid, teamId, membershipEnded]);

  /**
   * Bring the shown team back in line with the server after something went
   * wrong part-way. A failed lookup changes nothing.
   */
  const syncTeam = async (userId: string) => {
    try {
      const teams = await teamService.getUserTeams(userId, true);
      showTeam(userId, pickTeam(teams, userId));
    } catch (error) {
      logger.warn('Could not re-check team membership', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

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
        showTeam(user.uid, newTeam);
      }

      return newTeam;
    } catch (error) {
      logger.error('Error creating team:', error);
      throw error;
    }
  };

  const joinTeam = async (inviteCode: string, skipConfirmation = false): Promise<JoinTeamResult> => {
    if (!user) return { status: 'invalid' };
    // An invite link can be acted on before the user's current team has
    // loaded; joining then would skip leaving it (and asking first).
    await initialLoad.current;
    const previous = teamRef.current;

    try {
      // Nothing is touched until the code is known to be good.
      const invite = await teamService.getInviteByCode(inviteCode);
      if (!invite) return { status: 'invalid' };

      // Opening your own team's invite link is a no-op, not a reason to
      // leave the team and rejoin it.
      if (previous && invite.teamId === previous.id) {
        return { status: 'joined', team: previous };
      }

      // If already in a team, require confirmation before leaving
      if (previous && !skipConfirmation) {
        const confirmed = await confirmLeaveTeam(previous.name);
        if (!confirmed) return { status: 'cancelled', teamName: previous.name };
      }

      // Join the new team first. Only once that has worked is the old one
      // left — the other way round, a failed join leaves the user in no
      // team at all (and, as owner, having given their team away).
      const joined = await teamService.joinTeam(
        inviteCode,
        user.uid,
        user.email || '',
        user.displayName || undefined
      );
      if (!joined) return { status: 'invalid' };

      if (previous) leavingTeamId.current = previous.id;
      showTeam(user.uid, joined.team);
      // Recorded until it has happened, so an interrupted leave is finished
      // on the next load instead of leaving the user in two teams.
      store(leavingTeamKey(user.uid), previous?.id ?? null);

      // If the new team couldn't even be read back the connection is gone;
      // don't keep the user waiting on a leave that can't get through.
      if (previous && joined.loaded) {
        try {
          const left = await teamService.leaveTeam(previous.id, user.uid);
          if (left) store(leavingTeamKey(user.uid), null);
        } catch (error) {
          logger.error('Error leaving previous team:', error);
          toast.warning(
            `You joined ${joined.team.name}, but couldn't be removed from ${previous.name} yet. That will be retried the next time you open the app.`
          );
        }
      }
      leavingTeamId.current = null;

      return {
        status: joined.loaded ? 'joined' : 'joined-unloaded',
        team: joined.team,
      };
    } catch (error) {
      logger.error('Error joining team:', error);
      // The attempt may have got part-way: show whatever is true now.
      await syncTeam(user.uid);
      throw error;
    }
  };

  const leaveTeam = async (): Promise<void> => {
    if (!user || !team) return;

    try {
      leavingTeamId.current = team.id;
      await teamService.leaveTeam(team.id, user.uid);
      showTeam(user.uid, null);
    } catch (error) {
      logger.error('Error leaving team:', error);
      throw error;
    } finally {
      leavingTeamId.current = null;
    }
  };

  const refreshTeam = async (): Promise<void> => {
    if (!user) return;

    try {
      const shown = teamRef.current;
      if (shown) {
        // null means "not a member any more"; a failed read throws instead,
        // so a dropped connection doesn't make the team disappear.
        const freshTeam = await teamService.getMembership(shown.id, user.uid);
        if (teamRef.current?.id !== shown.id) return;
        if (freshTeam) {
          teamRef.current = freshTeam;
          setTeam(freshTeam);
        } else {
          membershipEnded(user.uid, shown);
        }
        return;
      }

      const teams = await teamService.getUserTeams(user.uid, true);
      if (teamRef.current) return;
      showTeam(user.uid, pickTeam(teams, user.uid));
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
