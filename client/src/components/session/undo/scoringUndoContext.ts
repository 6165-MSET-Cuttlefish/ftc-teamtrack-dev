import { createContext, useContext } from 'react';

/** Stepping back through the scoring changes of the match in the fields */
export interface ScoringUndo {
  /** There is a change in this match to step back */
  canUndo: boolean;
  /** What the next undo puts back, for the menu ("Hive Tips") */
  nextLabel: string | null;
  /** Step back the last change; false when there was none */
  undo: () => boolean;
}

const OFF: ScoringUndo = {
  canUndo: false,
  nextLabel: null,
  undo: () => false,
};

export const ScoringUndoContext = createContext<ScoringUndo>(OFF);

export const useScoringUndo = (): ScoringUndo => useContext(ScoringUndoContext);

/** The shortcut as a laptop shows it */
export const UNDO_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? '⌘Z'
    : 'Ctrl+Z';
