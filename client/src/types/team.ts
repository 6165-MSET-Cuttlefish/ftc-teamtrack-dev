import type { TimestampValue } from './session';

/** Team member with role information */
export interface TeamMember {
  userId: string;
  email: string;
  displayName?: string;
  joinedAt: TimestampValue;
  role: 'owner' | 'member';
}

/** Team data structure */
export interface Team {
  id: string;
  name: string;
  createdBy: string;
  /** Current owner. Absent on teams saved before it existed — use `createdBy`. */
  ownerId?: string;
  createdAt: TimestampValue;
  members: TeamMember[];
  /** Flat UID array kept in sync with `members` — used by Firestore rules */
  memberIds: string[];
  inviteCode: string;
}

/** What an invite code resolves to, before the user is a member */
export interface TeamInvite {
  code: string;
  teamId: string;
  teamName: string;
}

/** Data needed to create a new team */
export interface CreateTeamData {
  name: string;
  createdBy: string;
  createdByEmail: string;
  createdByName?: string;
}
