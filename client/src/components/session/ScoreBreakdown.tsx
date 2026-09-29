import { Check } from 'lucide-react';
import { useSession, useTheme } from '@/contexts';
import { RANKING_POINTS, calculateScore, scoreRows } from '@/lib';

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
              ? 'text-green-600 font-semibold'
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

/**
 * Running point breakdown for the current match. Split out of MatchEntry so
 * the desktop layout can pin it beside the inputs instead of below them.
 */
export const ScoreBreakdown = () => {
  const { sessionData } = useSession();
  const { isDarkMode } = useTheme();

  const breakdown = calculateScore(sessionData);
  // Penalties are only tracked in scrims.
  const rows = scoreRows(sessionData).filter(
    row => row.key !== 'penalties' || sessionData.sessionType === 'Scrim'
  );

  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Breakdown
        </h2>
        <span className="text-3xl font-bold text-team-blue tabular-nums leading-none">
          {breakdown.total}
        </span>
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
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                x{row.count}
              </span>
              <span
                className={`w-12 text-right font-semibold ${
                  row.points < 0 ? 'text-red-500' : 'text-team-blue'
                }`}
              >
                {row.points}
              </span>
            </span>
          </div>
        ))}
      </div>

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
