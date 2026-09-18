import { useSession, useTheme } from '@/contexts';
import { POINTS, calculateScore, scoreRows } from '@/lib';
import { ScoreField } from './ScoreField';

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="space-y-3">
      <div>
        <h3
          className={`text-sm font-bold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
};

/**
 * BIOBUZZ scores PARK twice per robot: once for parking by the end of AUTO,
 * once for parking by the end of the match. A robot can leave the loading
 * zone in between and still collect both.
 */
const RobotRow = ({
  label,
  leave,
  parkAuto,
  parkTeleop,
  onLeave,
  onParkAuto,
  onParkTeleop,
}: {
  label: string;
  leave: boolean;
  parkAuto: boolean;
  parkTeleop: boolean;
  onLeave: (v: boolean) => void;
  onParkAuto: (v: boolean) => void;
  onParkTeleop: (v: boolean) => void;
}) => {
  const { isDarkMode } = useTheme();
  const checkbox = (
    checked: boolean,
    onChange: (v: boolean) => void,
    text: string
  ) => (
    <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-team-blue cursor-pointer"
      />
      <span
        className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        {text}
      </span>
    </label>
  );

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className={`flex-1 min-w-0 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      {checkbox(leave, onLeave, 'Leave')}
      {checkbox(parkAuto, onParkAuto, 'Park (Auto)')}
      {checkbox(parkTeleop, onParkTeleop, 'Park (Teleop)')}
    </div>
  );
};

/**
 * Everything about the current match that is not counted live: the
 * end-of-match assessment, robot leave/park, penalties, and the running
 * score breakdown.
 */
export const MatchEntry = () => {
  const { sessionData, updateSessionData, matchPhase, matchActive } =
    useSession();
  const { isDarkMode } = useTheme();

  const breakdown = calculateScore(sessionData);
  const rows = scoreRows(sessionData);

  /**
   * Flower and hive contents are only knowable once the buzzer sounds, so
   * they stay locked while the clock is still running. Before a match starts
   * they are open, which is what lets a user correct an entry after the fact.
   */
  const matchOver = !matchActive || matchPhase === 'ended';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-team-blue text-2xl font-semibold leading-6">
          Match Entry
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Match Score:
          </span>
          <span className="text-3xl font-bold text-team-blue tabular-nums">
            {breakdown.total}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
        <Section
          title="End of Match"
          subtitle={
            matchOver
              ? 'Counted once the buzzer sounds'
              : 'Unlocks when the match ends'
          }
        >
          <ScoreField
            label="Flower"
            hint={`${POINTS.FLOWER_ELEMENT} pts each — in an owned flower`}
            value={sessionData.flower}
            points={breakdown.flower}
            disabled={!matchOver}
            onChange={v => updateSessionData({ flower: v })}
          />
          <ScoreField
            label="Flower Bonus"
            hint={`${POINTS.FLOWER_BONUS} pts each — bottom nectar, max 4`}
            max={4}
            value={sessionData.flowerBonus}
            points={breakdown.flowerBonus}
            disabled={!matchOver}
            onChange={v => updateSessionData({ flowerBonus: v })}
          />
          <ScoreField
            label="Left in Hive"
            hint={`${POINTS.CELL_REMAINING} pts each`}
            value={sessionData.ballsInHive}
            points={breakdown.hive}
            disabled={!matchOver}
            onChange={v => updateSessionData({ ballsInHive: v })}
          />
        </Section>

        <Section title="Penalties" subtitle="Credited to the opponent">
          <ScoreField
            label="Minor"
            hint={`-${POINTS.MINOR_PENALTY} pts each`}
            value={sessionData.minorPenalties}
            points={-(sessionData.minorPenalties * POINTS.MINOR_PENALTY)}
            onChange={v => updateSessionData({ minorPenalties: v })}
          />
          <ScoreField
            label="Major"
            hint={`-${POINTS.MAJOR_PENALTY} pts each`}
            value={sessionData.majorPenalties}
            points={-(sessionData.majorPenalties * POINTS.MAJOR_PENALTY)}
            onChange={v => updateSessionData({ majorPenalties: v })}
          />
        </Section>

        <Section
          title="Robots"
          subtitle={`Leave ${POINTS.LEAVE} pts · park ${POINTS.PARK} pts each, auto and teleop`}
        >
          <RobotRow
            label="Robot 1"
            leave={sessionData.robot1Leave}
            parkAuto={sessionData.robot1ParkAuto}
            parkTeleop={sessionData.robot1ParkTeleop}
            onLeave={v => updateSessionData({ robot1Leave: v })}
            onParkAuto={v => updateSessionData({ robot1ParkAuto: v })}
            onParkTeleop={v => updateSessionData({ robot1ParkTeleop: v })}
          />
          <RobotRow
            label="Robot 2"
            leave={sessionData.robot2Leave}
            parkAuto={sessionData.robot2ParkAuto}
            parkTeleop={sessionData.robot2ParkTeleop}
            onLeave={v => updateSessionData({ robot2Leave: v })}
            onParkAuto={v => updateSessionData({ robot2ParkAuto: v })}
            onParkTeleop={v => updateSessionData({ robot2ParkTeleop: v })}
          />
        </Section>

        <Section title="Breakdown">
          <div className="space-y-1">
            {rows.map(row => (
              <div
                key={row.key}
                className={`flex items-center justify-between text-sm py-1 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <span>{row.label}</span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span
                    className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}
                  >
                    x{row.count}
                  </span>
                  <span
                    className={`w-16 text-right font-semibold ${
                      row.points < 0 ? 'text-red-400' : 'text-team-blue'
                    }`}
                  >
                    {row.points}
                  </span>
                </span>
              </div>
            ))}
            <div
              className={`flex items-center justify-between text-sm font-bold pt-2 mt-1 border-t ${
                isDarkMode
                  ? 'border-gray-700 text-white'
                  : 'border-gray-200 text-gray-900'
              }`}
            >
              <span>Total</span>
              <span className="tabular-nums w-16 text-right text-team-blue">
                {breakdown.total}
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};
