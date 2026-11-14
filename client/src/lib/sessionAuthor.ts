import type { Session, Team } from '@/types';

/**
 * Who recorded a session filed under a team, for everyone who sees it there
 * (its author too): the name they go by in the team, else the name saved
 * with the session (kept if they have since left), else an address. A
 * session in no team has no name on it: it is the viewer's own.
 */
export const sessionAuthorName = (
  session: Pick<Session, 'userId' | 'teamId' | 'userName' | 'userEmail'>,
  team: Pick<Team, 'members'> | null | undefined
): string | undefined => {
  if (!session.teamId) return undefined;
  const member = team?.members.find(m => m.userId === session.userId);
  return (
    member?.displayName?.trim() ||
    session.userName?.trim() ||
    member?.email ||
    session.userEmail ||
    undefined
  );
};
