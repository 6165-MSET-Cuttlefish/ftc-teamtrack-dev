import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import {
  ELEMENT_LABELS,
  FLOWERS_LABEL,
  RANKING_POINTS,
  calculateScore,
  scoreRows,
  type ScoreRow,
  type ScoringInput,
} from '@/lib';
import type { MatchScoringFields } from '@/types';
import { useScoringLocks } from './useScoringLocks';

/** "1 tip", "3 tips" */
const countOf = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** One line of the running breakdown: points, and what earned them */
interface BreakdownItem {
  key: string;
  label: string;
  points: number;
  /**
   * What was counted, in words ("3 pieces + 2 bonus"); empty when nothing
   * was. Never a multiplication: a growing "×N" beside the points reads as
   * a multiplier.
   */
  detail: string;
}

/**
 * The breakdown's lines in the order the page is scored: Hive Tips, the
 * robots, then the end-of-match counts. Flower and Flower Bonus are one
 * line, Flowers, as they are one group on the scoring page.
 */
const breakdownItems = (scoring: ScoringInput): BreakdownItem[] => {
  const rows = new Map(scoreRows(scoring).map(row => [row.key, row]));
  const line = (key: ScoreRow['key']) => ({
    count: rows.get(key)?.count ?? 0,
    points: rows.get(key)?.points ?? 0,
  });
  const tips = line('tipping');
  const leave = line('leave');
  const park = line('park');
  const flower = line('flower');
  const bonus = line('flowerBonus');
  const hive = line('hive');
  const garden = line('garden');
  const counted = (n: number, one: string) => (n > 0 ? countOf(n, one) : '');
  return [
    {
      key: 'tipping',
      label: ELEMENT_LABELS.tipping,
      points: tips.points,
      detail: counted(tips.count, 'tip'),
    },
    {
      key: 'leave',
      label: ELEMENT_LABELS.leave,
      points: leave.points,
      detail: counted(leave.count, 'robot'),
    },
    {
      key: 'park',
      label: ELEMENT_LABELS.park,
      points: park.points,
      detail: counted(park.count, 'park'),
    },
    {
      key: 'flowers',
      label: FLOWERS_LABEL,
      points: flower.points + bonus.points,
      detail: [
        counted(flower.count, 'piece'),
        bonus.count > 0 ? `${bonus.count} bonus` : '',
      ]
        .filter(Boolean)
        .join(' + '),
    },
    {
      key: 'hive',
      label: ELEMENT_LABELS.hive,
      points: hive.points,
      detail: counted(hive.count, 'piece'),
    },
    {
      key: 'garden',
      label: ELEMENT_LABELS.garden,
      points: garden.points,
      detail: counted(garden.count, 'piece'),
    },
  ];
};

/**
 * Progress toward one ranking point. `marks` are the thresholds (a bar can
 * carry more than one, e.g. POLLINATOR pays out at two tip counts).
 */
const RankingPointRow = ({
  name,
  value,
  marks,
  unit,
}: {
  name: string;
  value: number;
  marks: readonly number[];
  unit: string;
}) => {
  const { isDarkMode } = useTheme();
  const max = marks[marks.length - 1];
  const earned = marks.filter(m => value >= m).length;
  const next = marks.find(m => value < m);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span
          className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
        >
          {name}
        </span>
        <span
          className={`flex items-center gap-1 tabular-nums text-xs ${
            earned > 0
              ? // green-600 is under 4.5:1 on the light background
                `font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`
              : isDarkMode
                ? 'text-gray-400'
                : 'text-gray-600'
          }`}
        >
          {earned > 0 && <Check size={14} />}
          {earned > 0 ? `+${earned} RP` : ''}
          {next !== undefined && (
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              {earned > 0 ? ' · ' : ''}
              {value}/{next} {unit}
            </span>
          )}
        </span>
      </div>
      <div
        className={`relative h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
        role="progressbar"
        aria-label={`${name} progress`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        // Without this a screen reader reads a bare percentage of the last
        // threshold, which says nothing about the ranking point itself. Past
        // the last threshold there is nothing left to count toward.
        aria-valuetext={
          next === undefined
            ? `${value} ${unit}, ${earned} RP earned`
            : `${value} of ${next} ${unit}, ${earned} RP earned`
        }
      >
        <div
          className={`h-full rounded-full transition-all ${earned === marks.length ? 'bg-green-500' : 'bg-team-blue'}`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
        {marks.slice(0, -1).map(m => (
          <div
            key={m}
            className={`absolute top-0 h-full w-0.5 ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}
            style={{ left: `${(m / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};

/** Every input the announcer names, in the words used on the page */
const ANNOUNCED_FIELDS: ReadonlyArray<
  readonly [keyof MatchScoringFields, string]
> = [
  ['tipping', ELEMENT_LABELS.tipping],
  ['minorPenalties', ELEMENT_LABELS.minor],
  ['majorPenalties', ELEMENT_LABELS.major],
  ['robot1Leave', 'Robot 1 leave'],
  ['robot1ParkAuto', 'Robot 1 parked at end of auto'],
  ['robot1ParkTeleop', 'Robot 1 parked at end of match'],
  ['robot2Leave', 'Robot 2 leave'],
  ['robot2ParkAuto', 'Robot 2 parked at end of auto'],
  ['robot2ParkTeleop', 'Robot 2 parked at end of match'],
  ['flower', ELEMENT_LABELS.flower],
  ['flowerBonus', ELEMENT_LABELS.flowerBonus],
  ['ballsInHive', ELEMENT_LABELS.hive],
  ['garden', ELEMENT_LABELS.garden],
];

/** Long enough that a run of quick taps is read out once, at the end */
const ANNOUNCE_DELAY_MS = 600;

/**
 * Text for the page's one polite live region: "<field> <value>, total <N>"
 * after a scoring change. Stepper presses are otherwise silent to a screen
 * reader, and the total lives in a different part of the page.
 */
const useScoreAnnouncement = (
  fields: Partial<MatchScoringFields>,
  total: number
): string => {
  const [message, setMessage] = useState('');
  const previous = useRef(fields);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const changed = ANNOUNCED_FIELDS.filter(
      ([key]) => previous.current[key] !== fields[key]
    );
    previous.current = fields;
    if (changed.length === 0) return;

    // Emptied first so the same sentence twice in a row is still read out.
    setMessage('');
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      // Several fields at once is a match being loaded or cleared, not a
      // scoring action, so only the total is worth saying.
      if (changed.length > 1) {
        setMessage(`Total ${total}`);
        return;
      }
      const [key, label] = changed[0];
      const value = fields[key];
      const spoken =
        typeof value === 'boolean'
          ? value
            ? 'checked'
            : 'unchecked'
          : String(value);
      setMessage(`${label} ${spoken}, total ${total}`);
    }, ANNOUNCE_DELAY_MS);
  }, [fields, total]);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    []
  );

  return message;
};

/**
 * Running point breakdown for the current match. Split out of MatchEntry so
 * the desktop layout can pin it beside the inputs instead of below them.
 */
export const ScoreBreakdown = () => {
  const { sessionData } = useSessionCore();
  const { scoring } = useScoringLocks();
  const { isDarkMode } = useTheme();

  const breakdown = calculateScore(scoring);
  // Fouls are credited to the opponent, so they are not one of this
  // alliance's scoring rows; a scrim shows them on their own line below.
  const rows = breakdownItems(scoring);
  const isScrim = sessionData.sessionType === 'Scrim';
  const foulCount =
    (sessionData.minorPenalties ?? 0) + (sessionData.majorPenalties ?? 0);

  const announcement = useScoreAnnouncement(sessionData, breakdown.total);

  const countTone = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      {/*
        A layout that pins this card in a column that scrolls sets
        `--breakdown-head` to `sticky`: the heading and total then stay at
        the top of that column, so the running total is never scrolled away.
        The negative margins let the opaque strip cover the card's padding
        without moving anything.
      */}
      <div
        className={`top-0 z-10 -mx-4 -mt-4 -mb-3 flex items-center justify-between gap-4 rounded-t-[14px] px-4 pt-4 pb-3 [position:var(--breakdown-head,static)] ${
          isDarkMode ? 'bg-team-dark' : 'bg-white'
        }`}
      >
        <h2
          className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Breakdown
        </h2>
        <span className="text-3xl font-bold text-team-blue tabular-nums leading-none">
          {breakdown.total}
        </span>
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div className="space-y-0.5">
        {rows.map(row => (
          <div
            key={row.key}
            className={`flex items-center justify-between text-sm py-0.5 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            <span className="shrink-0">{row.label}</span>
            <span className="flex min-w-0 items-center gap-3 tabular-nums">
              <span className={`truncate text-xs ${countTone}`}>
                {row.detail}
              </span>
              <span className="w-12 shrink-0 text-right font-semibold text-team-blue">
                {row.points}
              </span>
            </span>
          </div>
        ))}
      </div>

      {isScrim && (
        <div
          className={`pt-2 border-t flex items-center justify-between text-sm ${
            isDarkMode
              ? 'border-gray-700 text-gray-300'
              : 'border-gray-200 text-gray-700'
          }`}
        >
          <span>{ELEMENT_LABELS.penalties}</span>
          <span className="flex items-center gap-3 tabular-nums">
            <span className={`text-xs ${countTone}`}>
              {countOf(foulCount, 'foul')}
            </span>
            <span
              className={`w-12 text-right font-semibold ${
                breakdown.penalties > 0
                  ? isDarkMode
                    ? 'text-red-400'
                    : 'text-red-700'
                  : countTone
              }`}
            >
              +{breakdown.penalties}
            </span>
          </span>
        </div>
      )}

      <div
        className={`pt-3 border-t space-y-2.5 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
      >
        <h3
          className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Ranking Points
        </h3>
        <RankingPointRow
          name="SWARM"
          value={breakdown.leave + breakdown.park}
          marks={[RANKING_POINTS.SWARM_ROBOT_POINTS]}
          unit="leave + park pts"
        />
        <RankingPointRow
          name="POLLINATOR"
          value={sessionData.tipping ?? 0}
          marks={RANKING_POINTS.POLLINATOR_TIPS}
          unit="tips"
        />
      </div>
    </div>
  );
};

/**
 * The breakdown as one band across the bottom of the desktop scoring pad:
 * the total, points per element (what was counted under them, in words),
 * then ranking points.
 * Same numbers as ScoreBreakdown, laid out across instead of down. Under
 * the `lg` breakpoint the ranking points move up beside the total and the
 * elements take a row of their own.
 */
export const BreakdownStrip = () => {
  const { sessionData } = useSessionCore();
  const { scoring } = useScoringLocks();
  const { isDarkMode } = useTheme();

  const breakdown = calculateScore(scoring);
  const items = breakdownItems(scoring);
  const isScrim = sessionData.sessionType === 'Scrim';
  const foulCount =
    (sessionData.minorPenalties ?? 0) + (sessionData.majorPenalties ?? 0);

  const announcement = useScoreAnnouncement(sessionData, breakdown.total);

  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const strong = isDarkMode ? 'text-white' : 'text-gray-900';
  const foul = isDarkMode ? 'text-red-400' : 'text-red-700';

  // Points are the number; what was counted sits on its own line under
  // them, so it can't be read as a multiplier. Flowers takes two columns
  // on a wide screen so "3 pieces + 2 bonus" fits on one line.
  const cell = (
    key: string,
    label: string,
    points: string,
    detail: string,
    tone: string,
    wide = false
  ) => (
    <div
      key={key}
      className={`flex min-w-0 flex-col justify-end ${wide ? 'lg:col-span-2' : ''}`}
    >
      <dt className={`mb-0.5 text-xs font-semibold leading-4 ${muted}`}>
        {label}
      </dt>
      <dd className="tabular-nums">
        <span className={`block text-2xl font-semibold leading-8 ${tone}`}>
          {points}
          <span className="sr-only"> points</span>
        </span>
        <span className={`block min-h-4 truncate text-xs leading-4 ${muted}`}>
          {detail}
        </span>
      </dd>
    </div>
  );

  return (
    <div
      data-tutorial="breakdown"
      className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-8 gap-y-4 rounded-2xl px-6 py-4 lg:flex lg:gap-8 ${
        isDarkMode ? 'bg-white/[0.04]' : 'bg-gray-100'
      }`}
    >
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div className="shrink-0">
        <h2 className={`mb-1 text-sm font-semibold ${muted}`}>Total</h2>
        <div
          data-breakdown-total
          className="text-5xl font-bold leading-none tabular-nums text-team-blue"
        >
          {breakdown.total}
        </div>
      </div>

      <dl
        className={`col-span-2 row-start-2 grid min-w-0 flex-1 gap-x-4 gap-y-3 grid-cols-4 ${
          isScrim ? 'lg:grid-cols-8' : 'lg:grid-cols-7'
        }`}
      >
        {items.map(item =>
          cell(
            item.key,
            item.label,
            String(item.points),
            item.detail,
            item.points > 0 ? strong : muted,
            item.key === 'flowers'
          )
        )}
        {isScrim &&
          cell(
            'penalties',
            ELEMENT_LABELS.penalties,
            `+${breakdown.penalties}`,
            foulCount > 0 ? countOf(foulCount, 'foul') : '',
            breakdown.penalties > 0 ? foul : muted
          )}
      </dl>

      <div className="col-start-2 row-start-1 min-w-0 space-y-2 lg:w-56 lg:shrink-0">
        <RankingPointRow
          name="SWARM"
          value={breakdown.leave + breakdown.park}
          marks={[RANKING_POINTS.SWARM_ROBOT_POINTS]}
          unit="pts"
        />
        <RankingPointRow
          name="POLLINATOR"
          value={sessionData.tipping ?? 0}
          marks={RANKING_POINTS.POLLINATOR_TIPS}
          unit="tips"
        />
      </div>
    </div>
  );
};
