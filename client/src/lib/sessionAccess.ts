/**
 * Sessions that stay with a team the viewer is no longer in.
 *
 * A session filed under a team stays with that team when its author leaves
 * or is removed: the team keeps its scouting history. The Firestore rules
 * only let someone still in the team change it, so for its author it is
 * view-only from then on (they can still delete it). Every page says so in
 * the same words.
 */

import type { Session } from '@/types';
import { knownTeamName } from './knownTeams';

/**
 * Whether `session` is filed under a team other than the viewer's (`teamId`,
 * undefined outside a team): 'elsewhere', or 'here' for a session in the
 * viewer's team or in none. 'unknown' while the viewer's team is still
 * loading, and for the team they were last seen in while it can't be
 * checked (`unconfirmedTeamId`, see TeamContext): nothing is said about a
 * team they may well still be in, and nothing is offered that only works
 * if they are.
 */
export const teamFiling = (
  session: Pick<Session, 'teamId'>,
  viewer: {
    teamId?: string;
    teamLoading?: boolean;
    unconfirmedTeamId?: string | null;
  }
): 'here' | 'elsewhere' | 'unknown' => {
  if (!session.teamId || session.teamId === viewer.teamId) return 'here';
  return viewer.teamLoading || session.teamId === viewer.unconfirmedTeamId
    ? 'unknown'
    : 'elsewhere';
};

/** The team a session is filed under, by name when this browser knows it. */
export const filedUnderName = (
  session: Pick<Session, 'teamId'>
): string | undefined =>
  session.teamId ? knownTeamName(session.teamId) : undefined;

/** Why a session filed under a team the viewer has left can't be changed. */
export const viewOnlyNote = (teamName: string | undefined): string =>
  teamName
    ? `Filed under ${teamName}. You're no longer in that team, so it's view-only.`
    : "Filed under a team you're no longer in, so it's view-only.";
