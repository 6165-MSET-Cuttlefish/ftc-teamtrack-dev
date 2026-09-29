export { getFirebase } from './firebase';
export {
  cn,
  toDate,
  formatDate,
  formatTime,
  getDisplayTimer,
  generateId,
  getInitials,
  isAbortError,
  getErrorMessage,
} from './utils';
export { logger } from './logger';
export {
  hasCompletedASession,
  markSessionCompleted,
  saveSessionToStorage,
  loadSessionFromStorage,
  loadTimerStateFromStorage,
  clearSessionFromStorage,
  clearHasCompletedSession,
  hasActiveSession,
} from './sessionPersistence';
export { generateShareableLink, copyToClipboard } from './shareService';
export { sanitizeHtml } from './sanitize';
export {
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from './guestSessions';
export {
  POINTS,
  calculateScore,
  calculateTotal,
  scoreRows,
  emptyScoringFields,
  pickScoringFields,
  cycleTimesOf,
  RANKING_POINTS,
  includesAuto,
  includesTeleop,
  robotRates,
  isCurrentSeasonSession,
} from './scoring';
