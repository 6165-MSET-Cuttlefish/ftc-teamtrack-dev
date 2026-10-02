/**
 * The team invite someone opened before they had an account to accept it
 * with.
 *
 * The join page remembers the code and sends them to sign in; whichever page
 * signs them in (or up) sends them back to it. The code is forgotten once it
 * expires, is used, or is turned down.
 */

import { ROUTES, STORAGE_KEYS } from '@/constants';

/** Forget the remembered invite. */
export const clearPendingInvite = (): void => {
  localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_CODE);
  localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
};

/**
 * Where to send someone who has just signed in or signed up: the join page
 * of the invite they opened, or `fallback` when there is none. An invite
 * that has expired is forgotten here rather than left to be found later.
 */
export const getPendingInviteDestination = (fallback: string): string => {
  const code = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_CODE);
  const expiry = Number(
    localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY)
  );

  if (!code || !expiry || Date.now() > expiry) {
    clearPendingInvite();
    return fallback;
  }

  return ROUTES.TEAM_INVITE.replace(':inviteCode', encodeURIComponent(code));
};
