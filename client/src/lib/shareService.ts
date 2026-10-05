import { toast } from 'sonner';
import type { DocumentData, Firestore } from 'firebase/firestore';
import type { Session } from '@/types';
import { pickScoringFields } from './scoring';
import { toDate } from './utils';

/** When a session was recorded, as an ISO string, if it carries a real date */
const recordedAt = (createdAt: Session['createdAt'] | undefined) => {
  if (!createdAt) return undefined;
  const date = toDate(createdAt);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** The session as a share link stores it: what the link shows. */
const snapshotOf = (
  session: Partial<Session> & Pick<Session, 'id' | 'userId'>
) => ({
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
});

/**
 * A value as JSON with every object's keys in order, so two snapshots that
 * hold the same things compare equal however their fields were ordered.
 */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : inner
  );

/** When a stored link was made, in ms (0 when it has no usable date) */
const madeAt = (data: DocumentData): number => {
  const value: unknown = data.createdAt;
  if (!value) return 0;
  const ms = toDate(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Firestore and the signed-in user, or null when nobody is signed in */
const signedInFirestore = async (): Promise<{
  db: Firestore;
  uid: string;
} | null> => {
  const { getFirebase } = await import('@/lib/firebase');
  const firebase = await getFirebase();
  const uid = firebase?.auth?.currentUser?.uid;
  return firebase?.db && uid ? { db: firebase.db, uid } : null;
};

/**
 * The link `uid` already made of this exact snapshot, if any: copying a
 * session again before anything in it has changed hands out the same link
 * instead of making another one. The newest such link wins.
 */
const sameSnapshotLink = async (
  db: Firestore,
  uid: string,
  snapshot: ReturnType<typeof snapshotOf>
): Promise<string | null> => {
  const { collection, getDocsFromServer, query, where } = await import(
    'firebase/firestore'
  );
  const made = await getDocsFromServer(
    query(
      collection(db, 'sharedSessions'),
      where('createdBy', '==', uid),
      where('sessionId', '==', snapshot.sessionId)
    )
  );
  // Stored as JSON (no undefined fields), plus who made it and when.
  const wanted = canonical(JSON.parse(JSON.stringify(snapshot)));
  const same = made.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => {
      const { createdBy: _by, createdAt: _at, ...stored } = data;
      return canonical(stored) === wanted;
    })
    .sort((a, b) => madeAt(b.data) - madeAt(a.data));
  return same[0]?.id ?? null;
};

/**
 * Generate a short, safe shareable link for a saved session.
 *
 * Stores a snapshot in Firestore (`sharedSessions` collection) under a
 * 7-character base62 short ID and returns `${origin}/shared/preview?id=<shortId>`.
 * A link this user already made of the session as it is now is handed out
 * again instead (the snapshot never changes, so it shows the same thing).
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
  const shareData = snapshotOf(session);

  const { firebaseService } = await import('@/services');
  const signedIn = await signedInFirestore();
  if (!signedIn) throw new Error('Sign in to share sessions');
  // Not finding one is no reason not to share: a new link is made instead.
  const shortId =
    (await sameSnapshotLink(signedIn.db, signedIn.uid, shareData).catch(
      () => null
    )) ?? (await firebaseService.createSharedSession(shareData, signedIn.uid));
  return `${window.location.origin}/shared/preview?id=${shortId}`;
};

/** Match IDs in a stored list of matches */
const matchIdsOf = (matches: unknown): string[] =>
  Array.isArray(matches)
    ? matches
        .map(match => (match as { id?: unknown } | null)?.id)
        .filter((id): id is string => typeof id === 'string' && id !== '')
    : [];

/**
 * Whether a share link saved before links recorded their `sessionId` was
 * made from this session (the same test the Firestore service uses when it
 * takes a session's links down).
 */
const isLegacyLinkOf = (
  share: DocumentData,
  session: Pick<Partial<Session>, 'matches' | 'sessionName' | 'notes'>
): boolean => {
  if (typeof share.sessionId === 'string') return false;
  const shared = matchIdsOf(share.matches);
  const current = new Set(matchIdsOf(session.matches));
  if (shared.length > 0) return shared.some(id => current.has(id));
  return (
    current.size === 0 &&
    typeof share.sessionName === 'string' &&
    share.sessionName === session.sessionName &&
    (share.notes || '') === (session.notes || '')
  );
};

/**
 * Each user's links saved before links recorded their `sessionId`, by link
 * ID, holding only what `isLegacyLinkOf` reads. Read once per visit: no more
 * can be made (the rules require a `sessionId`), so the set only shrinks,
 * and a link taken down since is found gone when it is next counted.
 */
const legacyLinksByUser = new Map<string, Promise<Map<string, DocumentData>>>();

const readLegacyLinks = async (
  db: Firestore,
  uid: string
): Promise<Map<string, DocumentData>> => {
  const { collection, getCountFromServer, getDocsFromServer, query, where } =
    await import('firebase/firestore');
  const made = query(
    collection(db, 'sharedSessions'),
    where('createdBy', '==', uid)
  );
  // Two counts first, which download nothing: when every link they made
  // names them as its session's owner, every one records its session (the
  // two fields came in together) and there is nothing to read.
  const [all, ofOwn] = await Promise.all([
    getCountFromServer(made),
    getCountFromServer(query(made, where('sessionOwnerId', '==', uid))),
  ]);
  const legacy = new Map<string, DocumentData>();
  if (all.data().count === ofOwn.data().count) return legacy;
  for (const d of (await getDocsFromServer(made)).docs) {
    const data = d.data();
    if (typeof data.sessionId === 'string') continue;
    legacy.set(d.id, {
      sessionName: data.sessionName,
      notes: data.notes,
      matches: matchIdsOf(data.matches).map(id => ({ id })),
    });
  }
  return legacy;
};

const legacyLinksOf = (db: Firestore, uid: string) => {
  let links = legacyLinksByUser.get(uid);
  if (!links) {
    const reading = readLegacyLinks(db, uid);
    // Couldn't look is not "none": the next count looks again.
    reading.catch(() => {
      if (legacyLinksByUser.get(uid) === reading) legacyLinksByUser.delete(uid);
    });
    legacyLinksByUser.set(uid, reading);
    links = reading;
  }
  return links;
};

/**
 * How many share links of a session the signed-in user can take down: every
 * link anyone made of it if it is theirs, otherwise the ones they made. The
 * same links "Stop sharing" removes (`firebaseService.deleteSharedSessions`).
 *
 * Links are counted by the server, not downloaded, so a count costs one
 * read however many links the user has made. Only links older than the
 * `sessionId` field are looked at one by one (see `legacyLinksOf`).
 * Throws when the server can't be reached or nobody is signed in.
 */
export const countShareLinks = async (
  session: Pick<Session, 'id' | 'userId'> &
    Pick<Partial<Session>, 'matches' | 'sessionName' | 'notes'>
): Promise<number> => {
  const signedIn = await signedInFirestore();
  if (!signedIn) throw new Error('Sign in to share sessions');
  const { db, uid } = signedIn;
  const {
    collection,
    doc,
    getCountFromServer,
    getDocFromServer,
    query,
    where,
  } = await import('firebase/firestore');
  const shared = collection(db, 'sharedSessions');
  const [recorded, legacy] = await Promise.all([
    // Firestore rules only list links the requester can be shown to own. A
    // link names its session's owner, so the owner's count holds their own.
    getCountFromServer(
      query(
        shared,
        where(
          session.userId === uid ? 'sessionOwnerId' : 'createdBy',
          '==',
          uid
        ),
        where('sessionId', '==', session.id)
      )
    ),
    legacyLinksOf(db, uid),
  ]);
  // Older links of this session (seldom any) may have been taken down since
  // they were read, here or elsewhere: each is asked after again.
  const older = [...legacy]
    .filter(([, data]) => isLegacyLinkOf(data, session))
    .map(([id]) => id);
  const live = await Promise.all(
    older.map(id => getDocFromServer(doc(shared, id)).then(d => d.exists()))
  );
  older.forEach((id, i) => {
    if (!live[i]) legacy.delete(id);
  });
  return recorded.data().count + live.filter(Boolean).length;
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
