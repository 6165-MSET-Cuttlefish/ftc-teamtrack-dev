import { useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BAR_RADIUS,
  CARD_BG,
  ChartTooltip,
  LEGEND_PROPS,
  MAX_BAR_SIZE,
  TOOLTIP_WRAPPER_STYLE,
  areaWash,
  axisProps,
  barCursor,
  dotProps,
  gridProps,
  lineCursor,
  stackSegment,
} from '@/components/charts/chartKit';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
import { StatTile } from '@/components/ui/stat-tile';
import { DATA_CLASS } from '@/components/ui/tokens';
import {
  CHART_COLORS,
  SERIES_COLORS,
  formatAccuracy,
  matchScore,
  toneOf,
} from '@/lib';
import {
  isAlliance,
  isSolo,
  matchesInScope,
  percentOf,
  robotInMatch,
  robotTotals,
  type RobotNumber,
  type RobotScope,
  type RobotTotals,
} from '@/lib/robotStats';
import type { Match, SessionType } from '@/types';
import { Section } from './AnalysisSection';
import { SummaryTab, computeStats } from './AnalysisTabs';

/** The scope picked last on this device, for the next session opened */
const SCOPE_KEY = 'teamtrack-robot-scope';

const readScope = (): RobotScope => {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v === 'robot' || v === 'solo' || v === 'alliance' ? v : 'alliance';
  } catch {
    return 'alliance';
  }
};

const writeScope = (scope: RobotScope) => {
  try {
    localStorage.setItem(SCOPE_KEY, scope);
  } catch {
    /* storage unavailable: just this visit */
  }
};

const Y_AXIS_WIDTH = 40;
const CHART_HEIGHT = 260;

/** Each robot's colour: the first two picked-series colours, blue and orange */
const robotColors = (isDarkMode: boolean) => {
  const [r1, r2] = SERIES_COLORS[isDarkMode ? 'dark' : 'light'];
  return { 1: r1, 2: r2 } as Record<RobotNumber, string>;
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const pct = (accuracy: number | null) =>
  accuracy === null ? null : Math.round(accuracy * 100);

/** A match's chart row: its tick, its heading, and whether it was solo */
const rowOf = (m: Match) => ({
  name: `M${m.matchNumber}`,
  title: `Match ${m.matchNumber}`,
  note: isSolo(m) ? 'Solo' : 'With an alliance',
});

const muted = (isDarkMode: boolean) =>
  isDarkMode ? 'text-team-white-60' : 'text-gray-600';

/**
 * Picks whose matches the Summary reads, where a session has matches played
 * as an alliance: 1 robot (Robot 1 in every match, or "in isolation", its
 * solo matches alone) or 2 robots (both, in the alliance matches). Then
 * shows that analysis: the robot's own figures, the two robots side by
 * side, and the full Summary of the matches in scope.
 *
 * A session with no alliance matches has nothing to pick: its Summary is
 * shown as it always was.
 */
export const RobotScopedSummary = ({
  matches,
  stats,
  isDarkMode,
  sessionType,
  onOpenMatch,
}: {
  matches: Match[];
  stats: NonNullable<ReturnType<typeof computeStats>>;
  isDarkMode: boolean;
  sessionType?: SessionType;
  onOpenMatch?: (index: number) => void;
}) => {
  const allianceCount = matches.filter(isAlliance).length;
  const soloCount = matches.length - allianceCount;
  const [picked, setPicked] = useState<RobotScope>(readScope);
  const pick = (scope: RobotScope) => {
    setPicked(scope);
    writeScope(scope);
  };

  if (allianceCount === 0) {
    return (
      <SummaryTab
        matches={matches}
        stats={stats}
        isDarkMode={isDarkMode}
        sessionType={sessionType}
        onOpenMatch={onOpenMatch}
      />
    );
  }

  const scope = picked;
  const robots = scope === 'alliance' ? '2' : '1';
  const inScope = matchesInScope(matches, scope);
  const scoped = inScope.map(s => s.match);
  const open = onOpenMatch
    ? (i: number) => {
        const at = inScope[i];
        if (at) onOpenMatch(at.index);
      }
    : undefined;

  const description =
    scope === 'robot'
      ? `Robot 1 in all ${plural(matches.length, 'match', 'matches')}, solo and with an alliance. Only what Robot 1 did itself: its Leave, Park and shots.`
      : scope === 'solo'
        ? soloCount > 0
          ? `Robot 1 in isolation: its ${plural(soloCount, 'solo match', 'solo matches')}, where the whole score is its own.`
          : 'Robot 1 in isolation: this session has no solo matches.'
        : `Both robots in the ${plural(allianceCount, 'alliance match', 'alliance matches')}: how they compare with each other, and across these matches.`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={EYEBROW_CLASS}>Analysis for</span>
          <Segmented
            label="Robots analysed"
            value={robots}
            onChange={v =>
              pick(v === '2' ? 'alliance' : scope === 'solo' ? 'solo' : 'robot')
            }
            options={[
              { value: '1', label: '1 robot' },
              { value: '2', label: '2 robots' },
            ]}
            isDarkMode={isDarkMode}
            size="md"
          />
          {robots === '1' && (
            <Segmented
              label="Robot 1's matches"
              value={scope}
              onChange={v => pick(v)}
              options={[
                { value: 'robot', label: 'All matches', count: matches.length },
                { value: 'solo', label: 'In isolation', count: soloCount },
              ]}
              isDarkMode={isDarkMode}
              size="md"
            />
          )}
        </div>
        <p className={`text-sm ${muted(isDarkMode)}`} aria-live="polite">
          {description}
        </p>
      </div>

      {scope === 'robot' && (
        <RobotFocus matches={matches} isDarkMode={isDarkMode} />
      )}

      {scope === 'solo' &&
        (scoped.length === 0 ? (
          <Note isDarkMode={isDarkMode}>
            No solo matches in this session. Pick All matches to see Robot 1
            across its alliance matches.
          </Note>
        ) : (
          <SummaryTab
            matches={scoped}
            stats={computeStats(scoped)!}
            isDarkMode={isDarkMode}
            sessionType={sessionType}
            onOpenMatch={open}
          />
        ))}

      {scope === 'alliance' && (
        <>
          <RobotComparison
            matches={scoped}
            solo={matches.filter(isSolo)}
            isDarkMode={isDarkMode}
          />
          <h2 className="pt-2 text-lg font-semibold text-foreground">
            Alliance matches
          </h2>
          <SummaryTab
            matches={scoped}
            stats={computeStats(scoped)!}
            isDarkMode={isDarkMode}
            sessionType={sessionType}
            onOpenMatch={open}
          />
        </>
      )}
    </div>
  );
};

const Note = ({
  children,
  isDarkMode,
}: {
  children: ReactNode;
  isDarkMode: boolean;
}) => (
  <p
    className={`rounded-xl border border-dashed px-4 py-3 text-center text-sm ${
      isDarkMode
        ? 'border-team-blue-40 text-team-white-60'
        : 'border-gray-300 text-gray-600'
    }`}
  >
    {children}
  </p>
);

/** A row of tiles, as the Summary lays them out */
const Tiles = ({
  tiles,
  isDarkMode,
}: {
  tiles: {
    key: string;
    label: string;
    value: ReactNode;
    caption?: ReactNode;
    info?: ReactNode;
  }[];
  isDarkMode: boolean;
}) => (
  <div
    className={`grid grid-cols-2 gap-2 sm:gap-4 ${
      tiles.length === 5
        ? 'sm:grid-cols-3 lg:grid-cols-5'
        : tiles.length === 4
          ? 'sm:grid-cols-4'
          : 'sm:grid-cols-3'
    }`}
  >
    {tiles.map(({ key, ...tile }, i) => (
      <StatTile
        key={key}
        {...tile}
        className={
          tiles.length % 2 === 1 && i === tiles.length - 1
            ? 'col-span-2 sm:col-span-1'
            : undefined
        }
        isDarkMode={isDarkMode}
      />
    ))}
  </div>
);

/** The figures a robot's tiles and rows are made of */
const rateText = (done: number, chances: number) =>
  chances > 0 ? `${done} of ${chances}` : 'not run';

/**
 * Bars that set two things side by side, one figure at a time: a label,
 * then a thin bar for each with its value at the end, as Points by Element
 * draws its bars. Each figure has its own scale.
 */
const PairedBars = ({
  rows,
  series,
  isDarkMode,
}: {
  rows: {
    label: string;
    values: (number | null)[];
    format: (v: number) => string;
    /** The scale's top; the largest value when not given */
    max?: number;
  }[];
  series: { name: string; color: string }[];
  isDarkMode: boolean;
}) => (
  <div className="space-y-5">
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
      {series.map(s => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className={muted(isDarkMode)}>{s.name}</span>
        </li>
      ))}
    </ul>
    <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
      {rows.map(row => {
        const top =
          row.max ??
          Math.max(1, ...row.values.map(v => (v === null ? 0 : Math.abs(v))));
        return (
          <div key={row.label} className="space-y-1.5">
            <p
              className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
            >
              {row.label}
            </p>
            {row.values.map((v, i) => {
              const s = series[i]!;
              const width = v === null ? 0 : Math.round((v / top) * 100);
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="sr-only">{s.name}</span>
                  <div
                    className={`h-2 flex-1 overflow-hidden rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${width}%`, backgroundColor: s.color }}
                    />
                  </div>
                  <span
                    className={`w-14 shrink-0 text-right text-sm font-bold ${DATA_CLASS}`}
                  >
                    {v === null ? 'N/A' : row.format(v)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  </div>
);

/**
 * Leave and both Parks, match by match: a filled cell where the robot did
 * it, an empty one where it didn't, a dash where the match didn't run that
 * period. One block of three rows per robot.
 */
const LeaveParkGrid = ({
  matches,
  robots,
  isDarkMode,
}: {
  matches: Match[];
  robots: RobotNumber[];
  isDarkMode: boolean;
}) => {
  const colors = robotColors(isDarkMode);
  const parts = [
    ['leave', 'Leave'],
    ['parkAuto', 'Park (Auto)'],
    ['parkEnd', 'Park (End)'],
  ] as const;
  const empty = isDarkMode ? 'bg-white/10' : 'bg-gray-100';
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-px">
              <span className="sr-only">Robot and action</span>
            </th>
            {matches.map(m => (
              <th
                key={m.id}
                scope="col"
                className={`min-w-7 font-normal tabular-nums ${muted(isDarkMode)}`}
              >
                M{m.matchNumber}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {robots.map(robot =>
            parts.map(([key, label], p) => (
              <tr key={`${robot}-${key}`}>
                <th
                  scope="row"
                  className={`w-px whitespace-nowrap pr-3 text-left font-medium ${
                    p === 0 && robot !== robots[0] ? 'pt-3' : ''
                  } ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                >
                  {robots.length > 1 && (
                    <span className="mr-1.5 inline-flex items-center gap-1">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colors[robot] }}
                      />
                      <span className={p === 0 ? '' : 'invisible'}>
                        R{robot}
                      </span>
                    </span>
                  )}
                  {label}
                </th>
                {matches.map(m => {
                  const v = robotInMatch(m, robot)[key];
                  const said = v === null ? 'not run' : v ? 'done' : 'not done';
                  return (
                    <td
                      key={m.id}
                      className={p === 0 && robot !== robots[0] ? 'pt-3' : ''}
                    >
                      <span className="sr-only">{said}</span>
                      {v === null ? (
                        <span
                          aria-hidden
                          className={`block h-5 text-center leading-5 ${muted(isDarkMode)}`}
                        >
                          –
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          title={`Match ${m.matchNumber}: ${label} ${said}`}
                          className={`block h-5 rounded ${v ? '' : empty}`}
                          style={
                            v ? { backgroundColor: colors[robot] } : undefined
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

/** What a robot's tiles say about it */
const robotTiles = (t: RobotTotals, who: string) => [
  {
    key: 'leave',
    label: 'Leave Rate',
    value: percentOf(t.leave) === null ? null : `${percentOf(t.leave)}%`,
    caption: `Leave ${rateText(t.leave.done, t.leave.chances)}`,
  },
  {
    key: 'park',
    label: 'Park Rate',
    value: percentOf(t.park) === null ? null : `${percentOf(t.park)}%`,
    caption: `Park ${rateText(t.park.done, t.park.chances)}`,
    info: `${who}'s parks out of its chances: at the end of Auto and again at the end of the match, in the periods each match ran.`,
  },
  {
    key: 'points',
    label: 'Leave + Park',
    value: t.avgLeaveParkPoints === null ? null : `${t.avgLeaveParkPoints} pts`,
    caption: 'per match',
  },
  {
    key: 'accuracy',
    label: 'Accuracy',
    value: t.accuracy === null ? null : formatAccuracy(t.accuracy),
    caption:
      t.accuracy === null ? 'no shots counted' : `${t.made} of ${t.shot} shots`,
  },
  {
    key: 'made',
    label: 'Made per Match',
    value: t.madePerMatch,
    caption:
      t.madePerMatch === null
        ? 'no shots counted'
        : `${t.pollen} Pollen, ${t.nectar} Nectar`,
  },
];

/**
 * Robot 1 in every match, solo or with an alliance: only what it did
 * itself, and how it did alone against with a partner.
 */
const RobotFocus = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const color = robotColors(isDarkMode)[1];
  const missed = toneOf(CHART_COLORS.average, isDarkMode);
  const average = toneOf(CHART_COLORS.average, isDarkMode);
  const totals = robotTotals(matches, 1);
  const solo = matches.filter(isSolo);
  const together = matches.filter(isAlliance);
  const soloT = robotTotals(solo, 1);
  const togetherT = robotTotals(together, 1);

  const rows = matches.map(m => {
    const r = robotInMatch(m, 1);
    return {
      ...rowOf(m),
      made: r.made,
      missed: r.shot - r.made,
      accuracy: pct(r.accuracy),
      average: pct(totals.accuracy),
    };
  });
  const anyShots = totals.shot > 0;
  const accuracyRows = rows.filter(r => r.accuracy !== null).length;

  return (
    <>
      <Tiles tiles={robotTiles(totals, 'Robot 1')} isDarkMode={isDarkMode} />

      {solo.length > 0 && together.length > 0 && (
        <Section title="Solo vs With an Alliance" isDarkMode={isDarkMode}>
          <PairedBars
            isDarkMode={isDarkMode}
            series={[
              {
                name: `Solo (${plural(solo.length, 'match', 'matches')})`,
                color: missed,
              },
              {
                name: `With an alliance (${plural(together.length, 'match', 'matches')})`,
                color,
              },
            ]}
            rows={[
              {
                label: 'Accuracy',
                values: [pct(soloT.accuracy), pct(togetherT.accuracy)],
                format: v => `${v}%`,
                max: 100,
              },
              {
                label: 'Made per match',
                values: [soloT.madePerMatch, togetherT.madePerMatch],
                format: v => String(v),
              },
              {
                label: 'Leave rate',
                values: [percentOf(soloT.leave), percentOf(togetherT.leave)],
                format: v => `${v}%`,
                max: 100,
              },
              {
                label: 'Park rate',
                values: [percentOf(soloT.park), percentOf(togetherT.park)],
                format: v => `${v}%`,
                max: 100,
              },
              {
                label: 'Leave + Park per match',
                values: [
                  soloT.avgLeaveParkPoints,
                  togetherT.avgLeaveParkPoints,
                ],
                format: v => `${v} pts`,
              },
            ]}
          />
        </Section>
      )}

      {anyShots ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <Section title="Robot 1 Shots by Match" isDarkMode={isDarkMode}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart
                data={rows}
                accessibilityLayer={false}
                role="img"
                title="Robot 1 shots by match"
                desc="Balls Robot 1 made and missed in each match, stacked into the balls it shot."
              >
                <CartesianGrid {...gridProps(isDarkMode)} />
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis
                  width={Y_AXIS_WIDTH}
                  allowDecimals={false}
                  {...axisProps(isDarkMode)}
                />
                <Tooltip
                  wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                  cursor={barCursor(isDarkMode)}
                  content={
                    <ChartTooltip
                      isDarkMode={isDarkMode}
                      titleKey="title"
                      formatTotal={sum => `${sum} shot`}
                    />
                  }
                />
                <Legend {...LEGEND_PROPS} itemSorter={null} />
                <Bar
                  dataKey="made"
                  name="Made"
                  stackId="shots"
                  fill={color}
                  maxBarSize={MAX_BAR_SIZE}
                  shape={stackSegment('made', SHOT_KEYS)}
                />
                <Bar
                  dataKey="missed"
                  name="Missed"
                  stackId="shots"
                  fill={missed}
                  fillOpacity={0.45}
                  maxBarSize={MAX_BAR_SIZE}
                  shape={stackSegment('missed', SHOT_KEYS)}
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Robot 1 Accuracy by Match" isDarkMode={isDarkMode}>
            {accuracyRows >= 2 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <ComposedChart
                  data={rows}
                  accessibilityLayer={false}
                  role="img"
                  title="Robot 1 accuracy by match"
                  desc="Robot 1's balls made out of balls shot in each match, with its accuracy over all of them as a dashed line."
                >
                  {areaWash('robotFocusAccuracy', color, isDarkMode)}
                  <CartesianGrid {...gridProps(isDarkMode)} />
                  <XAxis
                    dataKey="name"
                    padding={{ left: 16, right: 16 }}
                    {...axisProps(isDarkMode)}
                  />
                  <YAxis
                    width={Y_AXIS_WIDTH}
                    unit="%"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    {...axisProps(isDarkMode)}
                  />
                  <Tooltip
                    wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                    cursor={lineCursor(isDarkMode)}
                    content={
                      <ChartTooltip
                        isDarkMode={isDarkMode}
                        titleKey="title"
                        formatValue={v => `${v}%`}
                      />
                    }
                  />
                  <Legend {...LEGEND_PROPS} itemSorter={null} />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    name="Robot 1 accuracy"
                    stroke={color}
                    strokeWidth={2.5}
                    fill="url(#robotFocusAccuracy)"
                    fillOpacity={1}
                    connectNulls={false}
                    {...dotProps(CARD_BG, color)}
                  />
                  <Line
                    dataKey="average"
                    name="Over all matches"
                    stroke={average}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    legendType="plainline"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Note isDarkMode={isDarkMode}>
                Accuracy trends appear after 2 matches with shots
              </Note>
            )}
          </Section>
        </div>
      ) : (
        <Note isDarkMode={isDarkMode}>No shots counted for Robot 1 yet</Note>
      )}

      <Section title="Leave and Park by Match" isDarkMode={isDarkMode}>
        <LeaveParkGrid matches={matches} robots={[1]} isDarkMode={isDarkMode} />
      </Section>
    </>
  );
};

const SHOT_KEYS = ['made', 'missed'] as const;

/**
 * Both robots, in the matches they played as an alliance: side by side on
 * everything each did itself, match by match, and the alliance's matches
 * against the ones Robot 1 played alone.
 */
const RobotComparison = ({
  matches,
  solo,
  isDarkMode,
}: {
  matches: Match[];
  solo: Match[];
  isDarkMode: boolean;
}) => {
  const colors = robotColors(isDarkMode);
  const r1 = robotTotals(matches, 1);
  const r2 = robotTotals(matches, 2);
  const r2Shots = r2.shot > 0;

  const rows = useMemo(
    () =>
      matches.map(m => {
        const a = robotInMatch(m, 1);
        const b = robotInMatch(m, 2);
        return {
          ...rowOf(m),
          r1Points: a.leaveParkPoints,
          r2Points: b.leaveParkPoints,
          r1Made: a.made,
          r2Made: b.made,
          r1Accuracy: pct(a.accuracy),
          r2Accuracy: pct(b.accuracy),
        };
      }),
    [matches]
  );
  const accuracyLines =
    r2Shots &&
    rows.filter(r => r.r1Accuracy !== null || r.r2Accuracy !== null).length >=
      2;

  const avgScore = (ms: Match[]) =>
    ms.length
      ? Math.round(ms.reduce((a, m) => a + matchScore(m), 0) / ms.length)
      : null;
  const soloR1 = robotTotals(solo, 1);

  const grouped = (
    id: string,
    title: string,
    desc: string,
    keys: [string, string],
    unit: (v: number) => string
  ) => (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart
        data={rows}
        barGap={2}
        accessibilityLayer={false}
        role="img"
        title={title}
        desc={desc}
      >
        <CartesianGrid {...gridProps(isDarkMode)} />
        <XAxis dataKey="name" {...axisProps(isDarkMode)} />
        <YAxis
          width={Y_AXIS_WIDTH}
          allowDecimals={false}
          {...axisProps(isDarkMode)}
        />
        <Tooltip
          wrapperStyle={TOOLTIP_WRAPPER_STYLE}
          cursor={barCursor(isDarkMode)}
          content={
            <ChartTooltip
              isDarkMode={isDarkMode}
              titleKey="title"
              formatValue={unit}
            />
          }
        />
        <Legend {...LEGEND_PROPS} itemSorter={null} />
        <Bar
          key={`${id}-1`}
          dataKey={keys[0]}
          name="Robot 1"
          fill={colors[1]}
          radius={BAR_RADIUS}
          maxBarSize={MAX_BAR_SIZE / 2 + 4}
        />
        <Bar
          key={`${id}-2`}
          dataKey={keys[1]}
          name="Robot 2"
          fill={colors[2]}
          radius={BAR_RADIUS}
          maxBarSize={MAX_BAR_SIZE / 2 + 4}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <Section title="Robot 1 vs Robot 2" isDarkMode={isDarkMode}>
        <PairedBars
          isDarkMode={isDarkMode}
          series={[
            { name: 'Robot 1', color: colors[1] },
            { name: 'Robot 2', color: colors[2] },
          ]}
          rows={[
            {
              label: 'Leave rate',
              values: [percentOf(r1.leave), percentOf(r2.leave)],
              format: v => `${v}%`,
              max: 100,
            },
            {
              label: 'Park (Auto) rate',
              values: [percentOf(r1.parkAuto), percentOf(r2.parkAuto)],
              format: v => `${v}%`,
              max: 100,
            },
            {
              label: 'Park (End) rate',
              values: [percentOf(r1.parkEnd), percentOf(r2.parkEnd)],
              format: v => `${v}%`,
              max: 100,
            },
            {
              label: 'Leave + Park per match',
              values: [r1.avgLeaveParkPoints, r2.avgLeaveParkPoints],
              format: v => `${v} pts`,
            },
            ...(r2Shots
              ? [
                  {
                    label: 'Accuracy',
                    values: [pct(r1.accuracy), pct(r2.accuracy)],
                    format: (v: number) => `${v}%`,
                    max: 100,
                  },
                  {
                    label: 'Made per match',
                    values: [r1.madePerMatch, r2.madePerMatch],
                    format: (v: number) => String(v),
                  },
                ]
              : []),
          ]}
        />
        {!r2Shots && (
          <p className={`mt-4 text-xs ${muted(isDarkMode)}`}>
            Robot 2’s shots are counted when a teammate scores it live, so
            accuracy is compared once they have.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Section title="Leave + Park by Match" isDarkMode={isDarkMode}>
          {grouped(
            'points',
            'Leave and Park points by match',
            'The Leave and Park points each robot earned in each alliance match, side by side.',
            ['r1Points', 'r2Points'],
            v => `${v} pts`
          )}
        </Section>
        {r2Shots ? (
          <Section title="Shots Made by Match" isDarkMode={isDarkMode}>
            {grouped(
              'made',
              'Shots made by match',
              'Balls each robot made in each alliance match, side by side.',
              ['r1Made', 'r2Made'],
              v => String(v)
            )}
          </Section>
        ) : (
          <Section title="Leave and Park by Match" isDarkMode={isDarkMode}>
            <LeaveParkGrid
              matches={matches}
              robots={[1, 2]}
              isDarkMode={isDarkMode}
            />
          </Section>
        )}
      </div>

      {accuracyLines && (
        <Section title="Accuracy by Match" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart
              data={rows}
              accessibilityLayer={false}
              role="img"
              title="Accuracy by match, each robot"
              desc="Each robot's balls made out of balls shot in every alliance match; a gap is a match without its shots counted."
            >
              <CartesianGrid {...gridProps(isDarkMode)} />
              <XAxis
                dataKey="name"
                padding={{ left: 16, right: 16 }}
                {...axisProps(isDarkMode)}
              />
              <YAxis
                width={Y_AXIS_WIDTH}
                unit="%"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                {...axisProps(isDarkMode)}
              />
              <Tooltip
                wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                cursor={lineCursor(isDarkMode)}
                content={
                  <ChartTooltip
                    isDarkMode={isDarkMode}
                    titleKey="title"
                    formatValue={v => `${v}%`}
                  />
                }
              />
              <Legend {...LEGEND_PROPS} itemSorter={null} />
              {([1, 2] as const).map(r => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={`r${r}Accuracy`}
                  name={`Robot ${r}`}
                  stroke={colors[r]}
                  strokeWidth={2.5}
                  connectNulls={false}
                  {...dotProps(CARD_BG, colors[r])}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
      )}

      {r2Shots && (
        <Section title="Leave and Park by Match" isDarkMode={isDarkMode}>
          <LeaveParkGrid
            matches={matches}
            robots={[1, 2]}
            isDarkMode={isDarkMode}
          />
        </Section>
      )}

      {solo.length > 0 && (
        <Section title="Together vs Robot 1 Alone" isDarkMode={isDarkMode}>
          <PairedBars
            isDarkMode={isDarkMode}
            series={[
              {
                name: `Alliance (${plural(matches.length, 'match', 'matches')})`,
                color: colors[1],
              },
              {
                name: `Robot 1 alone (${plural(solo.length, 'match', 'matches')})`,
                color: toneOf(CHART_COLORS.average, isDarkMode),
              },
            ]}
            rows={[
              {
                label: 'Average score',
                values: [avgScore(matches), avgScore(solo)],
                format: v => `${v} pts`,
              },
              {
                label: 'Robot 1 accuracy',
                values: [pct(r1.accuracy), pct(soloR1.accuracy)],
                format: v => `${v}%`,
                max: 100,
              },
              {
                label: 'Robot 1 Leave + Park per match',
                values: [r1.avgLeaveParkPoints, soloR1.avgLeaveParkPoints],
                format: v => `${v} pts`,
              },
            ]}
          />
        </Section>
      )}
    </>
  );
};
