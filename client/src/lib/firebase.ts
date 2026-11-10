import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '@/constants';
import { logger } from './logger';

let cachedFirebase: {
  app: ReturnType<typeof initializeApp>;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
} | null = null;

export async function getFirebase() {
  if (cachedFirebase) {
    return cachedFirebase;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Local testing only (`.env.emulator`): the Firebase emulators, never
    // the real project
    if (import.meta.env.VITE_USE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, '127.0.0.1', 8085);
    }

    cachedFirebase = { app, auth, db };
    return cachedFirebase;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (errorMsg.includes('FIREBASE_CONFIG') || errorMsg.includes('apiKey')) {
      logger.error(
        'Firebase configuration missing. Check constants/index.ts and .env file'
      );
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      logger.warn(
        'Network error loading Firebase modules. Check your internet connection.'
      );
    } else {
      logger.error('Firebase initialization error', err);
    }

    return null;
  }
}
