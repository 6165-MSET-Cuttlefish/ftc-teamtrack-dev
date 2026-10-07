import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { useSessionCore, useTheme } from '@/contexts';
import { ELEMENT_LABELS, RANKING_POINTS, calculateScore } from '@/lib';
import { formatPoints } from '@/lib/points';
import type { MatchScoringFields, RobotCount } from '@/types';
import { useActiveSideBySide } from './layout/useActiveCompact';
import { usePenaltyCounters } from './usePenaltyCounters';
import { useScoringLocks } from './useScoringLocks';

/** What SWARM counts, in the same words on every layout */
const SWARM_UNIT = 'leave + park pts';

/**
 * SWARM where one robot can't reach it (13 leave + park pts at most, of the
 * 16 it takes): said in place of a bar that could never fill. Its count
 * stays on the line, as the one place Leave and Park points show (as
 * "pts" alone where the line is too narrow for its unit), and the row keeps
 * the bar's height, so the card is the same size either way. Where even
 * that line is too narrow (a phone zoomed to 200%), "needs 2 robots" takes
 * the line under it, with the count still on SWARM's line.
 */
const SwarmNeedsTwoRobots = ({ value }: { value: number }) => {
  const { isDarkMode } = useTheme();
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  return (
    <div className="min-w-0 space-y-1 [container-type:inline-size]">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span
          className={`font-semibold ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          SWARM
        </span>
        <span
          className={`whitespace-nowrap text-xs ${muted} [@container(max-width:12rem)]:order-last [@container(max-width:12rem)]:basis-full`}
        >
          needs 2 robots
        </span>
        <span
          className={`ml-auto whitespace-nowrap tabular-nums text-xs ${muted}`}
        >
          {value}{' '}
          <span className="[@container(max-width:17rem)]:hidden">
            {SWARM_UNIT}
          </span>
          <span className="hidden [@container(max-width:17rem)]:inline">
            pts
          </span>
        </span>
      </p>
      <div aria-hidden className="h-2" />
    </div>
  );
};

/**
 * Progress toward one ranking point. `marks` are the thresholds (a bar can
 * carry more than one, e.g. POLLINATOR pays out at two tip counts).
 *
 * Each threshold is a segment of its own, as wide as its share of the last
 * one and filled against its own range: POLLINATOR's first segment fills
 * over tips 1-4 and its second over 5-7. The label counts toward the next
 * threshold ("2/4 tips"), so it always describes the segment that is
 * filling, and a segment turns green once its ranking point is earned.
 * Past the last threshold the label keeps the count itself ("+1 RP · 21
 * leave + park pts"): SWARM's is the one place Leave and Park points show.
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
  const segments = marks.map((to, i) => {
    const from = i === 0 ? 0 : marks[i - 1];
    return {
      from,
      to,
      fill: Math.min(1, Math.max(0, (value - from) / (to - from))),
      earned: value >= to,
    };
  });

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span
          className={`font-semibold ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          {name}
        </span>
        <span
          className={`flex items-center gap-1 whitespace-nowrap tabular-nums text-xs ${
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
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            {earned > 0 ? ' · ' : ''}
            {next === undefined ? value : `${value}/${next}`} {unit}
          </span>
        </span>
      </div>
      <div
        className="flex h-2 gap-1"
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
        {segments.map(s => (
          <div
            key={s.to}
            className={`h-full min-w-0 overflow-hidden rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            style={{ flex: `${s.to - s.from} 1 0%` }}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${s.earned ? 'bg-green-500' : 'bg-team-blue'}`}
              style={{ width: `${s.fill * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * SWARM and POLLINATOR, the same on the phone and the desktop. SWARM is
 * left out of a match type with no AUTO: the end park alone can't reach it.
 * Its count, the robots' park points, then gets a line of its own beside
 * it (see `ScoreBreakdown` and `BreakdownStrip`), so they still show once.
 * With one robot it says it needs two, in place of its bar.
 */
const RankingPointRows = ({
  leavePark,
  tips,
  hasAuto,
  robots,
}: {
  leavePark: number;
  tips: number;
  hasAuto: boolean;
  robots: RobotCount;
}) => (
  <>
    {hasAuto &&
      (robots === 2 ? (
        <RankingPointRow
          name="SWARM"
          value={leavePark}
          marks={[RANKING_POINTS.SWARM_ROBOT_POINTS]}
          unit={SWARM_UNIT}
        />
      ) : (
        <SwarmNeedsTwoRobots value={leavePark} />
      ))}
    <RankingPointRow
      name="POLLINATOR"
      value={tips}
      marks={RANKING_POINTS.POLLINATOR_TIPS}
      unit="tips"
    />
  </>
);

/**
 * One plain number under the ranking points on the phone: the park points
 * of a match with no AUTO (no SWARM row to count them), what a Scrim's
 * fouls gave the opponent.
 */
const PointsLine = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm ${
        isDarkMode ? 'text-gray-300' : 'text-gray-700'
      }`}
    >
      <span>{label}</span>
      {children}
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
 * The phone's ranking points card, under the scoring fields: SWARM and
 * POLLINATOR, and in a Scrim what the fouls gave the opponent. Each
 * element's points are on its own counter, and Leave and Park on SWARM's
 * line (on a Park line of their own in a match with no AUTO), so they
 * aren't repeated here.
 *
 * The match total is in the header while a match runs, and on Save after
 * the buzzer. Where neither has it, it goes on this card's heading line:
 * while a saved match is being corrected (the header names the match, and
 * Save carries no points), and while a match runs on a phone held sideways
 * (the clock has a column of its own, and the header no centre label).
 * On the heading's line it takes no height, so nothing moves as it comes
 * and goes.
 *
 * Between matches the bars are there too, empty, so the card has one size
 * and nothing around it moves at Start.
 */
export const ScoreBreakdown = () => {
  const { sessionData, matchActive, matchPhase } = useSessionCore();
  const { scoring, editing, hasAuto, robots } = useScoringLocks();
  const { isDarkMode } = useTheme();
  const sideBySide = useActiveSideBySide();

  const breakdown = calculateScore(scoring);
  // What fouls gave the opponent shows wherever the foul counters do: in a
  // Scrim, and for a match with some after a switch to Practice
  const foulsShown = usePenaltyCounters().shown;
  const showTotal =
    editing || (sideBySide && matchActive && matchPhase !== 'ended');

  const announcement = useScoreAnnouncement(sessionData, breakdown.total);
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    // A tinted surface rather than a frame, as the desktop's band: the
    // controls above it are the outlined things on the page
    <div
      data-breakdown-card
      className={`rounded-2xl p-4 ${
        isDarkMode ? 'bg-white/[0.04]' : 'bg-gray-100'
      }`}
    >
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div className="space-y-2.5">
        {/* One fixed height, with or without the total on it */}
        <div className="flex h-4 items-baseline justify-between gap-3">
          <h2 className={EYEBROW_CLASS}>Ranking Points</h2>
          {showTotal && (
            <p className={`whitespace-nowrap text-xs leading-4 ${muted}`}>
              Total{' '}
              <span className="text-sm font-bold leading-4 tabular-nums text-foreground">
                {formatPoints(breakdown.total)}
              </span>
            </p>
          )}
        </div>
        <RankingPointRows
          leavePark={breakdown.leave + breakdown.park}
          tips={sessionData.tipping ?? 0}
          hasAuto={hasAuto}
          robots={robots}
        />
        {(!hasAuto || foulsShown) && (
          <div
            className={`space-y-1.5 border-t pt-2.5 ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
            }`}
          >
            {!hasAuto && (
              <PointsLine label={ELEMENT_LABELS.park}>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatPoints(breakdown.park)}
                </span>
              </PointsLine>
            )}
            {foulsShown && (
              <PointsLine label="To opponent">
                <span
                  className={`font-semibold tabular-nums ${
                    breakdown.penalties > 0
                      ? isDarkMode
                        ? 'text-red-400'
                        : 'text-red-700'
                      : muted
                  }`}
                >
                  +{formatPoints(breakdown.penalties)}
                </span>
              </PointsLine>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The band across the bottom of the desktop scoring pad: the match total
 * and the ranking points. The total's box holds three digits from the
 * start, so the bars beside it never shift as the score grows. Each
 * element's points are on its own counter above (Leave and Park on
 * SWARM's line), and what penalties gave the opponent is beside each
 * penalty counter, so neither is repeated here.
 *
 * Every heading in the band sits on its top line. A match with no AUTO has
 * no SWARM row: its park points take that half of the band instead, under
 * a heading of their own.
 */
export const BreakdownStrip = () => {
  const { sessionData, matchActive } = useSessionCore();
  const { scoring, editing, hasAuto, robots } = useScoringLocks();
  const { isDarkMode } = useTheme();

  const breakdown = calculateScore(scoring);
  const announcement = useScoreAnnouncement(sessionData, breakdown.total);
  // Between matches with nothing entered the total is a dash, not a big 0;
  // the bars are drawn empty, so they fill in at Start without moving
  // anything.
  const quiet =
    !matchActive &&
    !editing &&
    breakdown.total === 0 &&
    breakdown.penalties === 0;
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  /** A number with nothing behind it yet: a muted dash, read out as 0 */
  const none = (
    <>
      <span aria-hidden className={`text-sm font-normal leading-5 ${muted}`}>
        &mdash;
      </span>
      <span className="sr-only">0</span>
    </>
  );
  const rows = (
    <div
      className={`grid min-w-0 gap-x-8 gap-y-2 ${hasAuto ? 'lg:grid-cols-2' : ''}`}
    >
      <RankingPointRows
        leavePark={breakdown.leave + breakdown.park}
        tips={sessionData.tipping ?? 0}
        hasAuto={hasAuto}
        robots={robots}
      />
    </div>
  );

  return (
    <div
      data-tutorial="breakdown"
      className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-8 rounded-2xl px-6 py-4 ${
        isDarkMode ? 'bg-white/[0.04]' : 'bg-gray-100'
      }`}
    >
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div>
        <h2 className={`mb-1 ${EYEBROW_CLASS}`}>Total</h2>
        {/* One 48px box whatever it shows, so nothing under it moves */}
        <div
          data-breakdown-total
          className="flex h-12 min-w-[3ch] items-start text-5xl font-bold leading-none tabular-nums text-foreground"
        >
          {quiet ? <span className="mt-1 flex">{none}</span> : breakdown.total}
        </div>
      </div>

      {hasAuto ? (
        <div className="min-w-0 space-y-2">
          <h3 className={EYEBROW_CLASS}>Ranking Points</h3>
          {rows}
        </div>
      ) : (
        <div className="grid min-w-0 gap-x-8 gap-y-3 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h3 className={EYEBROW_CLASS}>Ranking Points</h3>
            {rows}
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className={EYEBROW_CLASS}>{ELEMENT_LABELS.park}</h3>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {quiet ? none : formatPoints(breakdown.park)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
