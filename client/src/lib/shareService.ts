import type { Session } from '@/types';
import { pickScoringFields } from './scoring';

/**
 * Generate a short, safe shareable link for a saved session.
 *
 * Stores a snapshot in Firestore (`sharedSessions` collection) under a
 * 7-character base62 short ID and returns `${origin}/shared/preview?id=<shortId>`.
 *
 * The snapshot records which session it came from and who owns that session,
 * so the owner can take every link down again (and deleting the session does
 * so automatically). There is deliberately no fallback that encodes the
 * session into the URL itself: a link like that could never be revoked.
 */
export const generateShareableLink = async (
  session: Partial<Session> & Pick<Session, 'id' | 'userId'>
): Promise<string> => {
  const shareData = {
    sessionId: session.id,
    sessionOwnerId: session.userId,
    sessionName: session.sessionName,
    sessionType: session.sessionType,
    sessionDuration: session.sessionDuration,
    matchType: session.matchType,
    selectedFeature: session.selectedFeature,
    notes: session.notes || '',
    matches: (session.matches ?? []).map(match => ({
      ...pickScoringFields(match),
      id: match.id,
      matchNumber: match.matchNumber,
      matchType: match.matchType,
      finalScore: match.finalScore,
    })),
  };

  const { firebaseService } = await import('@/services');
  const { getFirebase } = await import('@/lib/firebase');
  const firebase = await getFirebase();
  const uid = firebase?.auth?.currentUser?.uid;
  if (!uid) throw new Error('Sign in to share sessions');
  const shortId = await firebaseService.createSharedSession(shareData, uid);
  return `${window.location.origin}/shared/preview?id=${shortId}`;
};

/**
 * Copy text to clipboard with fallback for older browsers
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      textArea.remove();
    } catch {
      textArea.remove();
      throw new Error('Failed to copy to clipboard');
    }
  }
};
