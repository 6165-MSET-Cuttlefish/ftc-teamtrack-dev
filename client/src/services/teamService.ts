import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
  arrayRemove,
  type Firestore,
} from 'firebase/firestore';
import { getFirebase, isAbortError } from '@/lib';
import type { Team, CreateTeamData, TeamInvite, TeamMember } from '@/types';

/**
 * Teams, and how the Firestore rules police them (see firestore.rules):
 *
 * - The owner is `ownerId` (falling back to `createdBy` on teams made before
 *   the field existed). Only the owner can rename, kick, transfer, or change
 *   the invite code. `members[].role` mirrors it for display.
 * - A member can only remove themselves, or change their own entry.
 * - A non-member can only add themselves, and only by writing the team's
 *   current invite code into `joinCode` — so knowing a team's ID is not
 *   enough to get in.
 * - Invite codes resolve through `teamInvites/{code}` → `{ teamId, teamName }`,
 *   which any signed-in user can fetch by exact code but nobody can list.
 *   Team documents themselves are readable by members only.
 */
class TeamService {
  private dbInstance: Firestore | null = null;

  /** Get Firestore database instance (lazy initialization) */
  private async getDB(): Promise<Firestore> {
    if (this.dbInstance) return this.dbInstance;

    const firebase = await getFirebase();
    if (!firebase?.db) {
      throw new Error('Firebase not initialized');
    }

    this.dbInstance = firebase.db;
    return this.dbInstance;
  }

  /**
   * Safely execute a database operation with abort error handling
   */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T,
    errorMessage: string,
    throwOnError = false
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isAbortError(error)) {
        return fallback;
      }
      const { logger } = await import('@/lib/logger');
      logger.error(errorMessage, error);
      if (throwOnError) {
        throw error;
      }
      return fallback;
    }
  }

  /** Generate a unique invite code */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = crypto.getRandomValues(new Uint32Array(8));
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(values[i] % chars.length);
    }
    return code;
  }

  /** The team's owner, allowing for teams saved before `ownerId` existed. */
  ownerOf(team: Pick<Team, 'ownerId' | 'createdBy'>): string {
    return team.ownerId ?? team.createdBy;
  }

  /** Point an invite code at its team. Owner only. */
  private async writeInvite(teamId: string, code: string, teamName: string) {
    const db = await this.getDB();
    await setDoc(doc(db, 'teamInvites', code), { teamId, teamName });
  }

  /**
   * Ensure a team document has the `memberIds` field.
   * Legacy teams created before the field existed are backfilled on first read.
   */
  private async ensureMemberIds(team: Team): Promise<Team> {
    if (team.memberIds && team.memberIds.length > 0) return team;

    const ids = (team.members || []).map((m) => m.userId);
    try {
      const db = await this.getDB();
      await updateDoc(doc(db, 'teams', team.id), { memberIds: ids });
    } catch {
      // Non-critical — will retry on next read
    }
    return { ...team, memberIds: ids };
  }

  /**
   * Bring an owner's team up to date with the current data model: record
   * `ownerId`, and make sure its invite code resolves. Teams created before
   * `teamInvites` existed have no invite document, which is why their links
   * stopped working. Safe to call on every load; a no-op for non-owners.
   */
  async ensureOwnerSetup(team: Team, userId: string): Promise<void> {
    if (this.ownerOf(team) !== userId) return;
    try {
      const db = await this.getDB();
      if (!team.ownerId) {
        await updateDoc(doc(db, 'teams', team.id), { ownerId: userId });
      }
      const invite = await getDoc(doc(db, 'teamInvites', team.inviteCode));
      if (
        !invite.exists() ||
        invite.data().teamId !== team.id ||
        invite.data().teamName !== team.name
      ) {
        await this.writeInvite(team.id, team.inviteCode, team.name);
      }
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.warn('Could not update team setup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Create a new team */
  async createTeam(teamData: CreateTeamData): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const inviteCode = this.generateInviteCode();

        const newTeam = {
          name: teamData.name,
          createdBy: teamData.createdBy,
          ownerId: teamData.createdBy,
          createdAt: Timestamp.now(),
          inviteCode,
          memberIds: [teamData.createdBy],
          members: [
            {
              userId: teamData.createdBy,
              email: teamData.createdByEmail,
              displayName: teamData.createdByName || '',
              joinedAt: Timestamp.now(),
              role: 'owner' as const,
            },
          ],
        };

        const docRef = await addDoc(collection(db, 'teams'), newTeam);
        await this.writeInvite(docRef.id, inviteCode, newTeam.name);
        return { id: docRef.id, ...newTeam } as Team;
      },
      null,
      'Error creating team:',
      true
    );
  }

  /** Get team by ID (members only) */
  async getTeam(teamId: string): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        const team = { id: docSnap.id, ...docSnap.data() } as Team;
        return this.ensureMemberIds(team);
      },
      null,
      'Error fetching team:'
    );
  }

  /** Look up which team an invite code belongs to */
  async getInviteByCode(inviteCode: string): Promise<TeamInvite | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const code = inviteCode.trim().toUpperCase();
        if (!code) return null;
        const snap = await getDoc(doc(db, 'teamInvites', code));
        if (!snap.exists()) return null;
        const data = snap.data();
        return { code, teamId: data.teamId, teamName: data.teamName ?? '' };
      },
      null,
      'Error fetching team by invite code:'
    );
  }

  /** Get all teams for a user */
  async getUserTeams(userId: string): Promise<Team[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();

        const memberQuery = query(
          collection(db, 'teams'),
          where('memberIds', 'array-contains', userId)
        );
        const snapshot = await getDocs(memberQuery);

        const teams = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Team));

        // Backfill memberIds on any legacy teams (fire-and-forget)
        for (const team of teams) {
          if (!team.memberIds || team.memberIds.length === 0) {
            this.ensureMemberIds(team);
          }
        }

        return teams;
      },
      [],
      'Error fetching user teams:'
    );
  }

  /** Join a team using invite code */
  async joinTeam(
    inviteCode: string,
    userId: string,
    userEmail: string,
    displayName?: string
  ): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const invite = await this.getInviteByCode(inviteCode);
        if (!invite) {
          throw new Error('Invalid invite code');
        }

        const db = await this.getDB();

        // Team documents are members-only, so a successful read means the
        // user is already in this team; a denied read is the normal case.
        try {
          const snap = await getDoc(doc(db, 'teams', invite.teamId));
          if (snap.exists() && (snap.data().memberIds ?? []).includes(userId)) {
            return { id: snap.id, ...snap.data() } as Team;
          }
        } catch {
          // Not a member yet
        }

        const newMember: TeamMember = {
          userId,
          email: userEmail,
          displayName: displayName || '',
          joinedAt: Timestamp.now(),
          role: 'member',
        };

        await updateDoc(doc(db, 'teams', invite.teamId), {
          members: arrayUnion(newMember),
          memberIds: arrayUnion(userId),
          // Proof of invite: the rules only admit a new member whose
          // joinCode matches the team's current invite code.
          joinCode: invite.code,
        });

        return this.getTeam(invite.teamId);
      },
      null,
      'Error joining team:',
      true
    );
  }

  /** Update team name (owner only) */
  async updateTeamName(teamId: string, name: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        await updateDoc(docRef, { name });
        const team = await this.getTeam(teamId);
        if (team) await this.writeInvite(teamId, team.inviteCode, name);
        return true;
      },
      false,
      'Error updating team name:',
      true
    );
  }

  /** Regenerate invite code (owner only). Old links stop working. */
  async regenerateInviteCode(teamId: string): Promise<string | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const team = await this.getTeam(teamId);
        if (!team) return null;

        const newCode = this.generateInviteCode();
        await updateDoc(doc(db, 'teams', teamId), { inviteCode: newCode });
        await this.writeInvite(teamId, newCode, team.name);
        await deleteDoc(doc(db, 'teamInvites', team.inviteCode)).catch(() => {});
        return newCode;
      },
      null,
      'Error regenerating invite code:',
      true
    );
  }

  /** Serialize a Firestore member object into a clean plain object */
  private cleanMember(m: TeamMember, roleOverride?: 'owner' | 'member'): Record<string, unknown> {
    return {
      userId: m.userId,
      email: m.email,
      displayName: m.displayName || '',
      joinedAt: m.joinedAt,
      role: roleOverride ?? m.role,
    };
  }

  /**
   * Leave a team. A member just removes themselves. The owner hands the team
   * to the longest-standing member, or deletes it if they were the last one.
   */
  async leaveTeam(teamId: string, userId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
        const members: TeamMember[] = team.members || [];
        const leavingMember = members.find((m) => m.userId === userId);
        if (!leavingMember) return true;
        const remaining = members.filter((m) => m.userId !== userId);

        if (this.ownerOf(team) !== userId) {
          // Remove exactly the stored entry, so the rules can see nothing
          // else in the member list changed.
          await updateDoc(docRef, {
            members: arrayRemove(leavingMember),
            memberIds: arrayRemove(userId),
          });
          return true;
        }

        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'teamInvites', team.inviteCode)).catch(() => {});
          await deleteDoc(docRef);
          return true;
        }

        const joinedSeconds = (m: TeamMember) =>
          m.joinedAt && typeof m.joinedAt === 'object' && 'seconds' in m.joinedAt
            ? (m.joinedAt as { seconds: number }).seconds
            : 0;
        const newOwnerUserId = [...remaining].sort(
          (a, b) => joinedSeconds(a) - joinedSeconds(b)
        )[0].userId;

        await updateDoc(docRef, {
          ownerId: newOwnerUserId,
          members: remaining.map((m) =>
            this.cleanMember(m, m.userId === newOwnerUserId ? 'owner' : 'member')
          ),
          memberIds: remaining.map((m) => m.userId),
        });
        return true;
      },
      false,
      'Error leaving team:',
      true
    );
  }

  /** Transfer ownership to another member (owner only) */
  async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
        const members: TeamMember[] = team.members || [];

        if (this.ownerOf(team) !== currentOwnerId) return false;
        if (!members.some((m) => m.userId === newOwnerId)) return false;

        const updatedMembers = members.map((m) => {
          if (m.userId === currentOwnerId) return this.cleanMember(m, 'member');
          if (m.userId === newOwnerId) return this.cleanMember(m, 'owner');
          return this.cleanMember(m);
        });

        await updateDoc(docRef, {
          ownerId: newOwnerId,
          members: updatedMembers,
        });
        return true;
      },
      false,
      'Error transferring ownership:',
      true
    );
  }

  /** Kick a member from the team (owner only) */
  async kickMember(teamId: string, ownerUserId: string, targetUserId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
        const members: TeamMember[] = team.members || [];

        if (this.ownerOf(team) !== ownerUserId) return false;
        if (ownerUserId === targetUserId) return false;

        const remaining = members.filter((m) => m.userId !== targetUserId);

        await updateDoc(docRef, {
          members: remaining.map((m) => this.cleanMember(m)),
          memberIds: remaining.map((m) => m.userId),
        });
        return true;
      },
      false,
      'Error kicking member:',
      true
    );
  }

  /** Update the current user's own display name in the team */
  async updateMemberDisplayName(teamId: string, userId: string, newDisplayName: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const members: TeamMember[] = teamDoc.data().members || [];

        // Every other entry is written back untouched: the rules let a
        // member change their own entry and nothing else.
        await updateDoc(docRef, {
          members: members.map((m) =>
            m.userId === userId ? { ...m, displayName: newDisplayName } : m
          ),
        });
        return true;
      },
      false,
      'Error updating member display name:',
      true
    );
  }
}

export const teamService = new TeamService();
