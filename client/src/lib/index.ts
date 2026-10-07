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
  clearSessionFromStorage,
  clearHasCompletedSession,
  hasActiveSession,
  hasDraftContent,
  isWorthStoring,
} from './sessionPersistence';
export { nextMatchNumber } from './matchNumber';
export {
  generateShareableLink,
  copyToClipboard,
  copyShareLink,
  countShareLinks,
} from './shareService';
export {
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from './guestSessions';
export {
  POINTS,
  calculateScore,
  calculateTotal,
  matchScore,
  scoreRows,
  ELEMENT_ORDER,
  GROUPED_ELEMENT_ORDER,
  emptyScoringFields,
  pickScoringFields,
  normalizeForMatchType,
  cycleTimesOf,
  RANKING_POINTS,
  rankingPoints,
  rankingPointNames,
  rankingPointTally,
  FIELD_LIMITS,
  FIELD_HINTS,
  COUNT_LABELS,
  EACH_LABELS,
  MIXED_MATCH_TYPE,
  sessionMatchType,
  liveMatchType,
  includesAuto,
  includesTeleop,
  DEFAULT_ROBOT_COUNT,
  robotCountOf,
  robotRates,
} from './scoring';
export { formatPoints } from './points';
export { isCurrentSeasonSession } from './sessionNormalize';
export type {
  ScoringInput,
  ScoreRow,
  RankingPoints,
  RankingPointTally,
} from './scoring';
export {
  buildSessionsCsv,
  buildLegacySessionsCsv,
  csvFileName,
  downloadCsv,
  isoDate,
} from './csv';
export { htmlToText } from './htmlText';
export {
  SORT_LABELS,
  DEFAULT_SORT,
  sortSessions,
  sortFromParam,
  bestScore,
  isArchived,
  archivedFor,
  inArchiveView,
} from './sessionFilters';
export type { SortOption, ArchiveViewer } from './sessionFilters';
export {
  ELEMENT_LABELS,
  FLOWERS_LABEL,
  ELEMENT_COLORS,
  CHART_COLORS,
  RANKING_POINT_COLORS,
  SERIES_COLORS,
  toneOf,
} from './scoringLabels';
export type { Tone } from './scoringLabels';
export {
  GENERIC_AUTH_ERROR,
  authErrorCode,
  isWrongPasswordError,
  mapAuthError,
} from './authErrors';
export type {
  AuthErrorAction,
  AuthErrorContext,
  AuthErrorInfo,
} from './authErrors';
