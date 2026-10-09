/**
 * What to tell someone when signing in, signing up, resetting a password or
 * changing account details fails.
 *
 * Firebase's own text is developer text ("Firebase: Error
 * (auth/wrong-password)."), so the message is chosen by the error's code and
 * the raw string is never shown. The codes are the ones in the installed
 * firebase auth bundle (AuthErrorCode).
 */

/** A way out worth offering next to the message. */
export type AuthErrorAction = 'forgot-password' | 'sign-in' | 'sign-up';

export interface AuthErrorInfo {
  message: string;
  action?: AuthErrorAction;
  /** The 'auth/...' code behind the message; null when there was none */
  code: string | null;
}

/**
 * Where the error happened, for the few codes that read differently there:
 * - 'reset': asking for a reset link, where there is no password to be wrong
 * - 'reauth': confirming the current password of an account already signed in
 */
export type AuthErrorContext = 'sign-in' | 'reset' | 'reauth';

export const GENERIC_AUTH_ERROR = 'Something went wrong. Try again.';

/** The password didn't match. Production reports an unknown email the same way. */
const WRONG_CREDENTIAL_CODES = [
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
];

/** The user closed or abandoned the sign-in window: nothing went wrong. */
const CANCELLED_CODES = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
];

const MESSAGES: Record<string, Omit<AuthErrorInfo, 'code'>> = {
  'auth/email-already-in-use': {
    message: 'That email already has an account.',
    action: 'sign-in',
  },
  'auth/account-exists-with-different-credential': {
    message: 'That email already has an account with a different sign-in method.',
    action: 'sign-in',
  },
  'auth/too-many-requests': {
    message: 'Too many attempts. Wait a few minutes and try again.',
  },
  'auth/network-request-failed': {
    message: "Couldn't reach the server. Check your connection and try again.",
  },
  'auth/weak-password': {
    message: 'That password is too weak. Use at least 6 characters.',
  },
  'auth/invalid-email': { message: 'Enter a valid email address.' },
  'auth/missing-password': { message: 'Enter your password.' },
  'auth/user-disabled': { message: 'This account has been disabled.' },
  'auth/popup-blocked': {
    message:
      'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  },
  'auth/requires-recent-login': {
    message:
      'For security, please sign out and sign back in before making this change.',
  },
  'auth/user-mismatch': {
    message: 'That is a different account. Use the one you are signed in with.',
  },
};

/**
 * The 'auth/...' code of an error: its `code`, or one named in its message
 * (errors that were re-thrown as plain Errors keep it only there).
 */
export const authErrorCode = (err: unknown): string | null => {
  if (typeof err === 'object' && err !== null) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && code.startsWith('auth/')) return code;
    if (typeof message === 'string') {
      const named = message.match(/auth\/[a-z0-9-]+/);
      if (named) return named[0];
    }
  } else if (typeof err === 'string') {
    const named = err.match(/auth\/[a-z0-9-]+/);
    if (named) return named[0];
  }
  return null;
};

/** True when the error means the password that was typed is wrong. */
export const isWrongPasswordError = (err: unknown): boolean => {
  const code = authErrorCode(err);
  return code === 'auth/invalid-credential' || code === 'auth/wrong-password';
};

/**
 * The message for a failed auth call, or null when there is nothing to say
 * (the user closed the Google window themselves).
 */
export const mapAuthError = (
  err: unknown,
  context: AuthErrorContext = 'sign-in'
): AuthErrorInfo | null => {
  const code = authErrorCode(err);

  if (code) {
    if (CANCELLED_CODES.includes(code)) return null;

    if (WRONG_CREDENTIAL_CODES.includes(code)) {
      if (context === 'reauth') {
        return { message: 'That password is incorrect.', code };
      }
      if (context === 'reset') {
        return {
          message: 'No account uses that email. Check the spelling.',
          action: 'sign-up',
          code,
        };
      }
      // One message for all three: with email-enumeration protection on,
      // a wrong password and an unknown email are the same error.
      return {
        message: 'Email or password is incorrect.',
        action: 'forgot-password',
        code,
      };
    }

    const known = MESSAGES[code];
    if (known) {
      // Already signed in: "sign in instead" is no way out.
      return context === 'reauth'
        ? { message: known.message, code }
        : { ...known, code };
    }
    return { message: GENERIC_AUTH_ERROR, code };
  }

  // The app's own errors ("Authentication service unavailable. Please
  // refresh the page.") are written for the user. Anything else — another
  // Firebase service, a TypeError — is not.
  if (
    err instanceof Error &&
    err.name === 'Error' &&
    !('code' in err) &&
    err.message &&
    !/firebase/i.test(err.message)
  ) {
    return { message: err.message, code: null };
  }

  return { message: GENERIC_AUTH_ERROR, code: null };
};
