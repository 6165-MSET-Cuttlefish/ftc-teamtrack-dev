import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Lazy-load Firebase functions at runtime. If Firebase isn't installed or configured,
// the app will continue to work in a degraded mode (no auth) instead of crashing.
import getFirebase from '../lib/firebase';

// Types for functions we may dynamically import
type FirebaseAuthModule = {
  User?: any;
  signInWithEmailAndPassword?: any;
  createUserWithEmailAndPassword?: any;
  signOut?: any;
  onAuthStateChanged?: any;
  updateProfile?: any;
  sendPasswordResetEmail?: any;
  GoogleAuthProvider?: any;
  signInWithPopup?: any;
};

let firebaseAuthModule: FirebaseAuthModule | null = null; // populated when available
let firebaseAuth: any = null; // the auth instance if available

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to lazy-initialize Firebase auth and auth module
  const ensureAuth = async () => {
    if (firebaseAuth && firebaseAuthModule) {
      return { authInstance: firebaseAuth, authModule: firebaseAuthModule };
    }

    const firebase = await getFirebase();
    if (!firebase) return { authInstance: null, authModule: null };

    try {
      const authModule = await import('firebase/auth');
      firebaseAuthModule = authModule as FirebaseAuthModule;
      firebaseAuth = firebase.auth;
      return { authInstance: firebaseAuth, authModule: firebaseAuthModule };
    } catch (err) {
      // Could not load firebase/auth dynamic module
      // eslint-disable-next-line no-console
      console.warn('Firebase auth module not available:', err);
      return { authInstance: null, authModule: null };
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule || !authModule.createUserWithEmailAndPassword) {
      throw new Error('Auth not configured');
    }
    const userCredential = await authModule.createUserWithEmailAndPassword(authInstance, email, password);
    if (userCredential.user && authModule.updateProfile) {
      await authModule.updateProfile(userCredential.user, { displayName });
    }
  };

  const login = async (email: string, password: string) => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule || !authModule.signInWithEmailAndPassword) {
      throw new Error('Auth not configured');
    }
    await authModule.signInWithEmailAndPassword(authInstance, email, password);
  };

  const logout = async () => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule || !authModule.signOut) {
      return;
    }
    await authModule.signOut(authInstance);
  };

  const resetPassword = async (email: string) => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule || !authModule.sendPasswordResetEmail) {
      throw new Error('Auth not configured');
    }
    await authModule.sendPasswordResetEmail(authInstance, email);
  };

  const loginWithGoogle = async () => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule || !authModule.signInWithPopup || !authModule.GoogleAuthProvider) {
      throw new Error('Auth not configured');
    }
    const provider = new authModule.GoogleAuthProvider();
    await authModule.signInWithPopup(authInstance, provider);
  };

  useEffect(() => {
    let unsubscribe: any = () => {};

    (async () => {
      const { authInstance, authModule } = await ensureAuth();
      if (authInstance && authModule && authModule.onAuthStateChanged) {
        unsubscribe = authModule.onAuthStateChanged(authInstance, (u: any) => {
          setUser(u);
          setLoading(false);
        });
      } else {
        // No firebase available — proceed without auth
        setUser(null);
        setLoading(false);
      }
    })();

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    loginWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
