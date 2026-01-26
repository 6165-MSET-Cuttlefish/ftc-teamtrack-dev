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
  ORIGINAL: '/original',
  ANALYSIS: '/analysis',
  COMPARE: '/compare',
  CHARTS: '/charts',
  PROFILE: '/profile',
} as const;

/**
 * Firebase configuration
 * Note: These API keys are safe to expose in client-side code.
 * Firebase security is enforced through Firestore security rules and authentication.
 * For production, consider using environment variables.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA6WhYwzW8quaC9NykmCOAA9tEHc_-KAy8',
  authDomain: 'teamtrack-572e5.firebaseapp.com',
  projectId: 'teamtrack-572e5',
  storageBucket: 'teamtrack-572e5.firebasestorage.app',
  messagingSenderId: '590917117893',
  appId: '1:590917117893:web:f14b58885344da4fcf8dac',
  measurementId: 'G-WTN320D7S5',
} as const;

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
  MAX_THEORETICAL_SCORE: 150,
} as const;

export const SESSION_LIMITS = {
  MAX_SESSIONS_PER_USER: 50,
  MAX_CYCLE_TIMES: 100,
} as const;
