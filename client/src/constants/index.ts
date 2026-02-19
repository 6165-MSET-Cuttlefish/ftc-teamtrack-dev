// Application-wide constants

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

/**
 * Firebase configuration
 * These are public keys used by the web client (not secrets)
 * Firebase security is enforced through Firestore security rules and authentication
 */
const getFirebaseConfig = () => {
  return {
    apiKey: 'AIzaSyA6WhYwzW8quaC9NykmCOAA9tEHc_-KAy8',
    authDomain: 'teamtrack-572e5.firebaseapp.com',
    projectId: 'teamtrack-572e5',
    storageBucket: 'teamtrack-572e5.firebasestorage.app',
    messagingSenderId: '590917117893',
    appId: '1:590917117893:web:f14b58885344da4fcf8dac',
    measurementId: 'G-WTN320D7S5',
  } as const;
};

export const FIREBASE_CONFIG = getFirebaseConfig();

export const SCORING = {
  AUTON_CLASSIFIED_ARTIFACT: 3,
  AUTON_OVERFLOW_ARTIFACT: 1,
  AUTON_MOTIF: 2,
  AUTON_LEAVE: 3,
  TELE_CLASSIFIED_ARTIFACT: 3,
  TELE_OVERFLOW_ARTIFACT: 1,
  TELE_MOTIF: 2,
} as const;

export const GAME_TIMING = {
  AUTONOMOUS_DURATION_SECONDS: 30,
  TELEOP_DURATION_SECONDS: 120,
  FULL_GAME_DURATION_SECONDS: 150,
  /** Remaining seconds when autonomous ends and controller pickup begins */
  AUTON_END_REMAINING: 120,
  /** Duration of the controller pickup phase (yellow) */
  CONTROLLER_PICKUP_SECONDS: 5,
  /** Duration of the prepare phase */
  PREPARE_SECONDS: 3,
  MAX_THEORETICAL_SCORE: 150,
} as const;

export const SESSION_LIMITS = {
  MAX_SESSIONS_PER_USER: 50,
  MAX_CYCLE_TIMES: 100,
} as const;

/**
 * UI Timing constants for animations, timeouts, and delays
 */
export const UI_TIMING = {
  // Delete confirmation auto-dismiss (milliseconds)
  DELETE_CONFIRM_TIMEOUT: 5000,
  // Tutorial transition delay
  TUTORIAL_TRANSITION_DELAY: 100,
  // Generic short toast display duration
  SHORT_DELAY: 1000,
  // Session limit check timeout
  SESSION_LIMIT_CHECK_DELAY: 2000,
} as const;

/**
 * LocalStorage keys for persistent user preferences and state
 */
export const STORAGE_KEYS = {
  THEME: 'teamtrack-theme',
  TUTORIALS_SEEN: 'teamtrack_tutorials_seen',
} as const;
