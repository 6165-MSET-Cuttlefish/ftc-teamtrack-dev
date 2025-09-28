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
  user: User | null;
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

  const signup = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
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
