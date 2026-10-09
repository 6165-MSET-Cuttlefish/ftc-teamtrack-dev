import type { SessionFormData } from '@/types';
import { htmlToText } from './htmlText';
import { nextMatchNumber } from './matchNumber';
import { loadStoredSession, readSessionToken } from './sessionPersistence';

/**
 * What signing out would throw away, worded for the "sign out?" question, or
 * null when nothing is at stake. Matches only reach the server when the
 * session is completed, and signing out clears the one in progress: its saved
 * matches, and a match that is still being scored.
 *
 * One consequence and one remedy, e.g. "Signing out discards Match 1 and this
 * unsaved session. Save the match and complete the session to keep them."
 *
 * A session not started yet goes too: notes typed before the first Start are
 * kept on this device like the rest of it, and are never wiped unasked.
 *
 * `completeOffered`: the question has its own "Complete session and sign
 * out" button, so the sentence names the loss and leaves the remedy to it.
 */
export const describeSignOutLoss = (
  sessionData: Pick<
    SessionFormData,
    'isSessionCompleted' | 'matches' | 'notes'
  >,
  matchActive: boolean,
  completeOffered = false
): string | null => {
  if (sessionData.isSessionCompleted) return null;
  const saved = sessionData.matches?.length ?? 0;
  if (saved === 0 && !matchActive) {
    return htmlToText(sessionData.notes ?? '') !== ''
      ? 'Signing out discards the session notes you have typed. Copy them somewhere first to keep them.'
      : null;
  }

  const savedMatches = `${saved} saved ${saved === 1 ? 'match' : 'matches'}`;
  if (!matchActive) {
    const loss = `Signing out discards this unsaved session and its ${savedMatches}.`;
    return completeOffered
      ? loss
      : `${loss} Complete the session to keep ${saved === 1 ? 'it' : 'them'}.`;
  }
  // The match being scored is saved under the number /active gives it: one
  // past the highest saved, not the count (a deleted match leaves a gap).
  const running = `Match ${nextMatchNumber(sessionData.matches)}`;
  const session =
    saved === 0
      ? 'this unsaved session'
      : `this unsaved session with its ${savedMatches}`;
  return `Signing out discards ${running} and ${session}. Save the match and complete the session to keep them.`;
};

/** What the "sign out?" question needs to know about a session */
interface SignOutStake {
  sessionData: Pick<
    SessionFormData,
    'isSessionCompleted' | 'matches' | 'notes'
  >;
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
