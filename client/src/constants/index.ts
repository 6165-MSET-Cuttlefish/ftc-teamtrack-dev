export * from './layout';
export * from './events';

export const APP_CONFIG = {
  name: 'TeamTrack',
  version: '2.0.0',
  description: 'Team performance tracking and analysis',
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  SESSIONS: '/sessions',
  ACTIVE: '/active',
  ANALYSIS: '/analysis',
  COMPARE: '/compare',
  CHARTS: '/charts',
  PROFILE: '/profile',
  SHARED_SESSION: '/shared/preview',
  TEAM_INVITE: '/join/:inviteCode',
} as const;

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
} as const;

export const GAME_TIMING = {
  AUTONOMOUS_DURATION_SECONDS: 30,
  TELEOP_DURATION_SECONDS: 120,
  /** 3s countdown + 30s auto + 120s teleop */
  FULL_GAME_DURATION_SECONDS: 153,
  /** Timer value when autonomous ends and controller pickup begins (= teleop duration) */
  AUTON_END_REMAINING: 120,
  /** Duration of the controller pickup phase (yellow) */
  CONTROLLER_PICKUP_SECONDS: 8,
  /** Match clock value at which the BIOBUZZ endgame (the last 60 s of teleop) begins */
  ENDGAME_REMAINING: 60,
} as const;

/** Season tag written on every new session; older seasons are hidden. */
export const CURRENT_SEASON = 'biobuzz';

export const SESSION_LIMITS = {
  MAX_SESSIONS_PER_USER: 50,
  MAX_CYCLE_TIMES: 100,
  /** Longest session name the name inputs accept */
  MAX_SESSION_NAME_LENGTH: 80,
  /** Maximum sessions to fetch in admin/comparison queries */
  ALL_SESSIONS_QUERY_LIMIT: 100,
} as const;

export const UI_TIMING = {
  DELETE_CONFIRM_TIMEOUT: 5000,
  SHORT_DELAY: 1000,
  MESSAGE_DISPLAY_TIMEOUT: 4000,
  /** How long a deletion can be undone from its toast */
  UNDO_WINDOW: 10000,
} as const;

/**
 * LocalStorage / sessionStorage keys for persistent user preferences and state.
 * All keys use a `teamtrack-` prefix with kebab-case.
 */
export const STORAGE_KEYS = {
  THEME: 'teamtrack-theme',
  TUTORIAL_SEEN: 'teamtrack-tutorial-v2-seen',

  GUEST_PROMPT_DISMISSED: 'teamtrack-guest-prompt-dismissed',
  GUEST_PROMPT_LAST_SHOWN: 'teamtrack-guest-prompt-last-shown',
  HAS_COMPLETED_SESSION: 'teamtrack-has-completed-session',
  SESSION_SCHEMA_VERSION: 'teamtrack-session-schema-version',
  SESSION_DATA: 'teamtrack-session-data',
  SESSION_TIMER: 'teamtrack-session-timer',
  MATCH_TIMER: 'teamtrack-match-timer',
  SESSION_START_TIME: 'teamtrack-session-start-time',
  MATCH_START_TIME: 'teamtrack-match-start-time',
  MATCH_STATE: 'teamtrack-match-state',
  AUDIO_STATE: 'teamtrack-audio-state',
  PENDING_INVITE_CODE: 'teamtrack-pending-invite-code',
  PENDING_INVITE_EXPIRY: 'teamtrack-pending-invite-expiry',
  START_TUTORIAL: 'teamtrack-start-tutorial',
  GUEST_SESSIONS: 'teamtrack-guest-sessions',
  /** Session deletes still inside their undo window, to finish after a reload */
  PENDING_SESSION_DELETES: 'teamtrack-pending-session-deletes',
  /** Own sessions kept private with "Not now" on the Sessions page banner */
  UNSHARED_BANNER_DISMISSED: 'teamtrack-unshared-banner-dismissed',
  /**
   * Match ids of the last session one tab saved after another tab had
   * discarded it, so that tab's Undo can't put a stored session back
   */
  SESSION_SAVED_ELSEWHERE: 'teamtrack-session-saved-elsewhere',
  /** Whether Session Notes on the scoring page was left open on this device */
  NOTES_EXPANDED: 'teamtrack-notes-expanded',
} as const;
