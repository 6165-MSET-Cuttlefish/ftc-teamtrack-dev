import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
      // Load analytics lazily and never let it break app startup: the
      // firebase/analytics chunk is frequently blocked by ad/privacy
      // extensions (ERR_BLOCKED_BY_CLIENT), which would otherwise take
      // down the whole module graph if imported statically.
      try {
        const { getAnalytics, isSupported } = await import(
          'firebase/analytics'
        );
        if (await isSupported()) {
          analytics = getAnalytics(app);
        }
      } catch (analyticsErr) {
        logger.warn(
          'Firebase Analytics unavailable (often blocked by an ad/privacy extension); continuing without it.',
          {
            reason:
              analyticsErr instanceof Error
                ? analyticsErr.message
                : String(analyticsErr),
          }
        );
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
