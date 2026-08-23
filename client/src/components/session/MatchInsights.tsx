import { useMemo, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Match, ShotEntry } from '@/types';

/** Mirrors the scoring rules in ScoringMetrics: classified 3pts, overflow 1pt. */
const POINTS_PER_CLASSIFIED = 3;
const POINTS_PER_OVERFLOW = 1;

/** Phase colors, matching the palette the other analysis charts use. */
const AUTO_COLOR = '#10b981';
const TELE_COLOR = '#f59e0b';
const NEUTRAL_COLOR = '#537788';

type Phase = 'auton' | 'teleop' | 'unknown';

interface TimelinePoint {
  /** 1-based cycle number across the whole match */
  idx: number;
  /** Seconds since the first scoring action */
  t: number;
  /** Cumulative artifact points after this cycle */
  points: number;
  /** Points earned by this cycle alone */
  gained: number;
  cycleTime?: number;
  /** The auton→teleop handoff gap, which is not a real cycle */
  isTransition: boolean;
  phase: Phase;
}

interface CycleRow {
  idx: number;
  label: string;
  time: number;
  phase: Phase;
  isTransition: boolean;
}

/** Legacy matches stored shots as a plain number[] of balls made. */
const normalizeShots = (raw: Match['autonShots']): ShotEntry[] => {
  if (!raw || raw.length === 0) return [];
  if (typeof raw[0] === 'number') {
    return (raw as unknown as number[]).map(made => ({
      ballsShot: made,
      ballsMade: made,
      classified: made,
      overflow: 0,
    }));
  }
  return raw;
};

const shotPoints = (s: ShotEntry) =>
  (s.classified ?? s.ballsMade) * POINTS_PER_CLASSIFIED +
  (s.overflow ?? 0) * POINTS_PER_OVERFLOW;

/** Seconds as "4.2s", or "1:23" once past a minute. */
const fmtSecs = (secs: number) => {
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const m = Math.floor(secs / 60);
  return `${m}:${Math.floor(secs % 60)
    .toString()
    .padStart(2, '0')}`;
};

const phaseColor = (phase: Phase) =>
  phase === 'auton'
    ? AUTO_COLOR
    : phase === 'teleop'
      ? TELE_COLOR
      : NEUTRAL_COLOR;

const phaseLabel = (phase: Phase) =>
  phase === 'auton' ? 'Autonomous' : phase === 'teleop' ? 'Teleop' : 'Cycle';

const MiniStat = ({
  label,
  value,
  sublabel,
  color,
  isDarkMode,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  isDarkMode: boolean;
}) => (
  <div
    className={`rounded-lg border px-3 py-2.5 ${
      isDarkMode
        ? 'border-team-blue-40 bg-team-dark'
        : 'border-gray-200 bg-gray-50'
    }`}
  >
    <p
      className={`text-[10px] font-medium uppercase tracking-wide ${
        isDarkMode ? 'text-team-white-60' : 'text-gray-500'
      }`}
    >
      {label}
    </p>
    <p
      className="text-lg font-bold mt-0.5"
      style={{ color: color ?? (isDarkMode ? '#ffffff' : '#111827') }}
    >
      {value}
    </p>
    {sublabel && (
      <p
        className={`text-[10px] mt-0.5 ${
          isDarkMode ? 'text-team-white-60' : 'text-gray-500'
        }`}
      >
        {sublabel}
      </p>
    )}
  </div>
);

const PointsTooltip = ({
  active,
  payload,
  isDarkMode,
  hasTiming,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
  isDarkMode: boolean;
  hasTiming: boolean;
}) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div
      className={`p-3 rounded-lg border shadow-xl backdrop-blur-sm space-y-1 ${
        isDarkMode
          ? 'bg-team-dark/95 border-team-blue-40'
          : 'bg-white/95 border-gray-200'
      }`}
    >
      <p
        className={`font-semibold text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        Cycle {point.idx}
        <span
          className="ml-2 font-medium"
          style={{ color: phaseColor(point.phase) }}
        >
          {phaseLabel(point.phase)}
        </span>
      </p>
      <p
        className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
      >
        {point.points} pts total{' '}
        <span className="font-semibold text-emerald-500">+{point.gained}</span>
      </p>
      {point.cycleTime !== undefined && (
        <p
          className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          {point.cycleTime.toFixed(2)}s cycle
        </p>
      )}
      {hasTiming && (
        <p
          className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          {fmtSecs(point.t)} into scoring
        </p>
      )}
    </div>
  );
};

const CycleTooltip = ({
  active,
  payload,
  isDarkMode,
  avg,
}: {
  active?: boolean;
  payload?: Array<{ payload: CycleRow }>;
  isDarkMode: boolean;
  avg: number;
}) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div
      className={`p-3 rounded-lg border shadow-xl backdrop-blur-sm ${
        isDarkMode
          ? 'bg-team-dark/95 border-team-blue-40'
          : 'bg-white/95 border-gray-200'
      }`}
    >
      <p
        className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        Cycle {row.label}
        {row.phase !== 'unknown' && !row.isTransition && (
          <span
            className="ml-2 font-medium"
            style={{ color: phaseColor(row.phase) }}
          >
            {phaseLabel(row.phase)}
          </span>
        )}
      </p>
      <p
        className="text-sm font-bold mt-1"
        style={{
          color: row.isTransition ? NEUTRAL_COLOR : phaseColor(row.phase),
        }}
      >
        {row.time.toFixed(2)}s
      </p>
      <p
        className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
      >
        {row.isTransition
          ? 'Auton → teleop handoff, excluded from averages'
          : `${row.time <= avg ? 'Faster' : 'Slower'} than average`}
      </p>
    </div>
  );
};

/**
 * Per-match breakdown: cumulative points across the match timeline plus
 * cycle-by-cycle pace. Collapsed by default so it costs a single row on
 * matches the user isn't drilling into, and renders nothing at all for
 * matches with no shot or cycle data.
 */
export const MatchInsights = ({
  match,
  isDarkMode,
}: {
  match: Match;
  isDarkMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const data = useMemo(() => {
    const auton = normalizeShots(match.autonShots).map(s => ({
      ...s,
      phase: 'auton' as Phase,
    }));
    const teleop = normalizeShots(match.teleopShots).map(s => ({
      ...s,
      phase: 'teleop' as Phase,
    }));
    const shots = [...auton, ...teleop];

    /** Index of the first teleop shot, i.e. the auton→teleop handoff. */
    const transitionIdx =
      auton.length > 0 && teleop.length > 0 ? auton.length : -1;

    /**
     * cycleTime is the gap since the previous scoring action, so summing it
     * rebuilds the match clock. The first shot has no preceding action, so it
     * anchors t=0 and any value stored against it is discarded — sessions
     * recorded before the ref-reset fix stamped it with the idle time since
     * the previous match.
     */
    let elapsed = 0;
    let cumulative = 0;
    const timeline: TimelinePoint[] = shots.map((s, i) => {
      const gap = i === 0 ? undefined : s.cycleTime;
      elapsed += gap ?? 0;
      cumulative += shotPoints(s);
      return {
        idx: i + 1,
        t: parseFloat(elapsed.toFixed(2)),
        points: cumulative,
        gained: shotPoints(s),
        cycleTime: gap,
        isTransition: i === transitionIdx,
        phase: s.phase,
      };
    });

    // Shot-level timings when present, else the legacy flat cycleTimes array.
    const timedShots = timeline.filter(p => p.cycleTime !== undefined);
    const cycles: CycleRow[] =
      timedShots.length > 0
        ? timedShots.map(p => ({
            idx: p.idx,
            label: `#${p.idx}`,
            time: p.cycleTime as number,
            phase: p.phase,
            isTransition: p.isTransition,
          }))
        : (match.cycleTimes ?? []).map((time, i) => ({
            idx: i + 1,
            label: `#${i + 1}`,
            time,
            phase: 'unknown' as Phase,
            isTransition: false,
          }));

    /**
     * The auton→teleop gap covers the driver handoff, not a scoring cycle, so
     * it would drag the teleop average up if it counted.
     */
    const scored = cycles.filter(c => !c.isTransition);
    const times = scored.map(c => c.time);
    const avg = times.length
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0;
    const variance = times.length
      ? times.reduce((acc, t) => acc + (t - avg) ** 2, 0) / times.length
      : 0;

    const phaseAvg = (phase: Phase) => {
      const t = scored.filter(c => c.phase === phase).map(c => c.time);
      return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
    };

    const ballsShot = shots.reduce((s, e) => s + e.ballsShot, 0);
    const ballsMade = shots.reduce((s, e) => s + e.ballsMade, 0);
    const firstTeleop = timeline.find(p => p.phase === 'teleop');

    return {
      timeline,
      cycles,
      hasTiming: timedShots.length > 0,
      hasAuton: auton.length > 0,
      /** Where the teleop marker goes, on whichever x-axis is in use */
      teleopStartT: firstTeleop?.t ?? null,
      teleopStartIdx: firstTeleop?.idx ?? null,
      shotCount: shots.length,
      /** Cycles that actually count toward the timing stats */
      scoredCount: times.length,
      avg,
      stdDev: Math.sqrt(variance),
      fastest: times.length ? Math.min(...times) : 0,
      slowest: times.length ? Math.max(...times) : 0,
      autonAvg: phaseAvg('auton'),
      teleopAvg: phaseAvg('teleop'),
      accuracy: ballsShot > 0 ? (ballsMade / ballsShot) * 100 : null,
      ballsShot,
      ballsMade,
      pointsPerCycle: shots.length ? cumulative / shots.length : 0,
      pointsPerMinute: elapsed > 0 ? (cumulative / elapsed) * 60 : null,
    };
  }, [match]);

  // Nothing recorded for this match — stay completely out of the way.
  if (data.shotCount === 0 && data.cycles.length === 0) return null;

  const cycleCount = data.shotCount || data.cycles.length;
  const summary = [
    `${cycleCount} cycle${cycleCount === 1 ? '' : 's'}`,
    data.scoredCount > 0 ? `${data.avg.toFixed(1)}s avg` : null,
    data.accuracy !== null ? `${Math.round(data.accuracy)}% accuracy` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const axisStroke = isDarkMode ? '#9ca3af' : '#6b7280';
  const gridStroke = isDarkMode ? '#2a2a2a' : '#e5e7eb';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark-20'
          : 'border-gray-200 bg-white'
      }`}
    >
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 p-5 text-left transition-colors ${
          isDarkMode ? 'hover:bg-team-blue/5' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Activity size={18} className="text-team-blue shrink-0" />
          <div className="min-w-0">
            <h3
              className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Match Insights
            </h3>
            <p
              className={`text-xs truncate ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              {summary}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-team-blue transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat
              label="Avg Cycle"
              value={data.scoredCount ? `${data.avg.toFixed(2)}s` : '—'}
              sublabel={
                data.scoredCount ? `σ ${data.stdDev.toFixed(2)}s` : undefined
              }
              isDarkMode={isDarkMode}
            />
            <MiniStat
              label="Fastest / Slowest"
              value={
                data.scoredCount
                  ? `${data.fastest.toFixed(1)} / ${data.slowest.toFixed(1)}s`
                  : '—'
              }
              isDarkMode={isDarkMode}
            />
            <MiniStat
              label="Accuracy"
              value={
                data.accuracy !== null ? `${Math.round(data.accuracy)}%` : '—'
              }
              sublabel={
                data.accuracy !== null
                  ? `${data.ballsMade}/${data.ballsShot} balls`
                  : undefined
              }
              isDarkMode={isDarkMode}
            />
            <MiniStat
              label="Scoring Rate"
              // Legacy matches carry cycleTimes but no shots, so there are no
              // points to rate — don't report a hollow "0.0 pts/cycle".
              value={
                data.shotCount === 0
                  ? '—'
                  : data.pointsPerMinute !== null
                    ? `${data.pointsPerMinute.toFixed(0)} pts/min`
                    : `${data.pointsPerCycle.toFixed(1)} pts/cycle`
              }
              sublabel={
                data.shotCount > 0 && data.pointsPerMinute !== null
                  ? `${data.pointsPerCycle.toFixed(1)} pts/cycle`
                  : undefined
              }
              color={NEUTRAL_COLOR}
              isDarkMode={isDarkMode}
            />
          </div>

          {data.timeline.length > 1 && (
            <div>
              <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                <h4
                  className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Points Over Time
                </h4>
                <p
                  className={`text-[11px] ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  Cumulative artifact points
                  {data.hasTiming
                    ? ''
                    : ' — no timing recorded, shown by cycle'}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.timeline}>
                  <defs>
                    <linearGradient
                      id="matchInsightsPoints"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={NEUTRAL_COLOR}
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="100%"
                        stopColor={NEUTRAL_COLOR}
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey={data.hasTiming ? 't' : 'idx'}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    // Cycle numbers are discrete — don't let recharts emit "#1.5"
                    allowDecimals={data.hasTiming}
                    stroke={axisStroke}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      data.hasTiming ? fmtSecs(v) : `#${v}`
                    }
                  />
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    label={{
                      value: 'Points',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: axisStroke },
                    }}
                  />
                  <Tooltip
                    content={
                      <PointsTooltip
                        isDarkMode={isDarkMode}
                        hasTiming={data.hasTiming}
                      />
                    }
                  />
                  {data.hasAuton && data.teleopStartIdx !== null && (
                    <ReferenceLine
                      x={
                        data.hasTiming
                          ? data.teleopStartT!
                          : data.teleopStartIdx
                      }
                      stroke={TELE_COLOR}
                      strokeDasharray="4 4"
                      label={{
                        value: 'Teleop',
                        position: 'insideTopLeft',
                        style: { fontSize: 10, fill: TELE_COLOR },
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="points"
                    stroke={NEUTRAL_COLOR}
                    strokeWidth={2}
                    fill="url(#matchInsightsPoints)"
                    dot={{ r: 2.5, fill: NEUTRAL_COLOR }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.cycles.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                <h4
                  className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Cycle Times
                </h4>
                <div
                  className={`flex items-center gap-3 text-[11px] ${
                    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }`}
                >
                  {data.autonAvg !== null && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: AUTO_COLOR }}
                      />
                      Auton {data.autonAvg.toFixed(1)}s
                    </span>
                  )}
                  {data.teleopAvg !== null && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: TELE_COLOR }}
                      />
                      Teleop {data.teleopAvg.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.cycles}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    stroke={axisStroke}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: 'Seconds',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: axisStroke },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    content={
                      <CycleTooltip isDarkMode={isDarkMode} avg={data.avg} />
                    }
                  />
                  {data.scoredCount > 0 && (
                    <ReferenceLine
                      y={data.avg}
                      stroke={NEUTRAL_COLOR}
                      strokeDasharray="4 4"
                      label={{
                        value: `avg ${data.avg.toFixed(1)}s`,
                        position: 'right',
                        style: { fontSize: 10, fill: NEUTRAL_COLOR },
                      }}
                    />
                  )}
                  <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                    {data.cycles.map(c => (
                      <Cell
                        key={c.idx}
                        fill={
                          c.isTransition ? NEUTRAL_COLOR : phaseColor(c.phase)
                        }
                        fillOpacity={
                          c.isTransition ? 0.25 : c.time <= data.avg ? 1 : 0.45
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
