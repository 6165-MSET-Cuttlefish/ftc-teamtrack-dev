/**
 * Live sessions: a host shares the session they are scoring with their team
 * (liveSessions/{hostId}), so teammates can watch it or score Robot 2 from
 * their own device. See firestore.rules for who may write what.
 */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase, logger, toShotVolley } from '@/lib';
import { ShownError } from '@/lib/failure';
import { normalizeSession } from '@/lib/sessionNormalize';
import type { LiveRobot2, LiveSession, MatchScoringFields } from '@/types';

const COLLECTION = 'liveSessions';

/** A host's live session counts as gone once it has been this quiet */
export const LIVE_STALE_MS = 3 * 60 * 1000;
/** How often a live host says it is still there, between changes */
export const LIVE_HEARTBEAT_MS = 60 * 1000;

/** What the host writes; the rest is the server's or the Robot 2 scorer's */
export type LiveHostWrite = Omit<LiveSession, 'updatedAt' | 'robot2'>;

const db = async (): Promise<Firestore> => {
  const fb = await getFirebase();
  if (!fb) throw new ShownError("Couldn't reach the server.");
  return fb.db;
};

/** Firestore takes no `undefined`: drop it wherever it is */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const toRobot2 = (raw: unknown): LiveRobot2 | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const shots = Array.isArray(r.shots)
    ? r.shots.flatMap(s => {
        const volley = toShotVolley(s);
        return volley ? [volley] : [];
      })
    : [];
  return {
    scorerId: typeof r.scorerId === 'string' ? r.scorerId : null,
    scorerName: typeof r.scorerName === 'string' ? r.scorerName : '',
    match: typeof r.match === 'string' ? r.match : '',
    leave: r.leave === true,
    parkAuto: r.parkAuto === true,
    parkTeleop: r.parkTeleop === true,
    shots,
  };
};

/** A live session as stored, or null where it isn't one */
const toLive = (
  id: string,
  data: DocumentData | undefined
): LiveSession | null => {
  if (!data || typeof data.teamId !== 'string' || !data.clock) return null;
  // The match's fields read like a saved match's, through the same checks
  const match = normalizeSession(
    { userId: id, matches: [{ id: 'live', ...(data.fields ?? {}) }] },
    id
  ).matches[0] as unknown as MatchScoringFields | undefined;
  const at = data.updatedAt as { toMillis?: () => number } | null | undefined;
  return {
    hostId: id,
    hostName: typeof data.hostName === 'string' ? data.hostName : 'A teammate',
    teamId: data.teamId,
    sessionName: String(data.sessionName ?? ''),
    sessionType: String(data.sessionType ?? 'Practice'),
    matchType: String(data.matchType ?? 'Full Game'),
    matchNumber: Number(data.matchNumber) || 1,
    matchKey: String(data.matchKey ?? ''),
    clock: data.clock,
    state: {
      matchActive: data.state?.matchActive === true,
      editing: data.state?.editing === true,
      completed: data.state?.completed === true,
    },
    fields: {
      ...(match ?? ({} as MatchScoringFields)),
      robotCount: data.fields?.robotCount === 1 ? 1 : 2,
    },
    savedScores: Array.isArray(data.savedScores)
      ? data.savedScores.map(Number)
      : [],
    robot2: toRobot2(data.robot2),
    // A write still on its way has no server time yet: it is now
    updatedAt: at?.toMillis ? at.toMillis() : Date.now(),
  };
};

/** Robot 2's values as kept in the match's fields */
export const robot2FromFields = (
  fields: Partial<MatchScoringFields>
): Pick<LiveRobot2, 'leave' | 'parkAuto' | 'parkTeleop' | 'shots'> => ({
  leave: fields.robot2Leave === true,
  parkAuto: fields.robot2ParkAuto === true,
  parkTeleop: fields.robot2ParkTeleop === true,
  shots: (fields.shots ?? []).flatMap(e => {
    if (e.robot !== 2) return [];
    const volley = toShotVolley(e);
    return volley ? [volley] : [];
  }),
});

export const liveService = {
  /** Start sharing: the whole document, with nobody on Robot 2 yet */
  async start(write: LiveHostWrite): Promise<void> {
    await setDoc(doc(await db(), COLLECTION, write.hostId), {
      ...clean(write),
      robot2: null,
      updatedAt: serverTimestamp(),
    });
  },

  /** The host's latest; never touches Robot 2 */
  async publish(write: LiveHostWrite): Promise<void> {
    await updateDoc(doc(await db(), COLLECTION, write.hostId), {
      ...clean(write),
      updatedAt: serverTimestamp(),
    });
  },

  /** The host clearing Robot 2 for the next match, keeping its scorer */
  async resetRobot2(hostId: string, robot2: LiveRobot2): Promise<void> {
    await updateDoc(doc(await db(), COLLECTION, hostId), {
      robot2: clean(robot2),
      updatedAt: serverTimestamp(),
    });
  },

  async stop(hostId: string): Promise<void> {
    await deleteDoc(doc(await db(), COLLECTION, hostId));
  },

  /** One live session as it changes; null once it is gone */
  watch(
    hostId: string,
    onChange: (live: LiveSession | null) => void,
    onError?: (err: unknown) => void
  ): () => void {
    let stop: Unsubscribe | null = null;
    let closed = false;
    void db()
      .then(firestore => {
        if (closed) return;
        stop = onSnapshot(
          doc(firestore, COLLECTION, hostId),
          snap => onChange(snap.exists() ? toLive(snap.id, snap.data()) : null),
          err => {
            logger.warn('Live session watch failed', { err });
            onError?.(err);
          }
        );
      })
      .catch(err => onError?.(err));
    return () => {
      closed = true;
      stop?.();
    };
  },

  /** The team's live sessions, still being kept up, as they change */
  watchTeam(
    teamId: string,
    onChange: (live: LiveSession[]) => void
  ): () => void {
    let stop: Unsubscribe | null = null;
    let closed = false;
    void db()
      .then(firestore => {
        if (closed) return;
        stop = onSnapshot(
          query(
            collection(firestore, COLLECTION),
            where('teamId', '==', teamId)
          ),
          snap =>
            onChange(
              snap.docs.flatMap(d => {
                const live = toLive(d.id, d.data());
                return live ? [live] : [];
              })
            ),
          err => logger.warn('Team live sessions watch failed', { err })
        );
      })
      .catch(err => logger.warn('Team live sessions unavailable', { err }));
    return () => {
      closed = true;
      stop?.();
    };
  },

  /**
   * Take Robot 2, starting from what the host already has for it. Fails
   * when someone else has it.
   */
  async claimRobot2(hostId: string, uid: string, name: string): Promise<void> {
    const firestore = await db();
    const ref = doc(firestore, COLLECTION, hostId);
    await runTransaction(firestore, async tx => {
      const snap = await tx.get(ref);
      const live = snap.exists() ? toLive(snap.id, snap.data()) : null;
      if (!live) throw new ShownError('This session is no longer live.');
      const holder = live.robot2?.scorerId;
      if (holder && holder !== uid) {
        throw new ShownError(
          `${live.robot2?.scorerName || 'A teammate'} is already scoring Robot 2.`
        );
      }
      const robot2: LiveRobot2 = {
        scorerId: uid,
        scorerName: name,
        match: live.matchKey,
        ...robot2FromFields(live.fields),
      };
      tx.update(ref, { robot2: clean(robot2) });
    });
  },

  /** Let go of Robot 2; what was scored stays in the host's match */
  async releaseRobot2(hostId: string): Promise<void> {
    await updateDoc(doc(await db(), COLLECTION, hostId), {
      'robot2.scorerId': null,
    });
  },

  /** The Robot 2 scorer's values for the match being played */
  async writeRobot2(hostId: string, robot2: LiveRobot2): Promise<void> {
    await updateDoc(doc(await db(), COLLECTION, hostId), {
      robot2: clean(robot2),
    });
  },
};
