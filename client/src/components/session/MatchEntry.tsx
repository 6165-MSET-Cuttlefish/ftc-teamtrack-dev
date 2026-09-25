import { Check } from 'lucide-react';
import { useSession, useTheme } from '@/contexts';
import { calculateScore } from '@/lib';
import { ScoreField } from './ScoreField';

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="space-y-2">
      <h3
        className={`text-lg font-bold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {title}
      </h3>
      {children}
    </div>
  );
};

/** A large tap-target toggle, used in place of a small checkbox. */
const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`h-11 px-2 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 select-none ${
        checked
          ? 'border-team-blue bg-team-blue/15 text-team-blue'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {checked && <Check size={16} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
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
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr_1fr] items-center gap-2">
      <div
        className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </div>
      <Toggle checked={leave} onChange={onLeave} label="Leave" />
      <Toggle checked={parkAuto} onChange={onParkAuto} label="Park Auto" />
      <Toggle checked={parkTeleop} onChange={onParkTeleop} label="Park Tele" />
    </div>
  );
};

/**
 * Everything about the current match that is not counted live: the
 * end-of-match assessment and robot leave/park. Penalties are scrim-only
 * and live in LiveScoring; the running total lives in ScoreBreakdown.
 */
export const MatchEntry = () => {
  const { sessionData, updateSessionData, matchPhase, matchActive } =
    useSession();

  const breakdown = calculateScore(sessionData);

  /**
   * Flower and hive contents are only knowable once the buzzer sounds, so
   * they stay locked while the clock is still running. Before a match starts
   * they are open, which is what lets a user correct an entry after the fact.
   */
  const matchOver = !matchActive || matchPhase === 'ended';

  return (
    <div className="space-y-4">
      <h2 className="text-team-blue text-xl font-semibold leading-6">
        Match Entry
      </h2>

      <Section title="Robots">
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

      <Section title="End of Match">
        <ScoreField
          size="large"
          stepper
          label="Flower"
          value={sessionData.flower}
          points={breakdown.flower}
          disabled={!matchOver}
          onChange={v => updateSessionData({ flower: v })}
        />
        <ScoreField
          size="large"
          stepper
          label="Flower Bonus"
          max={4}
          value={sessionData.flowerBonus}
          points={breakdown.flowerBonus}
          disabled={!matchOver}
          onChange={v => updateSessionData({ flowerBonus: v })}
        />
        <ScoreField
          size="large"
          stepper
          label="Left in Hive"
          value={sessionData.ballsInHive}
          points={breakdown.hive}
          disabled={!matchOver}
          onChange={v => updateSessionData({ ballsInHive: v })}
        />
      </Section>
    </div>
  );
};
