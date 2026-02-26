import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { getFirebase, logger, clearSessionFromStorage, clearHasCompletedSession } from '@/lib';
import type { User } from '@/types';
import type {
  Auth,
  User as FirebaseUser,
  UserCredential,
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
} from 'firebase/auth';

type FirebaseAuthModule = {
  signInWithEmailAndPassword?: (
    auth: Auth,
    email: string,
    password: string
  ) => Promise<UserCredential>;
  createUserWithEmailAndPassword?: (
    auth: Auth,
    email: string,
    password: string
  ) => Promise<UserCredential>;
  signOut?: (auth: Auth) => Promise<void>;
  onAuthStateChanged?: (
    auth: Auth,
    callback: (user: FirebaseUser | null) => void
  ) => () => void;
  updateProfile?: (
    user: FirebaseUser,
    profile: { displayName?: string; photoURL?: string }
  ) => Promise<void>;
  updateEmail?: (user: FirebaseUser, email: string) => Promise<void>;
  sendPasswordResetEmail?: (auth: Auth, email: string) => Promise<void>;
  GoogleAuthProvider?: new () => FirebaseGoogleAuthProvider;
  signInWithPopup?: (
    auth: Auth,
    provider: FirebaseGoogleAuthProvider
  ) => Promise<UserCredential>;
};

let firebaseAuthModule: FirebaseAuthModule | null = null;
let firebaseAuth: Auth | null = null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  guestId: string | null;
  signup: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const GUEST_ID_KEY = 'teamtrack-guest-id';
const GUEST_MODE_KEY = 'teamtrack-guest-mode';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);

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
      const errorContext =
        err instanceof Error ? { message: err.message } : undefined;
      logger.warn('Firebase auth module not available', errorContext);
      return { authInstance: null, authModule: null };
    }
  };

  const signup = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(
        'Authentication service unavailable. Please refresh the page.'
      );
    }

    if (!authModule?.createUserWithEmailAndPassword) {
      throw new Error(
        'Sign-up service unavailable. Please check your internet connection.'
      );
    }

    const userCredential = await authModule.createUserWithEmailAndPassword(
      authInstance,
      email,
      password
    );
    if (userCredential.user && authModule.updateProfile) {
      await authModule.updateProfile(userCredential.user, { displayName });
    }
  };

  const login = async (email: string, password: string) => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(
        'Authentication service unavailable. Please refresh the page.'
      );
    }

    if (!authModule?.signInWithEmailAndPassword) {
      throw new Error(
        'Sign-in service unavailable. Please check your internet connection.'
      );
    }

    await authModule.signInWithEmailAndPassword(authInstance, email, password);
  };

  const logout = async () => {
    const { authInstance, authModule } = await ensureAuth();

    if (isGuest) {
      localStorage.removeItem(GUEST_MODE_KEY);
      localStorage.removeItem(GUEST_ID_KEY);
      clearSessionFromStorage();
      clearHasCompletedSession();
      setIsGuest(false);
      setGuestId(null);
      setUser(null);
      return;
    }

    clearSessionFromStorage();
    clearHasCompletedSession();

    if (!authInstance || !authModule || !authModule.signOut) return;
    await authModule.signOut(authInstance);
  };

  const resetPassword = async (email: string) => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(
        'Authentication service unavailable. Please refresh the page.'
      );
    }

    if (!authModule?.sendPasswordResetEmail) {
      throw new Error(
        'Password reset service unavailable. Please check your internet connection.'
      );
    }

    await authModule.sendPasswordResetEmail(authInstance, email);
  };

  const updateDisplayName = async (displayName: string) => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule?.updateProfile) {
      throw new Error('Update service unavailable.');
    }
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error('No authenticated user.');
    await authModule.updateProfile(currentUser, { displayName });
    setUser(prev => (prev ? { ...prev, displayName } : prev));
  };

  const updateUserEmail = async (newEmail: string, currentPassword: string) => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error('Authentication service unavailable.');
    const currentUser = authInstance.currentUser;
    if (!currentUser || !currentUser.email)
      throw new Error('No authenticated user.');
    const rawModule = await import('firebase/auth');
    const credential = rawModule.EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );
    await rawModule.reauthenticateWithCredential(currentUser, credential);
    await rawModule.updateEmail(currentUser, newEmail);
    setUser(prev => (prev ? { ...prev, email: newEmail } : prev));
  };

  const sendVerificationEmail = async () => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error('Authentication service unavailable.');
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error('No authenticated user.');
    const rawModule = await import('firebase/auth');
    await rawModule.sendEmailVerification(currentUser);
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error('Authentication service unavailable.');
    const currentUser = authInstance.currentUser;
    if (!currentUser || !currentUser.email)
      throw new Error('No authenticated user.');
    const rawModule = await import('firebase/auth');
    const credential = rawModule.EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );
    await rawModule.reauthenticateWithCredential(currentUser, credential);
    await rawModule.updatePassword(currentUser, newPassword);
  };

  const deleteAccount = async (currentPassword?: string) => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error('Authentication service unavailable.');
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error('No authenticated user.');

    const rawModule = await import('firebase/auth');
    const providerId = currentUser.providerData?.[0]?.providerId;

    if (providerId === 'google.com') {
      const provider = new rawModule.GoogleAuthProvider();
      await rawModule.reauthenticateWithPopup(currentUser, provider);
    } else if (currentPassword && currentUser.email) {
      const credential = rawModule.EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await rawModule.reauthenticateWithCredential(currentUser, credential);
    } else {
      throw new Error('Password is required to delete your account.');
    }

    await rawModule.deleteUser(currentUser);
    setUser(null);
  };

  const loginWithGoogle = async () => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(
        'Authentication service unavailable. Please refresh the page.'
      );
    }

    if (!authModule?.signInWithPopup || !authModule?.GoogleAuthProvider) {
      throw new Error(
        'Google Sign-In unavailable. Please check your internet connection.'
      );
    }

    const provider = new authModule.GoogleAuthProvider();
    await authModule.signInWithPopup(authInstance, provider);
  };

  const continueAsGuest = () => {
    let guestUserId = localStorage.getItem(GUEST_ID_KEY);

    if (!guestUserId) {
      guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(GUEST_ID_KEY, guestUserId);
    }

    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setIsGuest(true);
    setGuestId(guestUserId);
    setLoading(false);
  };

  // Module-scoped flag survives React StrictMode double-mount
  const guestToastShownRef = useRef(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    (async () => {
      const guestMode = localStorage.getItem(GUEST_MODE_KEY);
      const storedGuestId = localStorage.getItem(GUEST_ID_KEY);

      if (guestMode === 'true' && storedGuestId) {
        setIsGuest(true);
        setGuestId(storedGuestId);
        guestToastShownRef.current = true; // returning guest — don't show toast again
      }

      // Always set up Firebase auth listener even for guests
      const { authInstance, authModule } = await ensureAuth();
      if (authInstance && authModule && authModule.onAuthStateChanged) {
        unsubscribe = authModule.onAuthStateChanged(
          authInstance,
          (u: FirebaseUser | null) => {
            if (u) {
              const user: User = {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
                providerId: u.providerData?.[0]?.providerId || 'password',
                emailVerified: u.emailVerified,
              };
              setUser(user);
              localStorage.removeItem(GUEST_MODE_KEY);
              setIsGuest(false);
              setGuestId(null);
            } else {
              setUser(null);
              if (!guestToastShownRef.current) {
                guestToastShownRef.current = true;
                let autoGuestId = localStorage.getItem(GUEST_ID_KEY);
                if (!autoGuestId) {
                  autoGuestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                  localStorage.setItem(GUEST_ID_KEY, autoGuestId);
                }
                localStorage.setItem(GUEST_MODE_KEY, 'true');
                setIsGuest(true);
                setGuestId(autoGuestId);
              }
            }
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        if (!guestToastShownRef.current) {
          guestToastShownRef.current = true;
          let autoGuestId = localStorage.getItem(GUEST_ID_KEY);
          if (!autoGuestId) {
            autoGuestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            localStorage.setItem(GUEST_ID_KEY, autoGuestId);
          }
          localStorage.setItem(GUEST_MODE_KEY, 'true');
          setIsGuest(true);
          setGuestId(autoGuestId);
        }
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
    isGuest,
    guestId,
    signup,
    login,
    logout,
    resetPassword,
    loginWithGoogle,
    continueAsGuest,
    updateDisplayName,
    updateUserEmail,
    sendVerificationEmail,
    updateUserPassword,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
