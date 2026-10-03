import type { SessionFormData } from '@/types';
import { loadStoredSession, readSessionToken } from './sessionPersistence';

/**
 * What signing out would throw away, worded for the "sign out?" question, or
 * null when nothing is at stake. Matches only reach the server when the
 * session is completed, and signing out clears the one in progress: its saved
 * matches, and a match that is still being scored.
 */
export const describeSignOutLoss = (
  sessionData: Pick<SessionFormData, 'isSessionCompleted' | 'matches'>,
  matchActive: boolean
): string | null => {
  if (sessionData.isSessionCompleted) return null;
  const saved = sessionData.matches?.length ?? 0;
  if (saved === 0 && !matchActive) return null;

  const why =
    "Your session in progress hasn't been completed yet, and signing out clears it.";
  if (saved === 0) {
    return `The match in progress will be lost. ${why} Save the match and complete the session first to keep it.`;
  }
  const matches = `${saved} saved ${saved === 1 ? 'match' : 'matches'}`;
  return matchActive
    ? `${matches} and the match in progress will be lost. ${why} Complete the session first to keep them.`
    : `${matches} will be lost. ${why} Complete the session first to keep ${saved === 1 ? 'it' : 'them'}.`;
};

/** What the "sign out?" question needs to know about a session */
interface SignOutStake {
  sessionData: Pick<SessionFormData, 'isSessionCompleted' | 'matches'>;
  matchActive: boolean;
}

/**
 * The session as the walkthrough found it, for as long as it is open and
 * only if storage had no copy of it at that point.
 */
let walkthroughSession: SignOutStake | null = null;

/**
 * Tell the "sign out?" question what the walkthrough is holding on to: the
 * session as it was when the walkthrough opened (it is put back when the
 * walkthrough closes), or null once it has closed.
 *
 * Only kept when nothing is stored at that moment. A session that was
 * stored is asked about from storage, which also knows if another tab has
 * finished it since; one that was not is a session storage could not take
 * (full, or blocked), and this is then the only record of it.
 */
export const setWalkthroughSession = (session: SignOutStake | null): void => {
  walkthroughSession =
    session !== null && readSessionToken() === null ? session : null;
};

/**
 * The same, for the session in storage. While the tutorial is open the
 * session on screen holds its practice (a match made active for it, matches
 * saved to try it out), all of which goes when it closes. What signing out
 * clears then is the stored session, kept as the tutorial found it — or,
 * when storage could not take it, the copy the tutorial holds in memory.
 */
export const describeStoredSignOutLoss = (): string | null => {
  const stored = loadStoredSession(false);
  if (stored) {
    return describeSignOutLoss(
      stored.sessionData,
      stored.timerState.matchActive ?? false
    );
  }
  return walkthroughSession
    ? describeSignOutLoss(
        walkthroughSession.sessionData,
        walkthroughSession.matchActive
      )
    : null;
};
