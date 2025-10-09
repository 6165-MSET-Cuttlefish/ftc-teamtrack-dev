// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.

export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };

    const app = initializeApp(firebaseConfig);
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
