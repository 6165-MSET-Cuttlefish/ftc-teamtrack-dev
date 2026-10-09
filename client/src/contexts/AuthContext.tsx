import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { getFirebase, logger, clearSessionFromStorage, clearHasCompletedSession } from '@/lib';
import { markLeavingTeam, unmarkLeavingTeam } from '@/lib/leavingTeams';
import { STORAGE_KEYS } from '@/constants';
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
  getAdditionalUserInfo?: (
    credential: UserCredential
  ) => { isNewUser: boolean } | null;
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

// Shown as they are under the sign-in forms and on Profile (lib/authErrors
// passes the app's own messages through), so each says what to do next.
/** The sign-in code never arrived (the page was loaded offline) */
const AUTH_NOT_LOADED =
  "Sign-in didn't load. Check your connection, then reload the page.";
/** Part of the sign-in code is missing for want of a connection */
const AUTH_OFFLINE =
  "Couldn't reach the server. Check your connection and try again.";
/** Signed out in another tab (or the session expired) mid-change */
const SIGNED_OUT = "You're signed out. Sign in again, then try again.";

/**
 * A new account is the guest's own, so the sessions they saved in this
 * browser move into it (see lib/guestImport). Not waited for: Sessions
 * shows the move while it runs, and reads the list again once it is done.
 */
const moveGuestSessions = (uid: string, email: string | null) => {
  void import('@/lib/guestImport')
    .then(({ moveGuestSessionsIntoNewAccount }) =>
      moveGuestSessionsIntoNewAccount(uid, email)
    )
    .catch(error => logger.error('Could not move guest sessions', error));
};

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
      throw new Error(AUTH_NOT_LOADED);
    }

    if (!authModule?.createUserWithEmailAndPassword) {
      throw new Error(AUTH_OFFLINE);
    }

    const userCredential = await authModule.createUserWithEmailAndPassword(
      authInstance,
      email,
      password
    );
    if (userCredential.user && authModule.updateProfile) {
      await authModule.updateProfile(userCredential.user, { displayName });
      // The auth listener has usually stored this user already, from before
      // the name was set, and a profile update does not fire it again.
      const { uid } = userCredential.user;
      setUser(prev => (prev?.uid === uid ? { ...prev, displayName } : prev));
    }
    moveGuestSessions(userCredential.user.uid, userCredential.user.email);
  };

  const login = async (email: string, password: string) => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(AUTH_NOT_LOADED);
    }

    if (!authModule?.signInWithEmailAndPassword) {
      throw new Error(AUTH_OFFLINE);
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
      throw new Error(AUTH_NOT_LOADED);
    }

    if (!authModule?.sendPasswordResetEmail) {
      throw new Error(AUTH_OFFLINE);
    }

    await authModule.sendPasswordResetEmail(authInstance, email);
  };

  const updateDisplayName = async (displayName: string) => {
    const { authInstance, authModule } = await ensureAuth();
    if (!authInstance || !authModule?.updateProfile) {
      throw new Error(AUTH_NOT_LOADED);
    }
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error(SIGNED_OUT);
    await authModule.updateProfile(currentUser, { displayName });
    setUser(prev => (prev ? { ...prev, displayName } : prev));
  };

  const updateUserEmail = async (newEmail: string, currentPassword: string) => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error(AUTH_NOT_LOADED);
    const currentUser = authInstance.currentUser;
    if (!currentUser || !currentUser.email) throw new Error(SIGNED_OUT);
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
    if (!authInstance) throw new Error(AUTH_NOT_LOADED);
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error(SIGNED_OUT);
    const rawModule = await import('firebase/auth');
    await rawModule.sendEmailVerification(currentUser);
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    const { authInstance } = await ensureAuth();
    if (!authInstance) throw new Error(AUTH_NOT_LOADED);
    const currentUser = authInstance.currentUser;
    if (!currentUser || !currentUser.email) throw new Error(SIGNED_OUT);
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
    if (!authInstance) throw new Error(AUTH_NOT_LOADED);
    const currentUser = authInstance.currentUser;
    if (!currentUser) throw new Error(SIGNED_OUT);

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
      throw new Error('Enter your password to delete your account.');
    }

    // Remove the user's data while they are still signed in — the rules only
    // let an account delete its own documents. Then leave the team, which
    // hands it to another member (or deletes it if they were the only one).
    //
    // The data goes first because it is the step that can be retried:
    // leaving gives the team away for good, so it only happens once the data
    // is gone. If leaving then fails, nothing is lost that the user hadn't
    // asked to delete, and trying again finishes the job.
    //
    // Every step either finishes or throws: the login is only deleted once
    // the data is confirmed gone and the team left, because afterwards
    // nobody is left who is allowed to do either. The team list is asked of
    // the server directly (a cached or failed lookup reads as "no teams"),
    // and checked again after leaving in case a step reported success
    // without doing anything.
    const uid = currentUser.uid;
    const [{ firebaseService }, { teamService }] = await Promise.all([
      import('@/services/firebaseService'),
      import('@/services/teamService'),
    ]);
    await firebaseService.deleteAllUserData(uid);
    const notLeft =
      "Your sessions and share links were deleted, but you couldn't be " +
      'removed from your team, so your account is still here. Try again.';
    try {
      for (const teamId of await firebaseService.getUserTeamIds(uid)) {
        // Chosen, not a removal: no "You're no longer a member" notice.
        markLeavingTeam(teamId);
        try {
          await teamService.leaveTeam(teamId, uid);
        } catch (error) {
          unmarkLeavingTeam(teamId);
          throw error;
        }
      }
    } catch (error) {
      logger.error('Error leaving team while deleting account', error);
      throw new Error(notLeft);
    }
    if ((await firebaseService.getUserTeamIds(uid)).length > 0) {
      throw new Error(notLeft);
    }

    await rawModule.deleteUser(currentUser);
    clearSessionFromStorage();
    clearHasCompletedSession();
    setUser(null);
    // A guest from here on, at once rather than when the sign-in listener
    // catches up: the page they go to is the guest start, not a sign-in.
    becomeGuest();
  };

  const loginWithGoogle = async () => {
    const { authInstance, authModule } = await ensureAuth();

    if (!authInstance) {
      throw new Error(AUTH_NOT_LOADED);
    }

    if (!authModule?.signInWithPopup || !authModule?.GoogleAuthProvider) {
      throw new Error(AUTH_OFFLINE);
    }

    const provider = new authModule.GoogleAuthProvider();
    const credential = await authModule.signInWithPopup(authInstance, provider);
    // A Google account seen for the first time is a sign-up, whichever
    // page it came from.
    if (authModule.getAdditionalUserInfo?.(credential)?.isNewUser) {
      moveGuestSessions(credential.user.uid, credential.user.email);
    }
  };

  // Module-scoped flag survives React StrictMode double-mount
  const guestToastShownRef = useRef(false);

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

  /** A guest now, for good: the sign-in listener leaves it at that. */
  const becomeGuest = () => {
    guestToastShownRef.current = true;
    continueAsGuest();
  };

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
              // A guest who signs in has already been shown around in this
              // browser, so the account doesn't get the first-run tutorial
              // again.
              const convertedGuestId =
                localStorage.getItem(GUEST_MODE_KEY) === 'true'
                  ? localStorage.getItem(GUEST_ID_KEY)
                  : null;
              if (
                convertedGuestId &&
                localStorage.getItem(
                  `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${convertedGuestId}`
                )
              ) {
                localStorage.setItem(
                  `${STORAGE_KEYS.TUTORIAL_SEEN}-${u.uid}`,
                  'true'
                );
              }
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
