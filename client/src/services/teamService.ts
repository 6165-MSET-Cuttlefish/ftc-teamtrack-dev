import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
  type Firestore,
} from 'firebase/firestore';
import getFirebase from '@/lib/firebase';
import { isAbortError } from '@/lib/utils';
import type { Team, CreateTeamData, TeamMember } from '@/types';

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
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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
          createdAt: Timestamp.now(),
          inviteCode,
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
        return { id: docRef.id, ...newTeam } as Team;
      },
      null,
      'Error creating team:',
      true
    );
  }

  /** Get team by ID */
  async getTeam(teamId: string): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return null;
        
        return { id: docSnap.id, ...docSnap.data() } as Team;
      },
      null,
      'Error fetching team:'
    );
  }

  /** Get team by invite code */
  async getTeamByInviteCode(inviteCode: string): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const q = query(
          collection(db, 'teams'),
          where('inviteCode', '==', inviteCode.toUpperCase())
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Team;
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
        
        // We need to query all teams and filter client-side since array-contains
        // doesn't work well with nested objects
        const allTeamsQuery = query(collection(db, 'teams'));
        const snapshot = await getDocs(allTeamsQuery);
        
        return snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Team))
          .filter(team => 
            team.members.some(member => member.userId === userId)
          );
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
        const team = await this.getTeamByInviteCode(inviteCode);
        if (!team) {
          throw new Error('Invalid invite code');
        }

        // Check if user is already a member
        if (team.members.some(m => m.userId === userId)) {
          return team; // Already a member
        }

        const db = await this.getDB();
        const docRef = doc(db, 'teams', team.id);
        
        const newMember: TeamMember = {
          userId,
          email: userEmail,
          displayName: displayName || '',
          joinedAt: Timestamp.now(),
          role: 'member',
        };

        await updateDoc(docRef, {
          members: arrayUnion(newMember),
        });

        return {
          ...team,
          members: [...team.members, newMember],
        };
      },
      null,
      'Error joining team:',
      true
    );
  }

  /** Update team name */
  async updateTeamName(teamId: string, name: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        await updateDoc(docRef, { name });
        return true;
      },
      false,
      'Error updating team name:',
      true
    );
  }

  /** Regenerate invite code */
  async regenerateInviteCode(teamId: string): Promise<string | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const newCode = this.generateInviteCode();
        const docRef = doc(db, 'teams', teamId);
        await updateDoc(docRef, { inviteCode: newCode });
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

  /** Leave a team (remove user from members array) */
  async leaveTeam(teamId: string, userId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const teamData = teamDoc.data();
        const members: TeamMember[] = teamData.members || [];
        const leavingMember = members.find((m) => m.userId === userId);
        const remaining = members.filter((m) => m.userId !== userId);

        // If the owner is leaving, transfer ownership to the oldest member
        let newOwnerUserId: string | null = null;
        if (leavingMember?.role === 'owner' && remaining.length > 0) {
          // Pick the first remaining member (oldest by join time) as new owner
          // Fallback: just use remaining[0] if timestamp sorting fails
          try {
            const sorted = [...remaining].sort((a, b) => {
              const aTime = a.joinedAt && typeof a.joinedAt === 'object' && 'seconds' in a.joinedAt
                ? (a.joinedAt as { seconds: number }).seconds
                : 0;
              const bTime = b.joinedAt && typeof b.joinedAt === 'object' && 'seconds' in b.joinedAt
                ? (b.joinedAt as { seconds: number }).seconds
                : 0;
              return aTime - bTime;
            });
            newOwnerUserId = sorted[0].userId;
          } catch {
            newOwnerUserId = remaining[0].userId;
          }
        }

        const updatedMembers = remaining.map((m) =>
          this.cleanMember(m, m.userId === newOwnerUserId ? 'owner' : undefined)
        );

        await updateDoc(docRef, { members: updatedMembers });
        return true;
      },
      false,
      'Error leaving team:',
      true
    );
  }

  /** Transfer ownership to another member */
  async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const teamData = teamDoc.data();
        const members: TeamMember[] = teamData.members || [];

        const currentOwner = members.find((m) => m.userId === currentOwnerId);
        if (!currentOwner || currentOwner.role !== 'owner') return false;

        const updatedMembers = members.map((m) => {
          if (m.userId === currentOwnerId) return this.cleanMember(m, 'member');
          if (m.userId === newOwnerId) return this.cleanMember(m, 'owner');
          return this.cleanMember(m);
        });

        await updateDoc(docRef, { members: updatedMembers });
        return true;
      },
      false,
      'Error transferring ownership:',
      true
    );
  }

  /** Update a member's display name in the team */
  async updateMemberDisplayName(teamId: string, userId: string, newDisplayName: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const teamData = teamDoc.data();
        const members: TeamMember[] = teamData.members || [];

        const updatedMembers = members.map((m) => {
          const clean = this.cleanMember(m);
          if (m.userId === userId) clean.displayName = newDisplayName;
          return clean;
        });

        await updateDoc(docRef, { members: updatedMembers });
        return true;
      },
      false,
      'Error updating member display name:',
      true
    );
  }
}

export const teamService = new TeamService();
