export { getFirebase } from './firebase';
export {
  cn,
  toDate,
  formatDate,
  formatTime,
  getDisplayTimer,
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
export { getVideoDuration, extractFrames } from './frameExtraction';
export type { ExtractedFrame } from './frameExtraction';
