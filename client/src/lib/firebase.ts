// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.

export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    // Validate required environment variables
    const requiredConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    // Check for missing configuration
    const missingKeys = Object.entries(requiredConfig)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key);

    if (missingKeys.length > 0) {
      throw new Error(
        `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
        'Please check your .env file and ensure all VITE_FIREBASE_* variables are set.'
      );
    }

    console.log('Initializing Firebase with project:', requiredConfig.projectId);
    
    const app = initializeApp(requiredConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    return null;
  }
}

export default getFirebase;
