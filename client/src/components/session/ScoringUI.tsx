import { useSession, useTheme } from '@/contexts';
import { useState, useRef, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { TUTORIAL_ENDED_EVENT } from '@/constants/events';

export const ScoringUI = () => {
  const { updateSessionData, sessionData, matchPhase, matchActive } = useSession();
  const { isDarkMode } = useTheme();
  const [flashingButton, setFlashingButton] = useState<string | null>(null);
  // Timestamp of the last scoring action, used to compute cycle time in seconds
  const lastShotTimeRef = useRef<number | null>(null);

  const [pingShot, setPingShot] = useState<{ ballsMade: number; ballsShot: number } | null>(null);
  const [pingKey, setPingKey] = useState(0);
  const pingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPing = (ballsMade: number, ballsShot: number) => {
    if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
    setPingShot({ ballsMade, ballsShot });
    setPingKey(k => k + 1);
    pingTimeoutRef.current = setTimeout(() => setPingShot(null), 1500);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ ballsMade: number; ballsShot: number }>;
      if (ce.detail) {
        showPing(ce.detail.ballsMade, ce.detail.ballsShot);
        const id = `${ce.detail.ballsShot}-${ce.detail.ballsMade}`;
        setFlashingButton(id);
        setTimeout(() => setFlashingButton(null), 400);
      }
      setKeyboardActiveRow(null);
      setKeyboardActiveMade(null);
    };
    window.addEventListener('teamtrack-shot-scored', handler);
    return () => window.removeEventListener('teamtrack-shot-scored', handler);
  }, []);

  const [keyboardActiveRow, setKeyboardActiveRow] = useState<number | null>(null);
  const [keyboardActiveMade, setKeyboardActiveMade] = useState<number | null>(null);

  useEffect(() => {
    const onShotType = (e: Event) => {
      const ce = e as CustomEvent<{ shotType: number }>;
      setKeyboardActiveRow(ce.detail.shotType);
      setKeyboardActiveMade(null);
    };
    const onMadeCount = (e: Event) => {
      const ce = e as CustomEvent<{ made: number; shotType: number }>;
      setKeyboardActiveRow(ce.detail.shotType);
      setKeyboardActiveMade(ce.detail.made);
    };
    const onCancelled = () => {
      setKeyboardActiveRow(null);
      setKeyboardActiveMade(null);
    };
    window.addEventListener('teamtrack-keybind-shottype', onShotType);
    window.addEventListener('teamtrack-keybind-madecount', onMadeCount);
    window.addEventListener('teamtrack-keybind-cancelled', onCancelled);
    window.addEventListener(TUTORIAL_ENDED_EVENT, onCancelled);
    return () => {
      window.removeEventListener('teamtrack-keybind-shottype', onShotType);
      window.removeEventListener('teamtrack-keybind-madecount', onMadeCount);
      window.removeEventListener('teamtrack-keybind-cancelled', onCancelled);
      window.removeEventListener(TUTORIAL_ENDED_EVENT, onCancelled);
    };
  }, []);

  const allShots = [...(sessionData.autonShots ?? []), ...(sessionData.teleopShots ?? [])];
  const totalShot = allShots.reduce((s, e) => s + ((e as {ballsShot: number}).ballsShot ?? 0), 0);
  const totalMade = allShots.reduce((s, e) => s + ((e as {ballsMade: number}).ballsMade ?? 0), 0);

  const shotTypes = [
    { id: 1, balls: 1 },
    { id: 2, balls: 2 },
    { id: 3, balls: 3 },
  ];

  const isScoringAllowed = (): boolean => {
    if (!matchActive) return false;
    if (sessionData.matchType === 'Autonomous') {
      // Autonomous mode: only allow auton phase scoring
      return (
        matchPhase === 'auton' ||
        matchPhase === 'controller_pickup'
      );
    } else if (sessionData.matchType === 'Teleop') {
      // Teleop mode: only allow teleop phase scoring
      return matchPhase === 'teleop';
    }
    // Full Game: always allow
    return true;
  };

  const handleBallSelect = (shotId: number, ballsMade: number) => {
    if (!isScoringAllowed()) {
      return;
    }

    const buttonId = `${shotId}-${ballsMade}`;

    setFlashingButton(buttonId);

    const now = Date.now();
    const cycleTime =
      lastShotTimeRef.current !== null
        ? parseFloat(((now - lastShotTimeRef.current) / 1000).toFixed(2))
        : undefined;
    lastShotTimeRef.current = now;

    // Determine phase by timer position:
    // Full Game: auton = timer > 120, teleop = timer <= 120
    // Autonomous: always auton scoring
    // Teleop: always teleop scoring
    const isAutonPhase =
      sessionData.matchType === 'Autonomous' ||
      (sessionData.matchType === 'Full Game' &&
        (matchPhase === 'auton' ||
          matchPhase === 'controller_pickup'));

    // Gate logic: classify vs overflow based on gate capacity (9)
    const GATE_CAPACITY = 9;
    const gateEnabled = sessionData.gateEnabled !== false;
    const currentGate = gateEnabled ? (sessionData.gateBallCount ?? 0) : 0;
    const spaceInGate = gateEnabled ? Math.max(0, GATE_CAPACITY - currentGate) : ballsMade;
    const classified = Math.min(ballsMade, spaceInGate);
    const overflow = ballsMade - classified;
    const newGateCount = gateEnabled ? currentGate + classified : 0;

    const shotEntry: { ballsShot: number; ballsMade: number; cycleTime?: number; classified?: number; overflow?: number } = {
      ballsShot: shotId,
      ballsMade,
      cycleTime,
      classified: gateEnabled ? classified : ballsMade,
      overflow: gateEnabled ? overflow : 0,
    };
    if (isAutonPhase) {
      const currentAutonShots = sessionData.autonShots || [];
      updateSessionData({
        autonShots: [...currentAutonShots, shotEntry],
        gateBallCount: newGateCount,
      });
    } else {
      const currentTeleopShots = sessionData.teleopShots || [];
      updateSessionData({
        teleopShots: [...currentTeleopShots, shotEntry],
        gateBallCount: newGateCount,
      });
    }

    showPing(ballsMade, shotId);

    setTimeout(() => {
      setFlashingButton(null);
    }, 400);
  };

  const isAutonPhase =
    sessionData.matchType === 'Autonomous' ||
    (sessionData.matchType === 'Full Game' &&
      (matchPhase === 'auton' ||
        matchPhase === 'controller_pickup'));
  const scoreLabel = isAutonPhase ? 'AUTON Score:' : 'TELEOP Score:';
  const displayScore = isAutonPhase
    ? (sessionData.autonomousScore ?? 0)
    : (sessionData.teleopScore ?? 0);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes shot-rise {
          0%   { opacity: 1; transform: translateY(0px); }
          60%  { opacity: 1; transform: translateY(-12px); }
          100% { opacity: 0; transform: translateY(-22px); }
        }
        .shot-ping-anim { animation: shot-rise 1.5s ease-out forwards; }
      `}</style>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-team-blue text-2xl font-semibold leading-6">
            Scoring
          </h2>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('teamtrack-open-keybind-tutorial'))}
            aria-label="Keyboard shortcuts"
            className={`p-1.5 rounded-full transition-colors translate-y-px ${isDarkMode ? 'hover:bg-team-white-10 text-team-white-60 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
          >
            <Keyboard className="w-6 h-6" />
          </button>
          {totalShot > 0 && (
            <div className="relative flex items-center ml-1">
              {pingShot && (
                <span
                  key={pingKey}
                  className="shot-ping-anim absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-green-400 whitespace-nowrap pointer-events-none"
                >
                  +{pingShot.ballsMade}/{pingShot.ballsShot}
                </span>
              )}
              <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {totalMade}/{totalShot} <span className="uppercase tracking-wide">Shots</span>
              </span>
            </div>
          )}
          {totalShot === 0 && pingShot && (
            <div className="relative flex items-center ml-1">
              <span
                key={pingKey}
                className="shot-ping-anim absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-green-400 whitespace-nowrap pointer-events-none"
              >
                +{pingShot.ballsMade}/{pingShot.ballsShot}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {scoreLabel}
          </span>
          <span className="text-2xl font-bold text-team-blue">
            {displayScore}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {shotTypes.map(shot => {
          const isActiveRow = keyboardActiveRow === shot.id;
          return (
            <div key={shot.id} className="flex items-stretch gap-4 w-full">
              <div className="flex items-center justify-center flex-shrink-0 min-w-[80px]">
                <div
                  className={`text-sm font-medium text-center transition-colors duration-150 ${
                    isActiveRow ? 'text-yellow-400 font-bold' : isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }`}
                >
                  {shot.id} {shot.id === 1 ? 'ball' : 'balls'}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1">
                {(() => {
                  const isMissedSelected = isActiveRow && keyboardActiveMade === 0;
                  const isRowYellow = isActiveRow && keyboardActiveMade === null;
                  return (
                    <button
                      onClick={() => handleBallSelect(shot.id, 0)}
                      disabled={!isScoringAllowed()}
                      className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                        !isScoringAllowed()
                          ? 'opacity-50 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800'
                          : flashingButton === `${shot.id}-0`
                            ? 'border-yellow-500 bg-yellow-500/20'
                            : isMissedSelected
                              ? 'border-green-500 bg-green-500/20 cursor-pointer'
                              : isRowYellow
                                ? 'border-yellow-400/70 bg-yellow-400/10 cursor-pointer'
                                : isDarkMode
                                  ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40 cursor-pointer'
                                  : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {Array.from({ length: shot.balls }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded-full border-2 border-dashed ${
                              flashingButton === `${shot.id}-0` ? 'border-yellow-500'
                              : isMissedSelected ? 'border-green-500'
                              : isRowYellow ? 'border-yellow-400/70'
                              : isDarkMode ? 'border-white' : 'border-black'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs mt-1 ${
                        flashingButton === `${shot.id}-0` ? 'text-yellow-500'
                        : isMissedSelected ? 'text-green-500'
                        : isRowYellow ? 'text-yellow-400/80'
                        : isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                      }`}>missed</span>
                    </button>
                  );
                })()}

                {Array.from({ length: shot.balls }).map((_, index) => {
                  const ballCount = index + 1;
                  const isFlashing = flashingButton === `${shot.id}-${ballCount}`;
                  const isMadeSelected = isActiveRow && keyboardActiveMade === ballCount;
                  const isRowActive = isActiveRow && keyboardActiveMade === null;

                  return (
                    <button
                      key={ballCount}
                      onClick={() => handleBallSelect(shot.id, ballCount)}
                      disabled={!isScoringAllowed()}
                      className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                        !isScoringAllowed()
                          ? 'opacity-50 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800'
                          : isFlashing || isMadeSelected
                            ? 'border-green-500 bg-green-500/20 cursor-pointer'
                            : isRowActive
                              ? 'border-yellow-400/70 bg-yellow-400/10 cursor-pointer'
                              : isDarkMode
                                ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40 cursor-pointer'
                                : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {Array.from({ length: ballCount }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded-full border-2 ${
                              isFlashing || isMadeSelected ? 'border-green-500'
                              : isRowActive ? 'border-yellow-400/70'
                              : isDarkMode ? 'border-white' : 'border-black'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs mt-1 ${
                        isFlashing || isMadeSelected ? 'text-green-500'
                        : isRowActive ? 'text-yellow-400/80'
                        : isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                      }`}>scored</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
