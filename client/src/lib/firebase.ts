// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.

export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  } catch (err) {
    // Firebase not available — return null so callers can fallback
    // eslint-disable-next-line no-console
    console.warn('Firebase not initialized:', err);
    return null;
  }
}

export default getFirebase;
