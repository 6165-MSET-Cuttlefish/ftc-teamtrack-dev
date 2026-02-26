import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from 'react';
import { useSession, useTheme } from '@/contexts';
import { Plus, Trash2 } from 'lucide-react';
import type { ShotEntry } from '@/types';
import {
  TUTORIAL_KEYBOARD_SCORE_EVENT,
  TUTORIAL_GATE_CYCLE_EVENT,
  TUTORIAL_ENDED_EVENT,
  TUTORIAL_METRICS_AUTON_TAB_EVENT,
  TUTORIAL_METRICS_LEAVE_EVENT,
  TUTORIAL_METRICS_SHOT_EDIT_EVENT,
  TUTORIAL_METRICS_MOTIF_EDIT_EVENT,
} from '@/constants/events';

const POINTS_PER_CLASSIFIED = 3;
const POINTS_PER_OVERFLOW = 1;
const GATE_CAPACITY = 9;

/** Migrate legacy number[] shots to ShotEntry[] */
const migrateShotsArray = (
  raw: ShotEntry[] | number[] | undefined
): ShotEntry[] => {
  if (!raw || raw.length === 0) return [];
  if (typeof raw[0] === 'number') {
    return (raw as number[]).map(made => ({
      ballsShot: made,
      ballsMade: made,
      classified: made,
      overflow: 0,
    }));
  }
  return raw as ShotEntry[];
};

const sumField = (shots: ShotEntry[], field: 'ballsShot' | 'ballsMade') =>
  shots.reduce((s, e) => s + e[field], 0);

const sumClassified = (shots: ShotEntry[]) =>
  shots.reduce((s, e) => s + (e.classified ?? e.ballsMade), 0);

const sumOverflow = (shots: ShotEntry[]) =>
  shots.reduce((s, e) => s + (e.overflow ?? 0), 0);

/** Points = classified * 3 + overflow * 1 */
const totalPoints = (shots: ShotEntry[]) =>
  shots.reduce((s, e) => {
    const cls = e.classified ?? e.ballsMade;
    const ovfl = e.overflow ?? 0;
    return s + cls * POINTS_PER_CLASSIFIED + ovfl * POINTS_PER_OVERFLOW;
  }, 0);

const countBits = (n: number): number => {
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  return count;
};

const calcAccuracy = (made: number, shot: number): string =>
  shot > 0 ? `${Math.round((made / shot) * 100)}%` : '—';

const calcAvgCycleTime = (shots: ShotEntry[]): string => {
  const cycleTimes = shots
    .map(s => s.cycleTime)
    .filter((t): t is number => t !== undefined);
  if (cycleTimes.length === 0) return '—';
  const avg = cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length;
  return `${avg.toFixed(2)}s`;
};

const BallVisualization: React.FC<{
  ballsMade: number;
  ballsShot: number;
  isDarkMode: boolean;
}> = ({ ballsMade, ballsShot, isDarkMode }) => (
  <div className="flex gap-1 items-center justify-center">
    {Array.from({ length: ballsShot }).map((_, i) => (
      <div
        key={i}
        className={`w-3 h-3 rounded-full border-2 ${
          i < ballsMade
            ? 'bg-team-blue border-team-blue'
            : isDarkMode
              ? 'border-gray-500 bg-transparent border-dashed'
              : 'border-gray-300 bg-transparent border-dashed'
        }`}
      />
    ))}
  </div>
);

const CellInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  max?: number;
  className?: string;
  readOnly?: boolean;
}> = memo(({ value, onChange, max, className, readOnly = false }) => {
  const [local, setLocal] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const prevVal = useRef(value);

  useEffect(() => {
    if (!focused && prevVal.current !== value) {
      setLocal(String(value));
      prevVal.current = value;
    }
  }, [value, focused]);

  const commit = () => {
    let n = local.trim() === '' ? 0 : parseInt(local, 10) || 0;
    if (n < 0) n = 0;
    if (max !== undefined && n > max) n = max;
    if (n !== value) onChange(n);
    setLocal(String(n));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={local}
      readOnly={readOnly}
      onChange={e => {
        const v = e.target.value;
        if (v === '' || /^\d+$/.test(v)) setLocal(v);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
});
CellInput.displayName = 'CellInput';

const CycleCellInput: React.FC<{
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  className?: string;
  readOnly?: boolean;
}> = memo(({ value, onChange, className, readOnly = false }) => {
  const [local, setLocal] = useState(
    value !== undefined ? String(value) : ''
  );
  const [focused, setFocused] = useState(false);
  const prevVal = useRef(value);

  useEffect(() => {
    if (!focused && prevVal.current !== value) {
      setLocal(value !== undefined ? String(value) : '');
      prevVal.current = value;
    }
  }, [value, focused]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed === '') {
      onChange(undefined);
    } else {
      const n = parseFloat(trimmed);
      if (!isNaN(n) && n >= 0) {
        const rounded = parseFloat(n.toFixed(2));
        onChange(rounded);
        setLocal(String(rounded));
      } else {
        setLocal(value !== undefined ? String(value) : '');
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      readOnly={readOnly}
      placeholder="—"
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
});
CycleCellInput.displayName = 'CycleCellInput';
const ShotLogTable: React.FC<{
  label: string;
  shots: ShotEntry[];
  onUpdate: (
    index: number,
    field: 'ballsShot' | 'ballsMade',
    value: number
  ) => void;
  onUpdateCycleTime: (index: number, value: number | undefined) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  editable: boolean;
  isDarkMode: boolean;
  bonusPoints?: number;
  bonusLabel?: string;
  /** When true, pulse-highlights the Shot and Made inputs of the first row */
  highlightFirstRow?: boolean;
  /** Whether gate scoring is enabled (show Cls/Ovfl columns) */
  gateEnabled?: boolean;
}> = memo(
  ({
    label,
    shots,
    onUpdate,
    onUpdateCycleTime,
    onAdd,
    onDelete,
    editable,
    isDarkMode,
    bonusPoints = 0,
    bonusLabel,
    highlightFirstRow = false,
    gateEnabled = true,
  }) => {
    const shotsTotal = totalPoints(shots);
    const sectionTotal = shotsTotal + bonusPoints;

    const gridCols = gateEnabled
      ? 'grid-cols-[32px_1fr_1fr_1fr_1fr_1fr_50px_1fr_32px]'
      : 'grid-cols-[32px_1fr_1fr_1fr_50px_1fr_32px]';

    const cycleTimes = shots
      .map(s => s.cycleTime)
      .filter((t): t is number => t !== undefined);
    const minCycle =
      cycleTimes.length > 0 ? Math.min(...cycleTimes) : null;
    const maxCycle =
      cycleTimes.length > 0 ? Math.max(...cycleTimes) : null;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3
            className={`text-sm font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </h3>
          <span className="text-team-blue font-bold text-lg">
            {sectionTotal} pts
          </span>
        </div>

        {/* Table */}
        <div
          className={`rounded-lg border overflow-hidden ${
            isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
          }`}
        >
          {/* Header */}
          <div
            className={`grid ${gridCols} text-xs font-semibold uppercase tracking-wide ${
              isDarkMode
                ? 'bg-team-dark-20 text-gray-400'
                : 'bg-gray-50 text-gray-500'
            }`}
          >
            <div className="px-1 py-2 text-center" title="Shot number">#</div>
            <div className="px-1 py-2 text-center cursor-help" title="Number of balls shot">Shot</div>
            <div className="px-1 py-2 text-center cursor-help" title="Number of balls made">Made</div>
            {gateEnabled && <div className="px-1 py-2 text-center cursor-help" title="Classified artifacts (3 pts each)">Cls</div>}
            {gateEnabled && <div className="px-1 py-2 text-center cursor-help" title="Overflow artifacts (1 pt each)">Ovfl</div>}
            <div className="px-1 py-2 text-center cursor-help" title="Points scored">Pts</div>
            <div className="px-1 py-2 text-center cursor-help" title="Time elapsed since last shot (seconds)">Cycle</div>
            <div className="px-1 py-2 text-center cursor-help" title="Visual representation of balls made vs shot">Balls</div>
            <div className="px-1 py-2" />
          </div>

          {/* Rows */}
          {shots.length === 0 ? (
            <div
              className={`px-4 py-6 text-center text-sm ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              No shots recorded yet
            </div>
          ) : (
            shots.map((shot, i) => {
              const cls = shot.classified ?? shot.ballsMade;
              const ovfl = shot.overflow ?? 0;
              const pts = cls * POINTS_PER_CLASSIFIED + ovfl * POINTS_PER_OVERFLOW;
              
              const ct = shot.cycleTime;
              const isMin =
                ct !== undefined &&
                minCycle !== null &&
                ct === minCycle &&
                cycleTimes.length > 1;
              const isMax =
                ct !== undefined &&
                maxCycle !== null &&
                ct === maxCycle &&
                cycleTimes.length > 1;
              const cycleClass = isMin
                ? 'text-green-500 font-semibold'
                : isMax
                  ? 'text-red-500 font-semibold'
                  : isDarkMode
                    ? 'text-gray-400'
                    : 'text-gray-500';
              
              return (
                <div
                  key={i}
                  className={`grid ${gridCols} items-center border-t ${
                    isDarkMode
                      ? 'border-white/5 even:bg-white/[0.02]'
                      : 'border-gray-100 even:bg-gray-50/50'
                  }`}
                >
                  <div
                    className={`px-1 py-2 text-center text-base font-semibold ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className={`px-1 py-1.5 flex justify-center`}>
                    <CellInput
                      value={shot.ballsShot}
                      onChange={v => onUpdate(i, 'ballsShot', v)}
                      max={10}
                      readOnly={!editable}
                      className={`w-12 h-9 text-center text-sm font-medium rounded border transition-colors ${i === 0 && highlightFirstRow ? 'shot-number-blink' : ''} ${
                        isDarkMode
                          ? 'bg-team-dark border-team-blue-40 text-white focus:ring-1 focus:ring-team-blue/30'
                          : 'bg-white border-gray-200 text-black focus:ring-1 focus:ring-team-blue/30'
                      } focus:outline-none`}
                    />
                  </div>
                  <div className={`px-1 py-1.5 flex justify-center`}>
                    <CellInput
                      value={shot.ballsMade}
                      onChange={v => {
                        const clamped = Math.min(v, shot.ballsShot);
                        onUpdate(i, 'ballsMade', clamped);
                      }}
                      max={shot.ballsShot}
                      readOnly={!editable}
                      className={`w-12 h-9 text-center text-sm font-medium rounded border transition-colors ${i === 0 && highlightFirstRow ? 'shot-number-blink' : ''} ${
                        isDarkMode
                          ? 'bg-team-dark border-team-blue-40 text-white focus:ring-1 focus:ring-team-blue/30'
                          : 'bg-white border-gray-200 text-black focus:ring-1 focus:ring-team-blue/30'
                      } focus:outline-none`}
                    />
                  </div>
                  {gateEnabled && <div
                    className={`px-1 py-2 text-center text-xs font-semibold ${
                      cls > 0 ? 'text-green-500' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {cls}
                  </div>}
                  {gateEnabled && <div
                    className={`px-1 py-2 text-center text-xs font-semibold ${
                      ovfl > 0 ? 'text-orange-500' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {ovfl}
                  </div>}
                  <div
                    className={`px-1 py-2 text-center text-sm font-semibold ${
                      isDarkMode ? 'text-white' : 'text-black'
                    }`}
                  >
                    {pts}
                  </div>
                  <div className={`px-1 py-1.5 flex justify-center`}>
                    <CycleCellInput
                      value={ct}
                      onChange={v => onUpdateCycleTime(i, v)}
                      readOnly={!editable}
                      className={`w-[46px] h-9 text-center text-xs font-medium rounded border transition-colors focus:outline-none placeholder:text-gray-400 ${
                        editable
                          ? isDarkMode
                            ? 'bg-team-dark border-team-blue-40 focus:ring-1 focus:ring-team-blue/30'
                            : 'bg-white border-gray-200 focus:ring-1 focus:ring-team-blue/30'
                          : 'bg-transparent border-transparent pointer-events-none'
                      } ${cycleClass}`}
                    />
                  </div>
                  <div className="px-1 py-2 flex justify-center">
                    <BallVisualization ballsMade={shot.ballsMade} ballsShot={shot.ballsShot} isDarkMode={isDarkMode} />
                  </div>
                  <div className="px-0.5 py-1.5 flex justify-center">
                    {editable && (
                      <button
                        onClick={() => onDelete(i)}
                        className={`p-1 rounded transition-colors ${
                          isDarkMode
                            ? 'text-gray-600 hover:text-red-400'
                            : 'text-gray-300 hover:text-red-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Footer totals */}
          {shots.length > 0 && (
            <div
              className={`grid ${gridCols} items-center border-t-2 ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark-20'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="px-1 py-2" />
              <div
                className={`px-1 py-2 text-center text-xs font-bold ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {sumField(shots, 'ballsShot')}
              </div>
              <div
                className={`px-1 py-2 text-center text-xs font-bold ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {sumField(shots, 'ballsMade')}
              </div>
              {gateEnabled && <div
                className={`px-1 py-2 text-center text-xs font-bold text-green-500`}
              >
                {sumClassified(shots)}
              </div>}
              {gateEnabled && <div
                className={`px-1 py-2 text-center text-xs font-bold text-orange-500`}
              >
                {sumOverflow(shots)}
              </div>}
              <div
                className={`px-1 py-2 text-center text-xs font-bold ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
              >
                {shotsTotal}
              </div>
              <div
                className={`px-1 py-2 text-center text-xs font-semibold ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
                title="Average cycle time across all shots in this phase"
              >
                {calcAvgCycleTime(shots)}
              </div>
              <div className="px-1 py-2" />
            </div>
          )}
        </div>

        {/* Bonus line */}
        {bonusLabel && bonusPoints > 0 && (
          <div
            className={`flex items-center justify-between text-xs px-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <span>+ {bonusLabel}</span>
            <span className="font-semibold">+{bonusPoints} pts</span>
          </div>
        )}

        {/* Add Shot button */}
        {editable && (
          <button
            onClick={onAdd}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-sm font-medium transition-colors ${
              isDarkMode
                ? 'border-team-blue-40 text-gray-400 hover:text-team-blue hover:border-team-blue'
                : 'border-gray-300 text-gray-400 hover:text-team-blue hover:border-team-blue'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Shot
          </button>
        )}
      </div>
    );
  }
);
ShotLogTable.displayName = 'ShotLogTable';

const ScoreCard: React.FC<{
  label: string;
  value: number;
  selected?: boolean;
  highlight?: boolean;
  isDarkMode: boolean;
  onClick?: () => void;
}> = ({
  label,
  value,
  selected = false,
  highlight = false,
  isDarkMode,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center justify-center rounded-lg border px-3 py-3 transition-all cursor-pointer ${
      selected
        ? 'border-team-blue ring-2 ring-team-blue/30 bg-team-blue/10'
        : highlight
          ? 'border-team-blue bg-team-blue/5 hover:bg-team-blue/10'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark hover:bg-team-dark-20'
            : 'border-gray-200 bg-white hover:bg-gray-50'
    }`}
  >
    <span
      className={`text-xs font-medium uppercase tracking-wide ${
        isDarkMode ? 'text-gray-400' : 'text-gray-500'
      }`}
    >
      {label}
    </span>
    <span
      className={`text-2xl font-bold ${
        selected || highlight
          ? 'text-team-blue'
          : isDarkMode
            ? 'text-white'
            : 'text-black'
      }`}
    >
      {value}
    </span>
  </button>
);

export const ScoringMetrics = () => {
  const {
    sessionData,
    updateSessionData,
    editingMatchId,
    matchActive,
    matchPhase,
    timer,
    isTimerRunning,
  } = useSession();
  const { isDarkMode } = useTheme();

  const isEditable = matchActive || editingMatchId !== null;
  const isUpdatingRef = useRef(false);
  // Track last shot timestamp for cycle time calculation in keybinds
  const lastShotTimeRef = useRef<number | null>(null);

  const [selectedTab, setSelectedTab] = useState<
    'final' | 'autonomous' | 'teleop' | 'endgame'
  >('final');

  const [autonomousLeave, setAutonomousLeave] = useState(
    sessionData.autonLeave || 0
  );
  const [robot1Park, setRobot1Park] = useState<'none' | 'partial' | 'full'>(
    sessionData.robot1Park || 'none'
  );
  const [robot2Park, setRobot2Park] = useState<'none' | 'partial' | 'full'>(
    sessionData.robot2Park || 'none'
  );

  // Shot logs — derived directly from sessionData so ScoringUI writes
  //   are immediately visible without needing local state sync.
  const autonShots = useMemo(
    () => migrateShotsArray(sessionData.autonShots),
    [sessionData.autonShots]
  );
  const teleopShots = useMemo(
    () => migrateShotsArray(sessionData.teleopShots),
    [sessionData.teleopShots]
  );

  const updateAutonShot = useCallback(
    (index: number, field: 'ballsShot' | 'ballsMade', value: number) => {
      const current = migrateShotsArray(sessionData.autonShots);
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      if (field === 'ballsShot' && next[index].ballsMade > value) {
        next[index].ballsMade = value;
      }
      updateSessionData({ autonShots: next });
      setMetricsHintMask(prev => prev & ~0b010);
      window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_SHOT_EDIT_EVENT));
    },
    [sessionData.autonShots, updateSessionData]
  );

  const updateTeleopShot = useCallback(
    (index: number, field: 'ballsShot' | 'ballsMade', value: number) => {
      const current = migrateShotsArray(sessionData.teleopShots);
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      if (field === 'ballsShot' && next[index].ballsMade > value) {
        next[index].ballsMade = value;
      }
      updateSessionData({ teleopShots: next });
      setMetricsHintMask(prev => prev & ~0b010);
      window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_SHOT_EDIT_EVENT));
    },
    [sessionData.teleopShots, updateSessionData]
  );

  const updateAutonShotCycleTime = useCallback(
    (index: number, value: number | undefined) => {
      const current = migrateShotsArray(sessionData.autonShots);
      const next = [...current];
      next[index] = { ...next[index], cycleTime: value };
      updateSessionData({ autonShots: next });
    },
    [sessionData.autonShots, updateSessionData]
  );

  const updateTeleopShotCycleTime = useCallback(
    (index: number, value: number | undefined) => {
      const current = migrateShotsArray(sessionData.teleopShots);
      const next = [...current];
      next[index] = { ...next[index], cycleTime: value };
      updateSessionData({ teleopShots: next });
    },
    [sessionData.teleopShots, updateSessionData]
  );

  const addAutonShot = useCallback(() => {
    const current = migrateShotsArray(sessionData.autonShots);
    updateSessionData({
      autonShots: [...current, { ballsShot: 0, ballsMade: 0 }],
    });
  }, [sessionData.autonShots, updateSessionData]);

  const addTeleopShot = useCallback(() => {
    const current = migrateShotsArray(sessionData.teleopShots);
    updateSessionData({
      teleopShots: [...current, { ballsShot: 0, ballsMade: 0 }],
    });
  }, [sessionData.teleopShots, updateSessionData]);

  const deleteAutonShot = useCallback(
    (index: number) => {
      const current = migrateShotsArray(sessionData.autonShots);
      updateSessionData({ autonShots: current.filter((_, i) => i !== index) });
    },
    [sessionData.autonShots, updateSessionData]
  );

  const deleteTeleopShot = useCallback(
    (index: number) => {
      const current = migrateShotsArray(sessionData.teleopShots);
      updateSessionData({ teleopShots: current.filter((_, i) => i !== index) });
    },
    [sessionData.teleopShots, updateSessionData]
  );

  const autonShotsScore = useMemo(() => totalPoints(autonShots), [autonShots]);
  const teleopShotsScore = useMemo(
    () => totalPoints(teleopShots),
    [teleopShots]
  );
  const autonLeaveBonus = autonomousLeave * 3;
  const autonMotifBonus = countBits(sessionData.autonMotif ?? 0) * 2;
  const teleMotifBonus = countBits(sessionData.teleMotif ?? 0) * 2;

  const autonomousScore = autonShotsScore + autonLeaveBonus + autonMotifBonus;
  const teleopScore = teleopShotsScore + teleMotifBonus;

  let endGameScore = 0;
  const r1 = robot1Park === 'partial' ? 5 : robot1Park === 'full' ? 10 : 0;
  const r2 = robot2Park === 'partial' ? 5 : robot2Park === 'full' ? 10 : 0;
  if (robot1Park === 'full' && robot2Park === 'full') {
    endGameScore = 30;
  } else {
    endGameScore = r1 + r2;
  }

  const finalScore = autonomousScore + teleopScore + endGameScore;

  const updateScores = useCallback(() => {
    isUpdatingRef.current = true;
    updateSessionData({
      autonomousScore,
      teleopScore,
      endGameScore,
      finalScore,
      autonLeave: autonomousLeave,
      autonClassifiedArtifact: sumClassified(autonShots),
      autonOverflowArtifact: sumOverflow(autonShots),
      autonBallsMissed:
        sumField(autonShots, 'ballsShot') - sumField(autonShots, 'ballsMade'),
      teleClassifiedArtifact: sumClassified(teleopShots),
      teleOverflowArtifact: sumOverflow(teleopShots),
      teleBallsMissed:
        sumField(teleopShots, 'ballsShot') - sumField(teleopShots, 'ballsMade'),
      robot1Park,
      robot2Park,
      autonMotif: sessionData.autonMotif ?? 0,
      teleMotif: sessionData.teleMotif ?? 0,
      motifPattern: sessionData.motifPattern,
    });
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, [
    autonomousScore,
    teleopScore,
    endGameScore,
    finalScore,
    autonomousLeave,
    autonShots,
    teleopShots,
    robot1Park,
    robot2Park,
    sessionData.autonMotif,
    sessionData.teleMotif,
    sessionData.motifPattern,
    updateSessionData,
  ]);

  useEffect(() => {
    const t = setTimeout(updateScores, 200);
    return () => clearTimeout(t);
  }, [updateScores]);

  const [cycleTimerStartTime, setCycleTimerStartTime] = useState<number | null>(
    null
  );
  const [cycleTimerElapsed, setCycleTimerElapsed] = useState(0);

  // Reset last shot time tracking when:
  // 1. Match ends (matchPhase === 'ended')
  // 2. Timer is paused (!isTimerRunning)
  // 3. Match is not active (!matchActive)
  // 4. Starting a new match (matchPhase === 'auton' after being inactive)
  // Also reset the cycle timer display when match ends to prevent carryover to next match
  useEffect(() => {
    if (matchPhase === 'ended' || !isTimerRunning || !matchActive || matchPhase === 'auton') {
      lastShotTimeRef.current = null;
      if (matchPhase === 'ended' || matchPhase === 'auton') {
        setCycleTimerStartTime(null);
        setCycleTimerElapsed(0);
      }
    }
  }, [matchPhase, isTimerRunning, matchActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cycleTimerStartTime !== null && !sessionData.isSessionCompleted) {
      interval = setInterval(() => {
        setCycleTimerElapsed(
          Math.floor((Date.now() - cycleTimerStartTime) / 1000)
        );
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cycleTimerStartTime, sessionData.isSessionCompleted]);

  const recordCycleTime = useCallback(() => {
    if (cycleTimerStartTime === null) {
      setCycleTimerStartTime(Date.now());
    } else {
      updateSessionData({
        cycleTimes: [...(sessionData.cycleTimes ?? []), cycleTimerElapsed],
      });
      setCycleTimerStartTime(Date.now());
      setCycleTimerElapsed(0);
    }
  }, [
    cycleTimerStartTime,
    cycleTimerElapsed,
    sessionData.cycleTimes,
    updateSessionData,
  ]);

  const prevEditingMatchIdRef = useRef<string | null>(null);
  const prevSessionDataRef = useRef(sessionData);

  useEffect(() => {
    if (isUpdatingRef.current) return;

    const justStartedEditing =
      editingMatchId !== null &&
      prevEditingMatchIdRef.current !== editingMatchId;

    const prevHadValues =
      prevSessionDataRef.current.autonClassifiedArtifact ||
      prevSessionDataRef.current.autonLeave ||
      prevSessionDataRef.current.teleClassifiedArtifact;

    const currentAllZero =
      !sessionData.autonClassifiedArtifact &&
      !sessionData.autonLeave &&
      !sessionData.teleClassifiedArtifact;

    const justResetToZeros = prevHadValues && currentAllZero;

    if (justResetToZeros || justStartedEditing) {
      setAutonomousLeave(sessionData.autonLeave || 0);
      setRobot1Park(sessionData.robot1Park || 'none');
      setRobot2Park(sessionData.robot2Park || 'none');
      lastShotTimeRef.current = null; // Reset cycle time tracking when match is reset or edited
      // autonShots / teleopShots are derived from sessionData — no local sync needed
    }

    prevEditingMatchIdRef.current = editingMatchId;
    prevSessionDataRef.current = sessionData;
  }, [sessionData, editingMatchId]);

  // Auto-switch to teleop tab when phase transitions (once per match)
  // Using a ref so the switch only fires the first time, allowing the user
  // to navigate back to the Autonomous tab manually afterwards.
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (matchPhase === 'auton') {
      autoSwitchedRef.current = false; // reset for next match
    }
    if (matchPhase === 'teleop' && !autoSwitchedRef.current) {
      autoSwitchedRef.current = true;
      setSelectedTab('teleop');
    }
  }, [matchPhase]);

  // Auto-switch to endgame tab when timer reaches <= 20 seconds in Full Game or Teleop mode
  // Using a ref so the switch only fires once when entering the last 20 seconds
  const autoSwitchedToEndgameRef = useRef(false);
  useEffect(() => {
    if (matchPhase === 'auton') {
      autoSwitchedToEndgameRef.current = false; // reset for next match
    }
    if (
      (sessionData.matchType === 'Full Game' || sessionData.matchType === 'Teleop') &&
      matchPhase === 'teleop' &&
      timer <= 20 &&
      !autoSwitchedToEndgameRef.current
    ) {
      autoSwitchedToEndgameRef.current = true;
      setSelectedTab('endgame');
    }
  }, [timer, matchPhase, sessionData.matchType]);

  const [showPopup, setShowPopup] = useState(false);
  // Bitmask: bit 0 = leave hint, bit 1 = shot hint, bit 2 = motif hint
  const [metricsHintMask, setMetricsHintMask] = useState(0);
  const [popupNumber, setPopupNumber] = useState<string>('');
  const [madeCount, setMadeCount] = useState<number | null>(null);

  // Clear keybind popup + hints when tutorial ends
  useEffect(() => {
    const handler = () => {
      setShowPopup(false);
      setMadeCount(null);
      setMetricsHintMask(0);
    };
    window.addEventListener(TUTORIAL_ENDED_EVENT, handler);
    return () => window.removeEventListener(TUTORIAL_ENDED_EVENT, handler);
  }, []);

  // Open Autonomous tab + activate hints when the tutorial reaches Scoring Metrics
  useEffect(() => {
    const handler = () => {
      setSelectedTab('autonomous');
      setMetricsHintMask(0b111);
    };
    window.addEventListener(TUTORIAL_METRICS_AUTON_TAB_EVENT, handler);
    return () => window.removeEventListener(TUTORIAL_METRICS_AUTON_TAB_EVENT, handler);
  }, []);

  // Clear hints when tutorial moves to a different step
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.target !== 'metrics') setMetricsHintMask(0);
    };
    window.addEventListener('teamtrack-tutorial-step-changed', handler);
    return () => window.removeEventListener('teamtrack-tutorial-step-changed', handler);
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Guard: don't process keyboard input if user is typing in a field
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      // Also check if we're inside any input-like container by walking DOM tree
      let el: HTMLElement | null = target;
      let depth = 0;
      while (el && depth < 10) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.contentEditable === 'true') {
          return;
        }
        el = el.parentElement;
        depth++;
      }

      // Handle G keybind for gate
      if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        event.stopPropagation();
        if (!sessionData.gateAddBackMode) {
          // First G press: open gate
          if ((sessionData.gateBallCount ?? 0) > 0) {
            // Opening gate only clears teleMotif if after the 10s teleop motif window
            // Opening gate during auto/early-teleop does NOT clear already-scored autonMotif
            const isAfterTeleopWindow = matchActive && matchPhase === 'teleop';
            updateSessionData({
              gateAddBackMode: true,
              gateAddBackCount: 0,
              ...(isAfterTeleopWindow && { teleMotif: 0 }),
            });
          }
        } else {
          // Second G press: confirm gate open
          const addBackCount = sessionData.gateAddBackCount ?? 0;
          updateSessionData({
            gateBallCount: addBackCount,
            gateAddBackMode: false,
            gateAddBackCount: 0,
          });
          // Full gate cycle completed via G→G shortcut
          window.dispatchEvent(new CustomEvent(TUTORIAL_GATE_CYCLE_EVENT, { detail: { method: 'keyboard' } }));
        }
        return;
      }

      // Handle gate add-back mode (0-9 sets how many balls stay; Enter also confirms; Escape cancels)
      if (sessionData.gateAddBackMode) {
        if (event.key === '0') {
          event.preventDefault();
          event.stopPropagation();
          updateSessionData({ gateAddBackCount: 0 });
          return;
        }
        if (/^[1-9]$/.test(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          const count = parseInt(event.key);
          const maxCount = sessionData.gateBallCount ?? 0;
          if (count <= maxCount) {
            // Set directly — no toggle. Only 0 key resets to 0.
            updateSessionData({
              gateAddBackCount: count,
            });
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          updateSessionData({
            gateAddBackMode: false,
            gateAddBackCount: 0,
          });
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          const addBackCount = sessionData.gateAddBackCount ?? 0;
          updateSessionData({
            gateBallCount: addBackCount,
            gateAddBackMode: false,
            gateAddBackCount: 0,
          });
          // Full gate cycle completed (G → number → Enter)
          window.dispatchEvent(new CustomEvent(TUTORIAL_GATE_CYCLE_EVENT, { detail: { method: 'keyboard' } }));
        }
        return;
      }

      if (!matchActive) return;

      // Handle shot type selection (1, 2, 3 balls shot)
      if (['1', '2', '3'].includes(event.key)) {
        if (!showPopup) {
          setPopupNumber(event.key);
          setMadeCount(null);
          setShowPopup(true);
          // Tell ScoringUI to highlight this row
          window.dispatchEvent(new CustomEvent('teamtrack-keybind-shottype', { detail: { shotType: parseInt(event.key) } }));
        }
      }

      // Handle made count selection (0-3 balls made) when popup is open
      if (showPopup && ['0', '1', '2', '3'].includes(event.key)) {
        const pressed = parseInt(event.key);
        if (pressed <= parseInt(popupNumber)) {
          setMadeCount(pressed);
          // Tell ScoringUI to highlight the specific cell
          window.dispatchEvent(new CustomEvent('teamtrack-keybind-madecount', { detail: { made: pressed, shotType: parseInt(popupNumber) } }));
        }
      }

      if (event.key === 'Enter' && showPopup && madeCount !== null) {
        event.preventDefault();
        event.stopPropagation();

        const shotType = parseInt(popupNumber);
        // Use matchPhase to determine if we're in auton or teleop (same logic as ScoringUI)
        // controller_pickup and prepare phases are part of the auton→teleop transition, so count as autonomous
        const isAutonPhase =
          sessionData.matchType === 'Autonomous' ||
          (sessionData.matchType === 'Full Game' &&
            (matchPhase === 'auton' ||
              matchPhase === 'controller_pickup'));

        // Compute cycle time in seconds with 2 decimal precision (same as ScoringUI)
        const now = Date.now();
        const cycleTime =
          lastShotTimeRef.current !== null
            ? parseFloat(((now - lastShotTimeRef.current) / 1000).toFixed(2))
            : undefined;
        lastShotTimeRef.current = now;

        // Gate logic: classify vs overflow based on gate capacity
        const currentGate = sessionData.gateBallCount ?? 0;
        const spaceInGate = Math.max(0, GATE_CAPACITY - currentGate);
        const classified = Math.min(madeCount, spaceInGate);
        const overflow = madeCount - classified;
        const newGateCount = currentGate + classified;

        const entry: ShotEntry = {
          ballsShot: shotType,
          ballsMade: madeCount,
          cycleTime,
          classified,
          overflow,
        };

        if (isAutonPhase) {
          const nextAuton = [
            ...migrateShotsArray(sessionData.autonShots),
            entry,
          ];
          updateSessionData({ autonShots: nextAuton, gateBallCount: newGateCount });
        } else {
          const nextTeleop = [
            ...migrateShotsArray(sessionData.teleopShots),
            entry,
          ];
          updateSessionData({ teleopShots: nextTeleop, gateBallCount: newGateCount });
          if (sessionData.selectedFeature === 'Cycle Times') recordCycleTime();
        }
        // Notify tutorial that a shot was confirmed via keyboard
        window.dispatchEvent(new CustomEvent(TUTORIAL_KEYBOARD_SCORE_EVENT));
        // Notify ScoringUI to show ping notification
        window.dispatchEvent(new CustomEvent('teamtrack-shot-scored', {
          detail: { ballsMade: madeCount, ballsShot: shotType }
        }));

        setShowPopup(false);
        setMadeCount(null);
        return;
      }

      if (event.key === 'Escape' && showPopup) {
        event.preventDefault();
        event.stopPropagation();
        setShowPopup(false);
        setMadeCount(null);
        window.dispatchEvent(new Event('teamtrack-keybind-cancelled'));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    showPopup,
    popupNumber,
    madeCount,
    sessionData.matchType,
    sessionData.selectedFeature,
    sessionData.autonShots,
    sessionData.teleopShots,
    sessionData.gateBallCount,
    sessionData.gateAddBackCount,
    sessionData.gateAddBackMode,
    recordCycleTime,
    matchActive,
    matchPhase,
    updateSessionData,
  ]);

  const showAuton = sessionData.matchType !== 'Teleop';
  const showTeleop = sessionData.matchType !== 'Autonomous';
  const showEndgame = sessionData.matchType !== 'Autonomous';
  const hasMotifEnabled = sessionData.motifPattern !== undefined;

  return (
    <>
      {/* M button flash animation */}
      <style>{`
        @keyframes motifMFlash {
          0%, 100% {
            color: rgb(var(--team-blue) / 0.95);
            text-shadow: 0 0 8px rgb(var(--team-blue) / 0.6),
                         0 0 14px rgb(var(--team-blue) / 0.4);
          }
          48%, 52% {
            color: white;
            text-shadow: 0 0 12px rgba(255, 255, 255, 0.8),
                         0 0 20px rgba(255, 255, 255, 0.5);
          }
        }
        .motif-m-flash {
          animation: motifMFlash 2.5s ease-in-out infinite;
        }
        @keyframes autonLeaveFlash {
          0%, 100% {
            color: rgb(var(--team-blue) / 0.9);
            text-shadow: 0 0 8px rgb(var(--team-blue) / 0.5),
                         0 0 14px rgb(var(--team-blue) / 0.3);
          }
          48%, 52% {
            color: white;
            text-shadow: 0 0 12px rgba(255, 255, 255, 0.8),
                         0 0 20px rgba(255, 255, 255, 0.5);
          }
        }
        .auton-leave-flash {
          animation: autonLeaveFlash 2.5s ease-in-out infinite;
        }
        @keyframes shotNumberBlink {
          0%, 100% {
            color: rgb(var(--team-blue) / 0.95);
            text-shadow: 0 0 6px rgb(var(--team-blue) / 0.5),
                         0 0 12px rgb(var(--team-blue) / 0.3);
          }
          48%, 52% {
            color: white;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.8),
                         0 0 16px rgba(255, 255, 255, 0.5);
          }
        }
        .shot-number-blink {
          animation: shotNumberBlink 2.5s ease-in-out infinite;
        }
      `}</style>
      <div className="flex flex-col gap-6" data-tutorial="metrics">
        <h2 className="text-team-blue text-2xl font-semibold leading-6">
          Scoring Metrics
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreCard
            label="Final"
            value={finalScore}
            selected={selectedTab === 'final'}
            isDarkMode={isDarkMode}
            onClick={() => setSelectedTab('final')}
          />
          {showAuton && (
            <ScoreCard
              label="Autonomous"
              value={autonomousScore}
              isDarkMode={isDarkMode}
              selected={selectedTab === 'autonomous'}
              onClick={() => setSelectedTab('autonomous')}
            />
          )}
          {showTeleop && (
            <ScoreCard
              label="TeleOp"
              value={teleopScore}
              isDarkMode={isDarkMode}
              selected={selectedTab === 'teleop'}
              onClick={() => setSelectedTab('teleop')}
            />
          )}
          {showEndgame && (
            <ScoreCard
              label="Endgame"
              value={endGameScore}
              isDarkMode={isDarkMode}
              selected={selectedTab === 'endgame'}
              onClick={() => setSelectedTab('endgame')}
            />
          )}
        </div>

        {selectedTab === 'final' && (
          <div
            className={`rounded-lg border overflow-hidden ${
              isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
            }`}
          >
            {/* header */}
            <div
              className={`grid grid-cols-[1fr_70px_70px_60px_60px_70px_75px_70px] text-xs font-semibold uppercase tracking-wide ${
                isDarkMode
                  ? 'bg-team-dark-20 text-gray-400'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <div className="px-4 py-2">Phase</div>
              <div className="px-3 py-2 text-center cursor-help" title="Number of balls shot">Shot</div>
              <div className="px-3 py-2 text-center cursor-help" title="Number of balls made">Made</div>
              <div className="px-3 py-2 text-center cursor-help" title="Classified artifacts (3 pts each)">Cls</div>
              <div className="px-3 py-2 text-center cursor-help" title="Overflow artifacts (1 pt each)">Ovfl</div>
              <div className="px-3 py-2 text-center cursor-help" title="Accuracy percentage">Acc</div>
              <div className="px-3 py-2 text-center cursor-help" title="Total points scored">Points</div>
              <div className="px-3 py-2 text-center cursor-help" title="Average cycle time (seconds)">Cyc</div>
            </div>

            {/* Autonomous row */}
            {showAuton && (
              <div
                className={`grid grid-cols-[1fr_70px_70px_60px_60px_70px_75px_70px] items-center border-t ${
                  isDarkMode ? 'border-white/5' : 'border-gray-100'
                }`}
              >
                <div
                  className={`px-4 py-3 text-sm font-medium font-mono ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  Autonomous{autonomousLeave > 0 ? ' (incl. leave +3)' : ''}
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {sumField(autonShots, 'ballsShot')}
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {sumField(autonShots, 'ballsMade')}
                </div>
                <div className="px-3 py-3 text-center text-sm font-semibold text-green-500">
                  {sumClassified(autonShots)}
                </div>
                <div className="px-3 py-3 text-center text-sm font-semibold text-orange-500">
                  {sumOverflow(autonShots)}
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {calcAccuracy(
                    sumField(autonShots, 'ballsMade'),
                    sumField(autonShots, 'ballsShot')
                  )}
                </div>
                <div className="px-3 py-3 text-center text-sm font-bold text-team-blue">
                  {autonomousScore}
                </div>
                <div
                  className={`px-3 py-3 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  {calcAvgCycleTime(autonShots)}
                </div>
              </div>
            )}

            {/* TeleOp row */}
            {showTeleop && (
              <div
                className={`grid grid-cols-[1fr_70px_70px_60px_60px_70px_75px_70px] items-center border-t ${
                  isDarkMode ? 'border-white/5' : 'border-gray-100'
                }`}
              >
                <div
                  className={`px-4 py-3 text-sm font-medium font-mono ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  TeleOp
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {sumField(teleopShots, 'ballsShot')}
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {sumField(teleopShots, 'ballsMade')}
                </div>
                <div className="px-3 py-3 text-center text-sm font-semibold text-green-500">
                  {sumClassified(teleopShots)}
                </div>
                <div className="px-3 py-3 text-center text-sm font-semibold text-orange-500">
                  {sumOverflow(teleopShots)}
                </div>
                <div
                  className={`px-3 py-3 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {calcAccuracy(
                    sumField(teleopShots, 'ballsMade'),
                    sumField(teleopShots, 'ballsShot')
                  )}
                </div>
                <div className="px-3 py-3 text-center text-sm font-bold text-team-blue">
                  {teleopScore}
                </div>
                <div
                  className={`px-3 py-3 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  {calcAvgCycleTime(teleopShots)}
                </div>
              </div>
            )}

            {/* Endgame row */}
            {showEndgame && (
            <div
              className={`grid grid-cols-[1fr_70px_70px_60px_60px_70px_75px_70px] items-center border-t ${
                isDarkMode ? 'border-white/5' : 'border-gray-100'
              }`}
            >
              <div
                className={`px-4 py-3 text-sm font-medium font-mono ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Endgame
              </div>
              <div
                className={`px-3 py-3 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {robot1Park !== 'none' || robot2Park !== 'none'
                  ? [
                      robot1Park !== 'none' ? `R1 ${robot1Park}` : '',
                      robot2Park !== 'none' ? `R2 ${robot2Park}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : '—'}
              </div>
              <div className="px-3 py-3 text-center text-sm" />
              <div className="px-3 py-3 text-center text-sm" />
              <div className="px-3 py-3 text-center text-sm" />
              <div
                className={`px-3 py-3 text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
              >
                —
              </div>
              <div className="px-3 py-3 text-center text-sm font-bold text-team-blue">
                {endGameScore}
              </div>
              <div className="px-3 py-3 text-center text-sm" />
            </div>
            )}

            {/* Total footer */}
            <div
              className={`grid grid-cols-[1fr_70px_70px_60px_60px_70px_75px_70px] items-center border-t-2 ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark-20'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div
                className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Total
              </div>
              <div
                className={`px-3 py-3 text-center text-base font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {sumField(autonShots, 'ballsShot') +
                  sumField(teleopShots, 'ballsShot')}
              </div>
              <div
                className={`px-3 py-3 text-center text-base font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {sumField(autonShots, 'ballsMade') +
                  sumField(teleopShots, 'ballsMade')}
              </div>
              <div className="px-3 py-3 text-center text-sm font-bold text-green-500">
                {sumClassified(autonShots) + sumClassified(teleopShots)}
              </div>
              <div className="px-3 py-3 text-center text-sm font-bold text-orange-500">
                {sumOverflow(autonShots) + sumOverflow(teleopShots)}
              </div>
              <div
                className={`px-3 py-3 text-center text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {calcAccuracy(
                  sumField(autonShots, 'ballsMade') +
                    sumField(teleopShots, 'ballsMade'),
                  sumField(autonShots, 'ballsShot') +
                    sumField(teleopShots, 'ballsShot')
                )}
              </div>
              <div className="px-3 py-3 text-center text-sm font-extrabold text-team-blue">
                {finalScore}
              </div>
              <div
                className={`px-3 py-3 text-center text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                {calcAvgCycleTime([...autonShots, ...teleopShots])}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'autonomous' && showAuton && (
          <div className="flex flex-col gap-6" data-tutorial="scoring">
            {/* Leave + Motif row */}
            <div className={`rounded-xl p-3 flex flex-col gap-3 ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}>
              {/* Leave */}
              <label
                className={`flex items-center gap-2 cursor-pointer select-none text-sm px-3 py-2 rounded-lg transition-all ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
              >
                <input
                  type="checkbox"
                  checked={autonomousLeave > 0}
                  onChange={e => {
                    const v = e.target.checked ? 1 : 0;
                    setAutonomousLeave(v);
                    setMetricsHintMask(prev => prev & ~0b001);
                    window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_LEAVE_EVENT));
                  }}
                  disabled={!isEditable}
                  className="accent-team-blue w-4 h-4"
                />
                <span className={metricsHintMask & 0b001 ? 'auton-leave-flash' : ''}>
                  Autonomous Leave
                </span>
                <span className="text-xs text-gray-400">(+3 pts)</span>
              </label>

              {/* Autonomous Motif */}
              {hasMotifEnabled && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Autonomous Motif
                    <span className="ml-1 text-gray-400 normal-case font-normal">(+2 pts each)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const mask = sessionData.autonMotif ?? 0;
                      const pattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
                      return Array.from({ length: GATE_CAPACITY }).map((_, i) => {
                        const isOn = !!(mask & (1 << i));
                        const color = pattern[i % 3];
                        const isPurple = color === 'purple' || color === 'empty';
                        return (
                        <button
                          key={i}
                          onClick={() => {
                            if (!isEditable) return;
                            let newMask = mask;
                            newMask ^= (1 << i);
                            updateSessionData({ autonMotif: newMask });
                            setMetricsHintMask(prev => prev & ~0b100);
                            window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_MOTIF_EDIT_EVENT));
                          }}
                          disabled={!isEditable}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all duration-150 ${metricsHintMask & 0b100 ? 'motif-m-flash' : ''} ${
                            isEditable ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                          }`}
                          style={{
                            backgroundColor: isOn
                              ? (isPurple
                                  ? (isDarkMode ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.15)')
                                  : (isDarkMode ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'))
                              : 'transparent',
                            borderColor: isOn
                              ? (isPurple ? '#a855f7' : '#10b981')
                              : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                            color: isOn
                              ? (isPurple ? '#a855f7' : '#10b981')
                              : (isDarkMode ? '#4b5563' : '#d1d5db'),
                          }}
                          title={`Toggle auton motif ${i + 1}`}
                        >
                          M
                        </button>
                        );
                      });
                    })()}
                  </div>
                </div>
                <span className={`text-sm font-bold ${
                  (sessionData.autonMotif ?? 0) > 0 ? 'text-amber-400' : isDarkMode ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {countBits(sessionData.autonMotif ?? 0) * 2} pts
                </span>
              </div>
              )}
            </div>

            <ShotLogTable
              label="Autonomous Shots"
              shots={autonShots}
              onUpdate={updateAutonShot}
              onUpdateCycleTime={updateAutonShotCycleTime}
              onAdd={addAutonShot}
              onDelete={deleteAutonShot}
              editable={isEditable}
              isDarkMode={isDarkMode}
              bonusPoints={autonLeaveBonus}
              bonusLabel={autonomousLeave > 0 ? 'Leave Bonus' : undefined}
              highlightFirstRow={!!(metricsHintMask & 0b010) && autonShots.length > 0}
              gateEnabled={sessionData.gateEnabled !== false}
            />
          </div>
        )}

        {selectedTab === 'teleop' && showTeleop && (
          <div className="flex flex-col gap-6">
            {/* Teleop Motif */}
            {hasMotifEnabled && (
            <div className={`rounded-xl p-3 flex items-center justify-between ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}>
              <div className="flex flex-col gap-1">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Teleop Motif
                  <span className="ml-1 text-gray-400 normal-case font-normal">(+2 pts each)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const mask = sessionData.teleMotif ?? 0;
                    const pattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
                    return Array.from({ length: GATE_CAPACITY }).map((_, i) => {
                      const isOn = !!(mask & (1 << i));
                      const color = pattern[i % 3];
                      const isPurple = color === 'purple' || color === 'empty';
                      return (
                      <button
                        key={i}
                        onClick={() => {
                          if (!isEditable) return;
                          let newMask = mask;
                          newMask ^= (1 << i);
                          updateSessionData({ teleMotif: newMask });
                          setMetricsHintMask(prev => prev & ~0b100);
                          window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_MOTIF_EDIT_EVENT));
                        }}
                        disabled={!isEditable}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all duration-150 ${metricsHintMask & 0b100 ? 'motif-m-flash' : ''} ${
                          isEditable ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                        }`}
                        style={{
                          backgroundColor: isOn
                            ? (isPurple
                                ? (isDarkMode ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.15)')
                                : (isDarkMode ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'))
                            : 'transparent',
                          borderColor: isOn
                            ? (isPurple ? '#a855f7' : '#10b981')
                            : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                          color: isOn
                            ? (isPurple ? '#a855f7' : '#10b981')
                            : (isDarkMode ? '#4b5563' : '#d1d5db'),
                        }}
                        title={`Toggle teleop motif ${i + 1}`}
                      >
                        M
                      </button>
                      );
                    });
                  })()}
                </div>
              </div>
              <span className={`text-sm font-bold ${
                (sessionData.teleMotif ?? 0) > 0 ? 'text-amber-400' : isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {countBits(sessionData.teleMotif ?? 0) * 2} pts
              </span>
            </div>
            )}

            <ShotLogTable
              label="TeleOp Shots"
              shots={teleopShots}
              onUpdate={updateTeleopShot}
              onUpdateCycleTime={updateTeleopShotCycleTime}
              onAdd={addTeleopShot}
              onDelete={deleteTeleopShot}
              editable={isEditable}
              isDarkMode={isDarkMode}
              gateEnabled={sessionData.gateEnabled !== false}
            />
          </div>
        )}

        {selectedTab === 'endgame' && showEndgame && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3
                className={`text-sm font-semibold uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Endgame
              </h3>
              <span className="text-team-blue font-bold text-lg">
                {endGameScore} pts
              </span>
            </div>

            {/* Endgame summary table */}
            <div
              className={`rounded-lg border overflow-hidden ${
                isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div
                className={`grid grid-cols-[1fr_1fr_80px] text-xs font-semibold uppercase tracking-wide ${
                  isDarkMode
                    ? 'bg-team-dark-20 text-gray-400'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                <div className="px-3 py-2">Robot</div>
                <div className="px-2 py-2 text-center">Park Status</div>
                <div className="px-2 py-2 text-center">Points</div>
              </div>

              {/* Robot 1 */}
              <div
                className={`grid grid-cols-[1fr_1fr_80px] items-center border-t ${
                  isDarkMode ? 'border-white/5' : 'border-gray-100'
                }`}
              >
                <div
                  className={`px-3 py-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  Robot 1
                </div>
                <div className="px-2 py-2">
                  <div className="flex gap-0 rounded-lg overflow-hidden border border-team-blue-40">
                    {(['none', 'partial', 'full'] as const).map(val => (
                      <button
                        key={val}
                        onClick={e => {
                          e.currentTarget.blur();
                          setRobot1Park(val);
                        }}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          robot1Park === val
                            ? isDarkMode
                              ? 'bg-team-blue text-black'
                              : 'bg-team-blue text-white'
                            : isDarkMode
                              ? 'bg-team-dark text-white hover:bg-team-dark-20'
                              : 'bg-[#FEFEFE] text-black hover:bg-gray-100'
                        }`}
                      >
                        {val === 'none'
                          ? 'None'
                          : val === 'partial'
                            ? 'Partial'
                            : 'Full'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-2 py-3 text-center text-sm font-bold text-team-blue">
                  {robot1Park === 'partial'
                    ? 5
                    : robot1Park === 'full'
                      ? robot2Park === 'full'
                        ? 15
                        : 10
                      : 0}
                </div>
              </div>

              {/* Robot 2 */}
              <div
                className={`grid grid-cols-[1fr_1fr_80px] items-center border-t ${
                  isDarkMode ? 'border-white/5' : 'border-gray-100'
                }`}
              >
                <div
                  className={`px-3 py-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  Robot 2
                </div>
                <div className="px-2 py-2">
                  <div className="flex gap-0 rounded-lg overflow-hidden border border-team-blue-40">
                    {(['none', 'partial', 'full'] as const).map(val => (
                      <button
                        key={val}
                        onClick={e => {
                          e.currentTarget.blur();
                          setRobot2Park(val);
                        }}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          robot2Park === val
                            ? isDarkMode
                              ? 'bg-team-blue text-black'
                              : 'bg-team-blue text-white'
                            : isDarkMode
                              ? 'bg-team-dark text-white hover:bg-team-dark-20'
                              : 'bg-[#FEFEFE] text-black hover:bg-gray-100'
                        }`}
                      >
                        {val === 'none'
                          ? 'None'
                          : val === 'partial'
                            ? 'Partial'
                            : 'Full'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-2 py-3 text-center text-sm font-bold text-team-blue">
                  {robot2Park === 'partial'
                    ? 5
                    : robot2Park === 'full'
                      ? robot1Park === 'full'
                        ? 15
                        : 10
                      : 0}
                </div>
              </div>

              {/* Total footer */}
              <div
                className={`grid grid-cols-[1fr_1fr_80px] items-center border-t-2 ${
                  isDarkMode
                    ? 'border-team-blue-40 bg-team-dark-20'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div
                  className={`px-3 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  Total
                </div>
                <div className="px-2 py-3" />
                <div className="px-2 py-3 text-center text-sm font-extrabold text-team-blue">
                  {endGameScore}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
