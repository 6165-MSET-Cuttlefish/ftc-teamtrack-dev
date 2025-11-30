// Lazy firebase initializer. Uses dynamic imports so dev server won't fail if Firebase isn't configured or installed.

export async function getFirebase() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: 'AIzaSyA6WhYwzW8quaC9NykmCOAA9tEHc_-KAy8',
      authDomain: 'teamtrack-572e5.firebaseapp.com',
      projectId: 'teamtrack-572e5',
      storageBucket: 'teamtrack-572e5.firebasestorage.app',
      messagingSenderId: '590917117893',
      appId: '1:590917117893:web:f14b58885344da4fcf8dac',
      measurementId: 'G-WTN320D7S5',
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
