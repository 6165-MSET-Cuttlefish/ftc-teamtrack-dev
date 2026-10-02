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
  /**
   * Current owner. Absent on teams saved before it existed, where the owner
   * is the member whose role is 'owner' — see `teamService.ownerOf`.
   */
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

/**
 * A team the user has just been added to. `loaded` is false when the join
 * was written but the team could not be read back, so `team` holds only what
 * the invite told us (its id, name and the user's own member entry).
 */
export interface JoinedTeam {
  team: Team;
  loaded: boolean;
}

/** How an attempt to join a team by invite code ended */
export type JoinTeamResult =
  | { status: 'joined'; team: Team }
  /** Joined, but the team's details could not be loaded yet */
  | { status: 'joined-unloaded'; team: Team }
  /** The user chose to stay in the team they are already in */
  | { status: 'cancelled'; teamName: string }
  /** The code does not match any team */
  | { status: 'invalid' };

/** Data needed to create a new team */
export interface CreateTeamData {
  name: string;
  createdBy: string;
  createdByEmail: string;
  createdByName?: string;
}
