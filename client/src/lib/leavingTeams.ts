/**
 * Teams the user is leaving on purpose from somewhere other than the team
 * dialog, which tells TeamContext itself: deleting the account leaves every
 * team. Losing one of these is not news, so the "You're no longer a member"
 * notice isn't shown for it.
 */

const leaving = new Set<string>();

/** About to leave `teamId` on purpose. */
export const markLeavingTeam = (teamId: string): void => {
  leaving.add(teamId);
};

/** Leaving `teamId` didn't happen after all. */
export const unmarkLeavingTeam = (teamId: string): void => {
  leaving.delete(teamId);
};

/** Whether the user chose to leave `teamId`. */
export const isLeavingTeam = (teamId: string): boolean => leaving.has(teamId);
