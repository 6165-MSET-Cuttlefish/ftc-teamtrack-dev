import { useSession, useTheme } from '@/contexts';
import { calculateScore, scoreRows } from '@/lib';

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
          className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
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
              <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
                x{row.count}
              </span>
              <span
                className={`w-12 text-right font-semibold ${
                  row.points < 0 ? 'text-red-400' : 'text-team-blue'
                }`}
              >
                {row.points}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
