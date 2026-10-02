import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSessionCore, useTheme } from '@/contexts';
import { RANKING_POINTS, calculateScore, scoreRows } from '@/lib';
import type { MatchScoringFields } from '@/types';
import { useScoringLocks } from './useScoringLocks';

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
  ['tipping', 'Tipping'],
  ['minorPenalties', 'Minor Penalty'],
  ['majorPenalties', 'Major Penalty'],
  ['robot1Leave', 'Robot 1 leave'],
  ['robot1ParkAuto', 'Robot 1 parked at end of auto'],
  ['robot1ParkTeleop', 'Robot 1 parked at end of match'],
  ['robot2Leave', 'Robot 2 leave'],
  ['robot2ParkAuto', 'Robot 2 parked at end of auto'],
  ['robot2ParkTeleop', 'Robot 2 parked at end of match'],
  ['flower', 'Flower'],
  ['flowerBonus', 'Flower Bonus'],
  ['ballsInHive', 'Left in Hive'],
  ['garden', 'Garden'],
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
  const rows = scoreRows(scoring).filter(row => row.key !== 'penalties');
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
            <span>{row.label}</span>
            <span className="flex items-center gap-3 tabular-nums">
              <span className={countTone}>x{row.count}</span>
              <span className="w-12 text-right font-semibold text-team-blue">
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
          <span>Given to opponent</span>
          <span className="flex items-center gap-3 tabular-nums">
            <span className={countTone}>x{foulCount}</span>
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
