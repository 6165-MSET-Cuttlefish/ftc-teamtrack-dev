import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useAuth, useSessionCore, useTeam } from '@/contexts';
import { STORAGE_KEYS } from '@/constants';
import { logger, pickScoringFields, robotCountOf } from '@/lib';
import { clocksEqual } from '@/lib/matchClock';
import { shotRobotOf } from '@/lib/scoring';
import {
  LIVE_HEARTBEAT_MS,
  liveService,
  type LiveHostWrite,
} from '@/services/liveService';
import type { LiveSession, MatchScoringFields, ShotEntry } from '@/types';
import { LiveHostContext, type LiveHost } from './liveHostContext';

/** Coalesces a burst of taps into one write */
const PUBLISH_DELAY_MS = 250;

/** The account this device was sharing live for, to carry on after a reload */
const readHosting = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LIVE_HOSTING);
  } catch {
    return null;
  }
};
const writeHosting = (uid: string | null) => {
  try {
    if (uid) localStorage.setItem(STORAGE_KEYS.LIVE_HOSTING, uid);
    else localStorage.removeItem(STORAGE_KEYS.LIVE_HOSTING);
  } catch {
    /* storage unavailable: sharing stops with the page */
  }
};

/**
 * Shares the session being scored with the host's team while they choose
 * to (liveSessions/{uid}), and brings in Robot 2 as a teammate scores it
 * from their own device: its LEAVE, PARKs and shots go into this match's
 * fields, so the match is saved with them as if scored here.
 */
export const LiveHostProvider = ({ children }: { children: ReactNode }) => {
  const { user, isGuest, loading: authLoading } = useAuth();
  const { team, loading: teamLoading } = useTeam();
  const {
    sessionData,
    updateSessionData,
    getMatchClock,
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    editingMatchId,
    sessionEpoch,
  } = useSessionCore();

  const uid = user && !isGuest ? user.uid : null;
  const teamId = team?.id ?? null;
  const available = !!uid && !!teamId;
  const unavailableReason = !uid
    ? 'Sign in to share live'
    : !teamId
      ? 'Join a team to share live'
      : null;

  const [live, setLive] = useState(() => !!uid && readHosting() === uid);
  // The account loads after the page: carry on sharing once it has
  useEffect(() => {
    if (uid && !live && readHosting() === uid) setLive(true);
    // Only as the account arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<LiveSession | null>(null);

  const hostName =
    user?.displayName?.trim() ||
    team?.members.find(m => m.userId === uid)?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'A teammate';

  const editing = editingMatchId !== null;
  const matches = useMemo(
    () => sessionData.matches ?? [],
    [sessionData.matches]
  );
  const matchKey = `m${matches.length}`;

  /**
   * The fields of the match being played. While a saved match is open for
   * fixing the fields hold that one, so the last live ones are kept.
   */
  const liveFieldsRef = useRef<MatchScoringFields>(
    pickScoringFields(sessionData)
  );
  if (!editing) {
    liveFieldsRef.current = {
      ...pickScoringFields(sessionData),
      robotCount: robotCountOf(sessionData),
    };
  }

  const buildWrite = useCallback(
    (): LiveHostWrite | null =>
      uid && teamId
        ? {
            hostId: uid,
            hostName,
            teamId,
            sessionName: sessionData.sessionName || 'Untitled session',
            sessionType: sessionData.sessionType,
            matchType: sessionData.matchType,
            matchNumber: matches.length + 1,
            matchKey,
            clock: getMatchClock(),
            state: {
              matchActive,
              editing,
              completed: sessionData.isSessionCompleted,
            },
            fields: liveFieldsRef.current,
            savedScores: matches.map(m => Number(m.finalScore) || 0),
          }
        : null,
    [
      uid,
      teamId,
      hostName,
      sessionData.sessionName,
      sessionData.sessionType,
      sessionData.matchType,
      sessionData.isSessionCompleted,
      matches,
      matchKey,
      getMatchClock,
      matchActive,
      editing,
    ]
  );

  const goLive = useCallback(async () => {
    const write = buildWrite();
    if (!write) return;
    setBusy(true);
    try {
      await liveService.start(write);
      writeHosting(write.hostId);
      setLive(true);
      toast.success('Live with your team', {
        description: 'Teammates can watch from My Sessions, or score Robot 2.',
      });
    } catch (err) {
      logger.warn('Going live failed', { err });
      toast.error("Couldn't share live. Check your connection.");
    } finally {
      setBusy(false);
    }
  }, [buildWrite]);

  const stopLive = useCallback(async () => {
    if (!uid) return;
    setBusy(true);
    setLive(false);
    writeHosting(null);
    setDoc(null);
    try {
      await liveService.stop(uid);
    } catch (err) {
      logger.warn('Stopping live failed', { err });
    } finally {
      setBusy(false);
    }
  }, [uid]);

  // Signed out, out of the team, or the session over or swapped for a new
  // one: nothing is shared any more.
  const epochRef = useRef(sessionEpoch);
  useEffect(() => {
    const newSession = epochRef.current !== sessionEpoch;
    epochRef.current = sessionEpoch;
    if (!live) return;
    const settled = !authLoading && !teamLoading;
    if (
      (settled && !available) ||
      newSession ||
      sessionData.isSessionCompleted
    ) {
      void stopLive();
    }
  }, [
    live,
    available,
    authLoading,
    teamLoading,
    sessionEpoch,
    sessionData.isSessionCompleted,
    stopLive,
  ]);

  // Its own document, for Robot 2 and to notice it was taken down
  useEffect(() => {
    if (!live || !uid) return;
    // Back after a reload: make sure it exists before watching it
    const write = buildWrite();
    if (write) void liveService.start(write).catch(() => {});
    return liveService.watch(uid, setDoc);
    // Only when sharing starts or the account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, uid]);

  // Publish what changed: a burst of taps is one write, and the clock is
  // checked every second (a skip moves its anchors without changing phase)
  const lastRef = useRef<{ write: string; key: string } | null>(null);
  const writeRef = useRef(buildWrite);
  writeRef.current = buildWrite;
  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => {
    if (!live) {
      lastRef.current = null;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastClock = getMatchClock();
    const publish = () => {
      timer = null;
      const write = writeRef.current();
      if (!write) return;
      const json = JSON.stringify(write);
      if (lastRef.current?.write === json) return;
      const keyChanged =
        lastRef.current !== null && lastRef.current.key !== write.matchKey;
      lastRef.current = { write: json, key: write.matchKey };
      void liveService.publish(write).catch(err => {
        logger.warn('Live publish failed', { err });
        lastRef.current = null;
      });
      // A match was saved: Robot 2 starts the next one clear, same scorer
      const r2 = docRef.current?.robot2;
      if (keyChanged && r2?.scorerId) {
        void liveService
          .resetRobot2(write.hostId, {
            ...r2,
            match: write.matchKey,
            leave: false,
            parkAuto: false,
            parkTeleop: false,
            shots: [],
          })
          .catch(() => {});
      }
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(publish, PUBLISH_DELAY_MS);
    };
    schedule();
    const clockCheck = setInterval(() => {
      const clock = getMatchClock();
      if (!clocksEqual(clock, lastClock)) {
        lastClock = clock;
        schedule();
      }
    }, 1000);
    const heartbeat = setInterval(() => {
      const write = writeRef.current();
      if (write) void liveService.publish(write).catch(() => {});
    }, LIVE_HEARTBEAT_MS);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(clockCheck);
      clearInterval(heartbeat);
    };
    // `sessionData`: the fields are read through a ref, so a tap has to
    // say it changed something
  }, [
    live,
    getMatchClock,
    buildWrite,
    sessionData,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
  ]);

  // Taken down from elsewhere (another device of the host's): stop too
  const seenRef = useRef(false);
  useEffect(() => {
    if (!live) {
      seenRef.current = false;
      return;
    }
    if (doc) seenRef.current = true;
    else if (seenRef.current) {
      setLive(false);
      writeHosting(null);
    }
  }, [live, doc]);

  // Robot 2 as its scorer has it, into this match's fields
  const r2 = doc?.robot2;
  const scorer =
    live && r2?.scorerId && r2.scorerId !== uid
      ? r2.scorerName || 'A teammate'
      : null;
  useEffect(() => {
    if (!scorer || !r2 || editing || r2.match !== matchKey) return;
    const own = (sessionData.shots ?? []).filter(e => shotRobotOf(e) === 1);
    const theirs: ShotEntry[] = r2.shots.map(s => ({ ...s, robot: 2 }));
    const shots = [...own, ...theirs];
    const next = {
      robot2Leave: r2.leave,
      robot2ParkAuto: r2.parkAuto,
      robot2ParkTeleop: r2.parkTeleop,
      shots,
      robotCount: 2 as const,
    };
    const same =
      sessionData.robot2Leave === next.robot2Leave &&
      sessionData.robot2ParkAuto === next.robot2ParkAuto &&
      sessionData.robot2ParkTeleop === next.robot2ParkTeleop &&
      sessionData.robotCount === 2 &&
      JSON.stringify(sessionData.shots ?? []) === JSON.stringify(shots);
    if (!same) updateSessionData(next);
  }, [scorer, r2, editing, matchKey, sessionData, updateSessionData]);

  // Someone took Robot 2, or let go of it
  const scorerRef = useRef<string | null>(null);
  useEffect(() => {
    if (scorer && scorerRef.current === null)
      toast(`${scorer} is scoring Robot 2`);
    else if (!scorer && scorerRef.current)
      toast(`${scorerRef.current} stopped scoring Robot 2`);
    scorerRef.current = scorer;
  }, [scorer]);

  const value = useMemo<LiveHost>(
    () => ({
      available,
      unavailableReason,
      live,
      busy,
      robot2Scorer: scorer,
      goLive,
      stopLive,
    }),
    [available, unavailableReason, live, busy, scorer, goLive, stopLive]
  );

  return (
    <LiveHostContext.Provider value={value}>
      {children}
    </LiveHostContext.Provider>
  );
};
