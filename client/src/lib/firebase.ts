import { FIREBASE_CONFIG } from '@/constants';
import { logger } from '@/lib/logger';

// Cache the Firebase instances to prevent reinitialization
let cachedFirebase: {
  app: ReturnType<typeof import('firebase/app').initializeApp>;
  auth: ReturnType<typeof import('firebase/auth').getAuth>;
  db: ReturnType<typeof import('firebase/firestore').getFirestore>;
} | null = null;

// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.
export async function getFirebase() {
  // Return cached instance if available
  if (cachedFirebase) {
    return cachedFirebase;
  }

  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    // Check if an app already exists to prevent duplicate initialization
    const app =
      getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Cache the instances
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

export default getFirebase;
