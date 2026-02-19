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

  /** Leave a team (remove user from members array) */
  async leaveTeam(teamId: string, userId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) return false;

        const teamData = teamDoc.data();
        const updatedMembers = (teamData.members || []).filter(
          (m: TeamMember) => m.userId !== userId
        );

        const docRef = doc(db, 'teams', teamId);
        await updateDoc(docRef, { members: updatedMembers });
        return true;
      },
      false,
      'Error leaving team:',
      true
    );
  }
}

export const teamService = new TeamService();
