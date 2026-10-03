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
import type { JoinTeamResult, LeaveOutcome, Team } from '@/types';
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
   * Join the team an invite code belongs to. Someone already in another team
   * is only moved when `leaveCurrent` is set: the caller asks first, in its
   * own UI, and without it the result is 'cancelled' and nothing changes.
   * The current team is only left once the new one has been joined, so an
   * invalid code or a failed join also leave the user where they were.
   */
  joinTeam: (inviteCode: string, leaveCurrent?: boolean) => Promise<JoinTeamResult>;
  /** Leave the current team. Resolves to what that did to the team. */
  leaveTeam: () => Promise<LeaveOutcome | null>;
  /**
   * Re-check the team with the server. Resolves to the team the user is in
   * now, or null when there is none (any more).
   */
  refreshTeam: () => Promise<Team | null>;
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

/**
 * The remembered team's name, kept so that someone who was removed while the
 * app was closed can be told which team they are no longer in.
 */
const rememberedTeamNameKey = (uid: string) => `teamtrack-team-name-${uid}`;

const rememberTeam = (uid: string, team: Team | null) => {
  store(rememberedTeamKey(uid), team?.id ?? null);
  store(rememberedTeamNameKey(uid), team?.name ?? null);
};

const rememberedTeam = (uid: string): string | null =>
  stored(rememberedTeamKey(uid));

/** How often, at most, coming back to the app re-checks team membership. */
const MEMBERSHIP_RECHECK_MS = 30_000;

/**
 * Tell the user they are no longer in a team they did not choose to leave.
 * Stays until dismissed: it explains why their session list just changed.
 */
const notifyMembershipEnded = (teamId: string, teamName: string) =>
  toast.info(`You're no longer a member of ${teamName}`, {
    id: `team-membership-ended-${teamId}`,
    description: 'Sessions you shared stay with that team.',
    duration: Infinity,
    action: { label: 'OK', onClick: () => {} },
  });

/**
 * On load the user is in no team, but this browser last showed them one:
 * they were removed (or the team was deleted) while the app was closed. Say
 * so once. A lookup that fails proves nothing, so it says nothing.
 */
const noticeTeamLostWhileAway = async (uid: string) => {
  const teamId = rememberedTeam(uid);
  if (!teamId) return;
  try {
    if (await teamService.getMembership(teamId, uid)) return;
  } catch {
    return;
  }
  // They may have created or joined a team while that was being checked.
  if (rememberedTeam(uid) !== teamId) return;
  const teamName = stored(rememberedTeamNameKey(uid));
  rememberTeam(uid, null);
  if (teamName) notifyMembershipEnded(teamId, teamName);
};

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

  // A rename (here or by the owner elsewhere) keeps the remembered name
  // current, for the notice shown if the team is later lost.
  const teamName = team?.name;
  useEffect(() => {
    if (uid && teamId && teamName) store(rememberedTeamNameKey(uid), teamName);
  }, [uid, teamId, teamName]);

  /** A team the user is leaving on purpose: its loss needs no notice. */
  const leavingTeamId = useRef<string | null>(null);

  /** The initial team lookup, so actions can wait for it to settle. */
  const initialLoad = useRef<Promise<void>>(Promise.resolve());

  /** Show a team (or none) and remember the choice for this account. */
  const showTeam = useCallback((userId: string, next: Team | null) => {
    teamRef.current = next;
    setTeam(next);
    rememberTeam(userId, next);
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
      notifyMembershipEnded(lost.id, lost.name);
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
          rememberTeam(user.uid, current);
          // Fire-and-forget: backfills the owner fields and invite lookup
          // that older teams are missing.
          teamService.ensureOwnerSetup(current, user.uid);
        } else {
          noticeTeamLostWhileAway(user.uid);
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

  const joinTeam = async (inviteCode: string, leaveCurrent = false): Promise<JoinTeamResult> => {
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

      // Already in a team: it is only left when the caller has asked the
      // user and been told yes.
      if (previous && !leaveCurrent) {
        return { status: 'cancelled', teamName: previous.name };
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

  const leaveTeam = async (): Promise<LeaveOutcome | null> => {
    if (!user || !team) return null;

    try {
      leavingTeamId.current = team.id;
      const outcome = await teamService.leaveTeam(team.id, user.uid);
      showTeam(user.uid, null);
      return outcome;
    } catch (error) {
      logger.error('Error leaving team:', error);
      throw error;
    } finally {
      leavingTeamId.current = null;
    }
  };

  const refreshTeam = async (): Promise<Team | null> => {
    if (!user) return null;

    try {
      const shown = teamRef.current;
      if (shown) {
        // null means "not a member any more"; a failed read throws instead,
        // so a dropped connection doesn't make the team disappear.
        const freshTeam = await teamService.getMembership(shown.id, user.uid);
        if (teamRef.current?.id !== shown.id) return teamRef.current;
        if (freshTeam) {
          teamRef.current = freshTeam;
          setTeam(freshTeam);
        } else {
          membershipEnded(user.uid, shown);
        }
        return teamRef.current;
      }

      const teams = await teamService.getUserTeams(user.uid, true);
      if (teamRef.current) return teamRef.current;
      showTeam(user.uid, pickTeam(teams, user.uid));
    } catch (error) {
      logger.error('Error refreshing team:', error);
    }
    // After a failed lookup this is still the team that was showing.
    return teamRef.current;
  };

  // The live listener can die quietly while a phone has the app in the
  // background. Coming back re-checks, so a team the user was removed from
  // doesn't keep its name on screen (or keep being saved to).
  const refreshTeamRef = useRef(refreshTeam);
  useEffect(() => {
    refreshTeamRef.current = refreshTeam;
  });
  useEffect(() => {
    if (!uid) return;
    let lastCheck = Date.now();
    const recheck = () => {
      if (document.visibilityState !== 'visible' || !teamRef.current) return;
      if (Date.now() - lastCheck < MEMBERSHIP_RECHECK_MS) return;
      lastCheck = Date.now();
      void refreshTeamRef.current();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [uid]);

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
