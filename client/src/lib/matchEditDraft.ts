import type { MatchScoringFields } from '@/types';
import { pickScoringFields } from './scoring';

/**
 * A saved match open for editing in this tab, with the fields as edited so
 * far. The stored session always holds the live match, never an edit, so
 * the edit is kept beside it, per tab (sessionStorage): a reload, or a phone
 * that dropped the tab while the student was in another app, comes back to
 * the editor as it was instead of losing the fix without a word.
 */
const EDIT_DRAFT_KEY = 'teamtrack-match-edit';

export interface MatchEditDraft {
  matchId: string;
  fields: MatchScoringFields;
}

export const saveMatchEditDraft = (
  matchId: string,
  fields: Partial<MatchScoringFields>
): void => {
  try {
    sessionStorage.setItem(
      EDIT_DRAFT_KEY,
      JSON.stringify({ matchId, fields: pickScoringFields(fields) })
    );
  } catch {
    /* storage unavailable: the edit lasts as long as the page */
  }
};

export const readMatchEditDraft = (): MatchEditDraft | null => {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(EDIT_DRAFT_KEY) ?? ''
    );
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as MatchEditDraft).matchId === 'string' &&
      typeof (value as MatchEditDraft).fields === 'object'
    ) {
      const draft = value as MatchEditDraft;
      return {
        matchId: draft.matchId,
        fields: pickScoringFields(draft.fields ?? {}),
      };
    }
  } catch {
    /* nothing kept, or unreadable */
  }
  return null;
};

export const clearMatchEditDraft = (): void => {
  try {
    sessionStorage.removeItem(EDIT_DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
};
