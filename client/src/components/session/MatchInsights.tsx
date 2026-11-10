import type { Match } from '@/types';
import { GAME_TIMING } from '@/constants';
import { StatTile } from '@/components/ui/stat-tile';
import {
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  formatAccuracy,
  includesAuto,
  includesTeleop,
  periodSplitOf,
  shotsOf,
  hasRobot2Shots,
  toneOf,
} from '@/lib';
import { formatPoints } from '@/lib/points';
import { cycleTimesOf, timedTipsOf } from '@/lib/scoring';
import { matchDurationSeconds } from '@/lib/matchClock';
import { Section } from './AnalysisSection';
import { formatVoltage } from '@/lib/battery';

/**
 * The tips that were tapped live, as seconds into the match. A typed count
 * or a correction isn't a moment in the match and isn't placed.
 */
const timelineOf = (match: Match): { tips: number[]; span: number } => {
  const type = match.matchType || 'Full Game';
  // A Full Game's clock runs 2:30 once its 3-2-1 is over
  const span =
    type === 'Full Game'
      ? GAME_TIMING.AUTONOMOUS_DURATION_SECONDS +
        GAME_TIMING.TELEOP_DURATION_SECONDS
      : matchDurationSeconds(type);
  const tips: number[] = [];
  let count = 0;
  for (const event of match.phaseLog ?? []) {
    if (!event || event.field !== 'tipping') continue;
    if (event.value === count + 1 && event.phase !== 'ended') {
      tips.push(Math.min(span, Math.max(0, span - event.timeRemaining)));
    } else if (event.value < count) {
      tips.splice(event.value - count);
    }
    count = event.value;
  }
  return { tips, span };
};

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * One match on its own, in the session analysis's tiles and cards: points
 * by period, accuracy, time between tips, and when its tips came.
 */
export const MatchInsights = ({
  match,
  isDarkMode,
}: {
  match: Match;
  isDarkMode: boolean;
}) => {
  const bothPeriods =
    includesAuto(match.matchType) && includesTeleop(match.matchType);
  const split = periodSplitOf(match);
  const shots = shotsOf(match);
  const cycles = cycleTimesOf(match);
  const timeline = timelineOf(match);
  const tipColor = toneOf(ELEMENT_COLORS.tipping, isDarkMode);
  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {bothPeriods && (
          <>
            <StatTile
              label="Auto"
              value={formatPoints(split.auto.points)}
              caption={plural(split.auto.tips, 'tip')}
              isDarkMode={isDarkMode}
            />
            <StatTile
              label="Teleop"
              value={formatPoints(split.teleop.points)}
              caption={plural(split.teleop.tips, 'tip')}
              isDarkMode={isDarkMode}
            />
          </>
        )}
        <StatTile
          label={ELEMENT_LABELS.accuracy}
          value={
            shots.accuracy === null ? null : formatAccuracy(shots.accuracy)
          }
          caption={
            shots.accuracy === null
              ? undefined
              : `${shots.made} of ${shots.made + shots.missed}`
          }
          isDarkMode={isDarkMode}
        />
        {hasRobot2Shots(match) && (
          <StatTile
            label="Robot 1 / Robot 2"
            value={[1, 2]
              .map(r => {
                const a = shotsOf(match, undefined, r as 1 | 2).accuracy;
                return a === null ? '–' : formatAccuracy(a);
              })
              .join(' / ')}
            caption="accuracy"
            isDarkMode={isDarkMode}
          />
        )}
        {typeof match.batteryVoltage === 'number' && (
          <StatTile
            label="Battery"
            value={formatVoltage(match.batteryVoltage)}
            caption="before the match"
            isDarkMode={isDarkMode}
          />
        )}
        {shots.pollen + shots.nectar + shots.nectarMissed > 0 && (
          <StatTile
            label="Pollen / Nectar"
            value={`${shots.pollen} / ${shots.nectar}`}
            caption={
              shots.nectarAccuracy === null
                ? 'made'
                : `Nectar ${formatAccuracy(shots.nectarAccuracy)} (${shots.nectar} of ${shots.nectar + shots.nectarMissed})`
            }
            isDarkMode={isDarkMode}
          />
        )}
        <StatTile
          label="Avg time between tips"
          value={cycles.length > 0 ? `${mean(cycles).toFixed(1)}s` : null}
          caption={
            cycles.length > 0
              ? `from ${plural(timedTipsOf(match), 'tip')}`
              : undefined
          }
          isDarkMode={isDarkMode}
        />
      </div>

      {timeline.tips.length > 0 && (
        <Section title={ELEMENT_LABELS.tipping} as="h3" isDarkMode={isDarkMode}>
          <div
            role="img"
            aria-label={`${plural(timeline.tips.length, 'tip')}, at ${timeline.tips
              .map(clock)
              .join(', ')}`}
            className={`relative h-6 rounded-md ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}
          >
            {/* AUTO's stretch of a Full Game, shaded */}
            {bothPeriods && (
              <div
                aria-hidden
                className={`absolute inset-y-0 left-0 rounded-l-md ${isDarkMode ? 'bg-white/10' : 'bg-gray-300'}`}
                style={{
                  width: `${(GAME_TIMING.AUTONOMOUS_DURATION_SECONDS / timeline.span) * 100}%`,
                }}
              />
            )}
            {timeline.tips.map((at, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute top-1 h-4 w-1 -translate-x-1/2 rounded-full"
                style={{
                  left: `${(at / timeline.span) * 100}%`,
                  backgroundColor: tipColor,
                }}
              />
            ))}
          </div>
          <div
            aria-hidden
            className={`mt-1 flex justify-between text-xs tabular-nums ${muted}`}
          >
            <span>0:00</span>
            <span>{clock(timeline.span)}</span>
          </div>
        </Section>
      )}
    </div>
  );
};
