import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useTheme } from '@/contexts';
import { GAME_TIMING, ROUTES } from '@/constants';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { LOCKED_SURFACE } from '@/components/session/EndOfMatchParts';
import { toggleOffClass, toggleOnClass } from '@/components/session/toggleTone';
import {
  VolleyPicker,
  type PickedVolley,
} from '@/components/session/VolleyPicker';
import {
  ELEMENT_LABELS,
  calculateScore,
  formatAccuracy,
  formatTime,
  includesAuto,
  includesTeleop,
  shotsOf,
} from '@/lib';
import { formatPoints } from '@/lib/points';
import {
  advanceClock,
  matchSecondsLeft,
  pickupSecondsLeft,
} from '@/lib/matchClock';
import { ShownError } from '@/lib/failure';
import { LIVE_STALE_MS, liveService } from '@/services/liveService';
import type { LiveRobot2, LiveSession as Live, ShotPeriod } from '@/types';

const COUNTDOWN_ABOVE_S =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

/** The host's clock, run on here: phase and seconds as they stand now */
const useLiveClock = (live: Live | null | undefined) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (!live) return null;
  const clock = advanceClock(
    live.clock,
    {
      matchType: live.matchType,
      completed: live.state.completed,
      sessionRunning: true,
    },
    now
  );
  const seconds =
    clock.phase === 'controller_pickup'
      ? pickupSecondsLeft(clock, now)
      : matchSecondsLeft(clock, now);
  const countdown =
    live.matchType === 'Full Game' &&
    clock.phase === 'auton' &&
    seconds > COUNTDOWN_ABOVE_S;
  return { clock, seconds, countdown, now };
};

const phaseName = (phase: string, countdown: boolean, active: boolean) =>
  !active
    ? 'Between matches'
    : countdown
      ? 'Starting'
      : phase === 'auton'
        ? 'AUTO'
        : phase === 'controller_pickup'
          ? 'Controller pickup'
          : phase === 'teleop'
            ? 'TELEOP'
            : 'Match over';

/**
 * A teammate's session, live: the clock, score and counts as the host
 * scores them, and Robot 2 to score from here when nobody else has it.
 * `?score=robot2` (Score Robot 2 on the banner) takes it on arrival.
 */
const LiveSession = () => {
  const { hostId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const [live, setLive] = useState<Live | null | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(
    () =>
      liveService.watch(hostId, setLive, () => {
        setDenied(true);
        setLive(null);
      }),
    [hostId]
  );

  const uid = user && !isGuest ? user.uid : null;
  const myName =
    user?.displayName?.trim() || user?.email?.split('@')[0] || 'A teammate';
  const holder = live?.robot2?.scorerId ?? null;
  const scoring = !!uid && holder === uid;

  const claim = useCallback(async () => {
    if (!uid) return;
    setClaiming(true);
    try {
      await liveService.claimRobot2(hostId, uid, myName);
    } catch (err) {
      toast.error(
        err instanceof ShownError ? err.message : "Couldn't take Robot 2."
      );
    } finally {
      setClaiming(false);
    }
  }, [hostId, uid, myName]);

  const release = useCallback(() => {
    void liveService.releaseRobot2(hostId).catch(() => {});
  }, [hostId]);

  // Score Robot 2 from the banner: take it once the session has loaded
  const wantsRobot2 = search.get('score') === 'robot2';
  useEffect(() => {
    if (!wantsRobot2 || !live || !uid) return;
    setSearch({}, { replace: true });
    if (!holder) void claim();
    else if (holder !== uid)
      toast(
        `${live.robot2?.scorerName || 'A teammate'} is already scoring Robot 2`
      );
  }, [wantsRobot2, live, uid, holder, claim, setSearch]);

  // Leaving the page lets go of Robot 2, so someone else can take it
  const scoringRef = useRef(scoring);
  scoringRef.current = scoring;
  useEffect(() => {
    const onHide = () => {
      if (scoringRef.current) release();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, [release]);

  const timer = useLiveClock(live);
  const page = `flex-1 ${isDarkMode ? 'bg-team-dark text-white' : 'bg-[#FEFEFE] text-gray-900'}`;
  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const card = `rounded-2xl border p-4 ${isDarkMode ? 'border-team-blue-40 bg-white/[0.03]' : 'border-gray-200 bg-white'}`;

  if (live === undefined) {
    return (
      <div className={`${page} flex items-center justify-center p-6`}>
        <p className="text-sm text-team-blue">Joining live session…</p>
      </div>
    );
  }
  if (!live || live.state.completed) {
    return (
      <div className={`${page} flex items-center justify-center p-6`}>
        <div className={`${card} max-w-md text-center space-y-3`}>
          <p className="font-semibold">
            {denied
              ? "You can't open this live session"
              : 'This session is no longer live'}
          </p>
          <p className={`text-sm ${muted}`}>
            {denied
              ? 'Live sessions are shared with the host’s team only.'
              : 'The host stopped sharing it, or finished the session. Its matches show in My Sessions once saved.'}
          </p>
          <Link
            to={ROUTES.SESSIONS}
            className="inline-block font-semibold text-team-blue underline underline-offset-2"
          >
            Back to My Sessions
          </Link>
        </div>
      </div>
    );
  }

  const f = live.fields;
  const score = calculateScore({ ...f, matchType: live.matchType });
  const active = live.state.matchActive;
  const stale = timer ? timer.now - live.updatedAt > LIVE_STALE_MS : false;
  const robot2 = live.robot2;
  const robots = f.robotCount === 1 && !robot2?.scorerId ? 1 : 2;
  const shotLine = (r: 1 | 2) => {
    const s = shotsOf(f, undefined, r);
    return s.made + s.missed === 0
      ? '—'
      : `${s.made}/${s.made + s.missed}${s.accuracy !== null ? ` · ${formatAccuracy(s.accuracy)}` : ''}`;
  };
  const yesNo = (v: boolean) => (v ? '✓' : '–');

  return (
    <div className={page}>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-500">
            <Radio
              aria-hidden
              className="h-3.5 w-3.5 motion-safe:animate-pulse"
            />
            Live
          </span>
          <h1 className="text-2xl font-bold">{live.sessionName}</h1>
          <p className={`text-sm ${muted}`}>
            Scored by {live.hostName} · {live.sessionType} · {live.matchType}
          </p>
        </div>

        {stale && (
          <p role="status" className={`${card} text-sm text-center`}>
            {live.hostName} seems to be offline. This updates when they’re back.
          </p>
        )}
        {live.state.editing && (
          <p role="status" className={`text-sm text-center ${muted}`}>
            {live.hostName} is fixing a saved match
          </p>
        )}

        <div className={`${card} flex flex-col items-center gap-1`}>
          <p className={EYEBROW_CLASS}>
            Match {live.matchNumber} ·{' '}
            {phaseName(
              timer?.clock.phase ?? 'auton',
              !!timer?.countdown,
              active
            )}
          </p>
          <p
            className="font-mono text-6xl font-bold tabular-nums"
            aria-live="off"
          >
            {formatTime(timer?.seconds ?? 0)}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {formatPoints(score.total)}
          </p>
        </div>

        {scoring && (
          <Robot2Scorer
            live={live}
            uid={uid}
            name={myName}
            timer={timer}
            onRelease={release}
          />
        )}

        {!scoring && uid && (
          <div
            className={`${card} flex flex-wrap items-center justify-between gap-3`}
          >
            <p className="text-sm">
              {holder
                ? `${robot2?.scorerName || 'A teammate'} is scoring Robot 2`
                : 'Nobody is scoring Robot 2'}
            </p>
            {!holder && (
              <button
                type="button"
                onClick={() => void claim()}
                disabled={claiming}
                className={`min-h-11 rounded-xl border-2 border-team-blue bg-team-blue px-4 text-sm font-semibold disabled:opacity-60 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                Score Robot 2
              </button>
            )}
          </div>
        )}

        <div className={card}>
          <h2 className={`${EYEBROW_CLASS} mb-3`}>This match</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Stat label={ELEMENT_LABELS.tipping} value={`${f.tipping}`} />
            <Stat label={ELEMENT_LABELS.flower} value={`${f.flower}`} />
            <Stat
              label={ELEMENT_LABELS.flowerBonus}
              value={`${f.flowerBonus}`}
            />
            <Stat label={ELEMENT_LABELS.hive} value={`${f.ballsInHive}`} />
            <Stat label={ELEMENT_LABELS.garden} value={`${f.garden}`} />
            <Stat
              label={ELEMENT_LABELS.robots}
              value={formatPoints(score.leave + score.park)}
            />
          </dl>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className={muted}>
                <th className="text-left font-semibold">Robot</th>
                <th className="font-semibold">{ELEMENT_LABELS.leave}</th>
                <th className="font-semibold">Park (Auto)</th>
                <th className="font-semibold">Park (End)</th>
                <th className="text-right font-semibold">Shots</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[1, 2].slice(0, robots).map(r => (
                <tr key={r}>
                  <td className="py-1">Robot {r}</td>
                  <td className="text-center">
                    {yesNo(r === 1 ? f.robot1Leave : f.robot2Leave)}
                  </td>
                  <td className="text-center">
                    {yesNo(r === 1 ? f.robot1ParkAuto : f.robot2ParkAuto)}
                  </td>
                  <td className="text-center">
                    {yesNo(r === 1 ? f.robot1ParkTeleop : f.robot2ParkTeleop)}
                  </td>
                  <td className="text-right">{shotLine(r as 1 | 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {live.savedScores.length > 0 && (
          <div className={card}>
            <h2 className={`${EYEBROW_CLASS} mb-2`}>Saved matches</h2>
            <ol className="flex flex-wrap gap-2 text-sm tabular-nums">
              {live.savedScores.map((s, i) => (
                <li
                  key={i}
                  className={`rounded-lg px-2 py-1 ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}
                >
                  Match {i + 1}: {formatPoints(s)}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="truncate text-xs text-muted-foreground">{label}</dt>
    <dd className="font-semibold tabular-nums">{value}</dd>
  </div>
);

/**
 * Robot 2, scored from here: its LEAVE and PARKs, and its shots on counters
 * of their own (S, A, N, M on a keyboard). Each change goes straight to the
 * host's match. Locked the way the host's own fields are: nothing before
 * Start, End park not while AUTO runs, no shots in the 3-2-1.
 */
const Robot2Scorer = ({
  live,
  uid,
  name,
  timer,
  onRelease,
}: {
  live: Live;
  uid: string | null;
  name: string;
  timer: ReturnType<typeof useLiveClock>;
  onRelease: () => void;
}) => {
  const { isDarkMode } = useTheme();
  const theirs = live.robot2;
  // Values from an earlier match (the host has moved on) count as none
  const current: LiveRobot2 = {
    scorerId: uid,
    scorerName: name,
    match: live.matchKey,
    ...(theirs && theirs.match === live.matchKey
      ? {
          leave: theirs.leave,
          parkAuto: theirs.parkAuto,
          parkTeleop: theirs.parkTeleop,
          shots: theirs.shots,
        }
      : { leave: false, parkAuto: false, parkTeleop: false, shots: [] }),
  };
  /** The latest written, so taps faster than the round trip build on it */
  const latest = useRef(current);
  latest.current = current;

  const write = (changes: Partial<LiveRobot2>) => {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    void liveService
      .writeRobot2(live.hostId, next)
      .catch(() =>
        toast.error("Couldn't send that to the host. Check your connection.")
      );
  };

  const hasAuto = includesAuto(live.matchType);
  const hasTeleop = includesTeleop(live.matchType);
  const phase = timer?.clock.phase ?? 'auton';
  const open = live.state.matchActive && !live.state.editing;
  const autoOpen = open && hasAuto;
  const endOpen =
    open && hasTeleop && !(phase === 'auton' && timer?.clock.running);
  const shotsOpen = open && !timer?.countdown;
  const period: ShotPeriod = !hasTeleop
    ? 'auto'
    : !hasAuto
      ? 'teleop'
      : phase === 'auton' || phase === 'controller_pickup'
        ? 'auto'
        : 'teleop';
  const reason = !live.state.matchActive
    ? `Waiting for ${live.hostName} to start the match`
    : live.state.editing
      ? `${live.hostName} is fixing a saved match`
      : !endOpen && hasTeleop
        ? 'Park (End) opens at TELEOP'
        : null;

  const volleyOf = (
    at: ShotPeriod,
    { shot, pollen, nectar }: PickedVolley
  ) => ({ period: at, shot, made: pollen + nectar, pollen, nectar });
  const recordVolley = (v: PickedVolley) =>
    write({ shots: [...latest.current.shots, volleyOf(period, v)] });
  // An edited volley keeps the period it was shot in
  const editVolley = (position: number, v: PickedVolley) =>
    write({
      shots: latest.current.shots.map((s, i) =>
        i === position ? volleyOf(s.period, v) : s
      ),
    });
  const deleteVolley = (position: number) =>
    write({ shots: latest.current.shots.filter((_, i) => i !== position) });

  const toggle = (
    label: string,
    on: boolean,
    enabled: boolean,
    onChange: (v: boolean) => void
  ) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Robot 2 ${label}`}
      disabled={!enabled}
      onClick={() => onChange(!on)}
      className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border-2 px-1 text-sm font-semibold ${
        !enabled
          ? `cursor-not-allowed ${LOCKED_SURFACE}`
          : on
            ? toggleOnClass(isDarkMode)
            : toggleOffClass(isDarkMode)
      }`}
    >
      {on && <Check size={14} strokeWidth={3} aria-hidden />}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <section
      aria-label="Score Robot 2"
      className={`flex flex-col gap-3 rounded-2xl border-2 border-team-blue p-4 ${isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/[0.04]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">You’re scoring Robot 2</h2>
        <button
          type="button"
          onClick={onRelease}
          className="text-sm font-semibold text-team-blue underline underline-offset-2"
        >
          Stop scoring
        </button>
      </div>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      <div className="flex gap-2">
        {hasAuto &&
          toggle(ELEMENT_LABELS.leave, current.leave, autoOpen, v =>
            write({ leave: v })
          )}
        {hasAuto &&
          toggle('Park (Auto)', current.parkAuto, autoOpen, v =>
            write({ parkAuto: v })
          )}
        {hasTeleop &&
          toggle('Park (End)', current.parkTeleop, endOpen, v =>
            write({ parkTeleop: v })
          )}
      </div>
      <VolleyPicker
        heading="Shots"
        total={shotsOf({ shots: current.shots })}
        enabled={shotsOpen}
        resetKey={live.matchKey}
        log={current.shots}
        onRecord={recordVolley}
        onEdit={editVolley}
        onDelete={deleteVolley}
        robotLabel="Robot 2 "
      />
    </section>
  );
};

export default LiveSession;
