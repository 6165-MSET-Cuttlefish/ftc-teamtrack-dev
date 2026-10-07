/**
 * "Complete session", asked for from outside the scoring page: the sign-out
 * question offers it, since completing is what keeps the matches. The save
 * itself belongs to /active, which picks the request up as it opens (or at
 * once, if it is open) and calls `onSaved` once the session is stored. A
 * request that can't go ahead is answered there, with the reason.
 */
export interface CompleteRequest {
  onSaved: () => void;
}

let pending: CompleteRequest | null = null;
const listeners = new Set<() => void>();

/** Ask /active to complete the open session. */
export const requestCompleteSession = (request: CompleteRequest): void => {
  pending = request;
  listeners.forEach(listener => listener());
};

/** The request waiting to be acted on, if any; taken, so it runs once. */
export const takeCompleteRequest = (): CompleteRequest | null => {
  const request = pending;
  pending = null;
  return request;
};

/** Hear of requests made from now on, until the returned function is called. */
export const onCompleteRequest = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
