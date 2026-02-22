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
  createdAt: TimestampValue;
  members: TeamMember[];
  /** Flat UID array kept in sync with `members` — used by Firestore rules */
  memberIds: string[];
  inviteCode: string;
}

/** Data needed to create a new team */
export interface CreateTeamData {
  name: string;
  createdBy: string;
  createdByEmail: string;
  createdByName?: string;
}
