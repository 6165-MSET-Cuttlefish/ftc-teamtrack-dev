/**
 * Environment variable validation utilities
 */

interface EnvConfig {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

export const validateEnvironment = (): EnvConfig => {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const;

  const config: EnvConfig = {};
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const value = import.meta.env[varName];
    if (!value || value.startsWith('your-')) {
      missing.push(varName);
    } else {
      config[varName] = value;
    }
  }

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or deployment configuration.'
    );
  }

  // Environment validation warning removed for cleaner production builds

  return config;
};

export const getFirebaseConfig = () => {
  const env = validateEnvironment();
  
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: env.VITE_FIREBASE_APP_ID || 'demo-app-id',
  };
};