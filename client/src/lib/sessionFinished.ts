/**
 * The session a tab last completed, so another tab that had it open can
 * say what became of it rather than turn into a blank new session without
 * a word: `{ matchIds, name, id, at }`.
 */
const FINISHED_KEY = 'teamtrack-session-finished';

/** How long the note answers for the session it names */
const FINISHED_NOTE_MS = 24 * 60 * 60 * 1000;

export interface FinishedSession {
  /** The saved session's id, for its Analysis */
  id: string;
  name: string;
}

export const noteSessionFinished = (
  matchIds: string[],
  session: FinishedSession
): void => {
  try {
    localStorage.setItem(
      FINISHED_KEY,
      JSON.stringify({ matchIds, ...session, at: Date.now() })
    );
  } catch {
    /* storage full or blocked: the other tab says less */
  }
};

/**
 * The session completed in another tab, if it is the one these matches
 * belong to; null when it was not (discarded there, or never completed).
 */
export const finishedSessionOf = (
  matchIds: string[]
): FinishedSession | null => {
  try {
    const note: unknown = JSON.parse(localStorage.getItem(FINISHED_KEY) ?? '');
    if (typeof note !== 'object' || note === null) return null;
    const { matchIds: ids, name, id, at } = note as Record<string, unknown>;
    if (
      !Array.isArray(ids) ||
      typeof name !== 'string' ||
      typeof id !== 'string' ||
      typeof at !== 'number' ||
      Math.abs(Date.now() - at) > FINISHED_NOTE_MS ||
      !matchIds.some(matchId => ids.includes(matchId))
    ) {
      return null;
    }
    return { id, name };
  } catch {
    return null;
  }
};
