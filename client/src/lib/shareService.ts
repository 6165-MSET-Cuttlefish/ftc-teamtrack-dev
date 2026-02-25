import type { Session } from '@/types';
import { logger } from './logger';

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
    sessionDuration: session.sessionDuration,
    matchType: session.matchType,
    selectedFeature: session.selectedFeature,
    notes: session.notes || '',
    matches: (session.matches ?? []).map(match => ({
      id: match.id,
      matchNumber: match.matchNumber,
      matchType: match.matchType,
      finalScore: match.finalScore,
      autonomousScore: match.autonomousScore,
      teleopScore: match.teleopScore,
      endGameScore: match.endGameScore,
      autonClassifiedArtifact: match.autonClassifiedArtifact,
      autonOverflowArtifact: match.autonOverflowArtifact,
      autonMotif: match.autonMotif,
      autonLeave: match.autonLeave,
      autonBallsMissed: match.autonBallsMissed,
      teleClassifiedArtifact: match.teleClassifiedArtifact,
      teleOverflowArtifact: match.teleOverflowArtifact,
      teleMotif: match.teleMotif,
      teleBallsMissed: match.teleBallsMissed,
      robot1Park: match.robot1Park,
      robot2Park: match.robot2Park,
      cycleTimes: match.cycleTimes,
      autonShots: match.autonShots,
      teleopShots: match.teleopShots,
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
