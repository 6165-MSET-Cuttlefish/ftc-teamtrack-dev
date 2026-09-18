import type { Session } from '@/types';
import { logger } from './logger';
import { pickScoringFields } from './scoring';

/**
 * Generate a short, safe shareable link for a session.
 *
 * Stores the session snapshot in Firestore (`sharedSessions` collection) under a
 * 7-character base62 short ID and returns `${origin}/shared/preview?id=<shortId>`.
 *
 * Falls back to the legacy base64-in-URL approach if the Firestore write fails
 * (e.g. the user is unauthenticated or rules are not yet deployed).
 */
export const generateShareableLink = async (
  session: Partial<Session>
): Promise<string> => {
  const shareData = {
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

  try {
    const { firebaseService } = await import('@/services');
    const { getFirebase } = await import('@/lib/firebase');
    const firebase = await getFirebase();
    const uid = firebase?.auth?.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const shortId = await firebaseService.createSharedSession(shareData, uid);
    return `${window.location.origin}/shared/preview?id=${shortId}`;
  } catch (primaryError) {
    logger.warn(
      'Firestore share link failed, falling back to base64 URL',
      { error: String(primaryError) }
    );
  }

  // Fallback: base64-encoded URL
  try {
    const jsonStr = JSON.stringify(shareData);
    const bytes = new TextEncoder().encode(jsonStr);
    const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
    const encodedData = btoa(binary);
    return `${window.location.origin}/shared/preview?data=${encodedData}`;
  } catch (fallbackError) {
    logger.error('Error generating shareable link (fallback)', { error: String(fallbackError) });
    throw new Error('Failed to generate shareable link');
  }
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
