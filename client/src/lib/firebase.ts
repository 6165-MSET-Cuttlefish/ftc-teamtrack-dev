import { FIREBASE_CONFIG } from '@/constants';
import { logger } from '@/lib/logger';

// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.
export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    if (errorMsg.includes('FIREBASE_CONFIG') || errorMsg.includes('apiKey')) {
      logger.error('Firebase configuration missing. Check constants/index.ts and .env file');
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      logger.warn('Network error loading Firebase modules. Check your internet connection.');
    } else {
      logger.error('Firebase initialization error', err);
    }
    
    return null;
  }
}

export default getFirebase;
