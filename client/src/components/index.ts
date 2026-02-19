// Auth components
export { GuestPrompt, HomeRedirect, ProtectedRoute } from './auth';

// Common/shared components
export { ErrorBoundary, Header } from './common';

// Session feature components
export {
  ActiveTutorial,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_RESTART_EVENT,
  LivePreview,
  MatchForm,
  Notes,
  PerformanceMetrics,
  ScoringUI,
  SessionSetup,
  ShareButton,
} from './session';

// Team components
export { default as TeamManager } from './TeamManager';
