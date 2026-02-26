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
  EDIT_SESSION: '/edit-session',
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
  /** 3s countdown + 30s auto + 120s teleop (1.61s audio intro handled externally) */
  FULL_GAME_DURATION_SECONDS: 153,
  /** Timer value when autonomous ends and controller pickup begins (= teleop duration) */
  AUTON_END_REMAINING: 120,
  /** Duration of the controller pickup phase (yellow) */
  CONTROLLER_PICKUP_SECONDS: 8,
  /** Duration of the audio intro before countdown (seconds) */
  AUDIO_INTRO_SECONDS: 1.15,
  MAX_THEORETICAL_SCORE: 150,
} as const;

export const SESSION_LIMITS = {
  MAX_SESSIONS_PER_USER: 50,
  MAX_CYCLE_TIMES: 100,
  /** Maximum sessions to fetch in admin/comparison queries */
  ALL_SESSIONS_QUERY_LIMIT: 100,
} as const;

export const UI_TIMING = {
  DELETE_CONFIRM_TIMEOUT: 5000,
  TUTORIAL_TRANSITION_DELAY: 100,
  SHORT_DELAY: 1000,
  SESSION_LIMIT_CHECK_DELAY: 2000,
  MESSAGE_DISPLAY_TIMEOUT: 4000,
} as const;

/**
 * LocalStorage / sessionStorage keys for persistent user preferences and state.
 * All keys use a `teamtrack-` prefix with kebab-case.
 */
export const STORAGE_KEYS = {
  THEME: 'teamtrack-theme',
  TUTORIAL_SEEN: 'teamtrack-tutorial-v1-seen',
  KEYBIND_TUTORIAL_SEEN: 'teamtrack-keybind-tutorial-seen',
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
  GATE_SCORING_ENABLED: 'teamtrack-gate-scoring-enabled',
  MOTIF_SCORING_ENABLED: 'teamtrack-motif-scoring-enabled',
} as const;
