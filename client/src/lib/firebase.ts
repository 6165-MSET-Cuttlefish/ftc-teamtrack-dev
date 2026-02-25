import { FIREBASE_CONFIG } from '@/constants';
import { logger } from './logger';

let cachedFirebase: {
  app: ReturnType<typeof import('firebase/app').initializeApp>;
  auth: ReturnType<typeof import('firebase/auth').getAuth>;
  db: ReturnType<typeof import('firebase/firestore').getFirestore>;
} | null = null;

export async function getFirebase() {
  if (cachedFirebase) {
    return cachedFirebase;
  }

  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const app =
      getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

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
