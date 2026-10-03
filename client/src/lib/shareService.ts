import { toast } from 'sonner';
import type { Session } from '@/types';
import { pickScoringFields } from './scoring';
import { toDate } from './utils';

/** When a session was recorded, as an ISO string, if it carries a real date */
const recordedAt = (createdAt: Session['createdAt'] | undefined) => {
  if (!createdAt) return undefined;
  const date = toDate(createdAt);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

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
 *
 * `sessionCreatedAt` is when the session was recorded - the snapshot's own
 * `createdAt` is when the link was made. Links made before it was added
 * don't have it.
 */
export const generateShareableLink = async (
  session: Partial<Session> & Pick<Session, 'id' | 'userId'>
): Promise<string> => {
  const shareData = {
    sessionId: session.id,
    sessionOwnerId: session.userId,
    sessionName: session.sessionName,
    sessionType: session.sessionType,
    season: session.season,
    sessionDuration: session.sessionDuration,
    sessionCreatedAt: recordedAt(session.createdAt),
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

/**
 * Copy a share link that has just been made, then run `onCopied`.
 *
 * The link is made over the network before it can be copied, and a browser
 * may refuse the clipboard once the tap that asked for it is over. The link
 * is public either way, so that isn't reported as a failed share: the user
 * gets a button that copies it from a tap of its own, and the link itself to
 * copy by hand if that is refused as well.
 */
export const copyShareLink = async (
  link: string,
  onCopied: () => void
): Promise<void> => {
  try {
    await copyToClipboard(link);
  } catch {
    toast.message('Share link created', {
      description: "Your browser didn't let it be copied automatically.",
      duration: Infinity,
      cancel: { label: 'Dismiss', onClick: () => {} },
      action: {
        label: 'Copy link',
        onClick: () => {
          copyToClipboard(link).then(onCopied, () =>
            toast.error("Couldn't copy the share link", {
              description: link,
              descriptionClassName: 'break-all select-text',
              duration: Infinity,
              cancel: { label: 'Dismiss', onClick: () => {} },
            })
          );
        },
      },
    });
    return;
  }
  onCopied();
};
