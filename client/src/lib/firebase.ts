import { FIREBASE_CONFIG } from '@/constants';

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
    // Firebase not available — return null so callers can fallback
    console.warn('Firebase not initialized:', err);
    return null;
  }
}

export default getFirebase;
