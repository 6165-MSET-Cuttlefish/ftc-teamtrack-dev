// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.

export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA6WhYwzW8quaC9NykmCOAA9tEHc_-KAy8',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'teamtrack-572e5.firebaseapp.com',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'teamtrack-572e5',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'teamtrack-572e5.firebasestorage.app',
      messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '590917117893',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:590917117893:web:f14b58885344da4fcf8dac',
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
