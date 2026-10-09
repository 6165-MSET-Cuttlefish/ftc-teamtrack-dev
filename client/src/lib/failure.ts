/**
 * What a failure toast says under its title: what happened in plain words
 * and what to do next. Firebase's own text ("Failed to get document because
 * the client is offline.") is never shown; its errors are told apart by
 * their code instead.
 */

/** An error whose message is written for the user, to be shown as it is. */
export class ShownError extends Error {}

/** The fallback: most failures here are a lost connection. */
const TRY_AGAIN = 'Check your connection and try again.';

/** Firestore error code ('permission-denied', 'unavailable', ...), or '' */
const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code).replace(/^firestore\//, '')
    : '';

/**
 * Why something failed and what to do next, for a toast's description.
 * `nothingChanged` says so when the server wasn't reached for a change.
 * `reading` is for a load or an export, which changes nothing: a refusal
 * then says there's no access, not no permission to change the session.
 */
export const failureReason = (
  error: unknown,
  {
    nothingChanged = false,
    reading = false,
  }: { nothingChanged?: boolean; reading?: boolean } = {}
): string => {
  if (error instanceof ShownError) return error.message;
  switch (errorCode(error)) {
    case 'permission-denied':
    case 'unauthenticated':
      return reading
        ? "Your account doesn't have access. Check you're signed in to the right account."
        : "You don't have permission to change this session.";
    case 'unavailable':
    case 'deadline-exceeded':
      return nothingChanged
        ? `Couldn't reach the server, so nothing was changed. ${TRY_AGAIN}`
        : `Couldn't reach the server. ${TRY_AGAIN}`;
    case 'invalid-argument':
      return "The server couldn't save this session. It may be too large.";
    case 'resource-exhausted':
      return 'The server is over its usage limit right now. Try again later.';
  }
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') {
      return "This browser's storage is full, so the change wasn't saved.";
    }
    if (error.message === 'Session not found') {
      return 'This session no longer exists.';
    }
  }
  return TRY_AGAIN;
};
