/**
 * Cross-cutting custom event names used for inter-component communication.
 * Centralised here so every producer/consumer references the same constant.
 */

export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';
export const TUTORIAL_ENDED_EVENT = 'teamtrack-tutorial-ended';

/**
 * Fired to open the team dialogs, which live in `TeamManager` (rendered on
 * the Sessions and Profile pages). Nothing happens if the user is not in a
 * team.
 */

/** Open "Share sessions with <team>": pick own sessions to share with it. */
export const OPEN_SHARE_SESSIONS_EVENT = 'teamtrack-open-share-sessions';

/** Open the team dialog (invite link, members, leave). */
export const OPEN_TEAM_DIALOG_EVENT = 'teamtrack-open-team-dialog';

/**
 * Router state that opens the team dialog on arrival, for getting to it
 * from a page without a `TeamManager` (the account menu does).
 */
export const OPEN_TEAM_DIALOG_STATE = { openTeamDialog: true } as const;

/** Pages that render a `TeamManager`, so take `OPEN_TEAM_DIALOG_EVENT` */
export const TEAM_MANAGER_PATHS: readonly string[] = ['/sessions', '/profile'];
