import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { FIREBASE_CONFIG } from '@/constants';
import { logger } from './logger';

let cachedFirebase: {
  app: ReturnType<typeof initializeApp>;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  analytics: Analytics | null;
} | null = null;

export async function getFirebase() {
  if (cachedFirebase) {
    return cachedFirebase;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let analytics: Analytics | null = null;
    if (FIREBASE_CONFIG.measurementId) {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
      }
    }

    cachedFirebase = { app, auth, db, analytics };
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
