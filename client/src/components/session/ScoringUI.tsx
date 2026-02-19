import { useSession, useTheme } from '@/contexts';
import { useState, useRef } from 'react';

export const ScoringUI = () => {
  const { updateSessionData, sessionData, matchPhase } = useSession();
  const { isDarkMode } = useTheme();
  const [flashingButton, setFlashingButton] = useState<string | null>(null);
  // Timestamp of the last scoring action, used to compute cycle time in seconds
  const lastShotTimeRef = useRef<number | null>(null);

  // Shot types with ball counts
  // Note: controller_pickup = 5 seconds, prepare = 3 seconds, total = 8 seconds between auton and teleop
  const shotTypes = [
    { id: 1, balls: 1 },
    { id: 2, balls: 2 },
    { id: 3, balls: 3 },
  ];

  // Check if scoring is allowed based on match type and current phase
  const isScoringAllowed = (): boolean => {
    if (sessionData.matchType === 'Autonomous') {
      // Autonomous mode: only allow auton phase scoring
      return (
        matchPhase === 'auton' ||
        matchPhase === 'controller_pickup' ||
        matchPhase === 'prepare'
      );
    } else if (sessionData.matchType === 'Teleop') {
      // Teleop mode: only allow teleop phase scoring
      return matchPhase === 'teleop';
    }
    // Full Game: always allow
    return true;
  };

  const handleBallSelect = (shotId: number, ballsMade: number) => {
    // Prevent scoring if not allowed in current phase
    if (!isScoringAllowed()) {
      return;
    }

    // Create unique button identifier
    const buttonId = `${shotId}-${ballsMade}`;

    // Flash the button
    setFlashingButton(buttonId);

    // Compute cycle time in seconds with 2 decimal precision
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
          matchPhase === 'controller_pickup' ||
          matchPhase === 'prepare'));

    const shotEntry = { ballsShot: shotId, ballsMade, cycleTime };
    if (isAutonPhase) {
      const currentAutonShots = sessionData.autonShots || [];
      updateSessionData({ autonShots: [...currentAutonShots, shotEntry] });
    } else {
      const currentTeleopShots = sessionData.teleopShots || [];
      updateSessionData({ teleopShots: [...currentTeleopShots, shotEntry] });
    }

    // Clear flash after animation
    setTimeout(() => {
      setFlashingButton(null);
    }, 400);
  };

  // Determine score label and display the synced score from sessionData
  const isAutonPhase =
    sessionData.matchType === 'Autonomous' ||
    (sessionData.matchType === 'Full Game' &&
      (matchPhase === 'auton' ||
        matchPhase === 'controller_pickup' ||
        matchPhase === 'prepare'));
  const scoreLabel = isAutonPhase ? 'AUTON Score:' : 'TELEOP Score:';
  const displayScore = isAutonPhase
    ? (sessionData.autonomousScore ?? 0)
    : (sessionData.teleopScore ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h2 className="text-team-blue text-2xl font-semibold leading-6 w-16">
          Scoring
        </h2>
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
          return (
            <div key={shot.id} className="flex items-stretch gap-4 w-full">
              {/* Shot Label on Left - centered vertically */}
              <div className="flex items-center justify-center flex-shrink-0 min-w-[80px]">
                <div
                  className={`text-sm font-medium text-center ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  {shot.id} {shot.id === 1 ? 'ball' : 'balls'}
                </div>
              </div>

              {/* Scoring buttons - fill width evenly */}
              <div className="flex items-center gap-3 flex-1">
                {/* 0 option */}
                <button
                  onClick={() => handleBallSelect(shot.id, 0)}
                  disabled={!isScoringAllowed()}
                  className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                    !isScoringAllowed()
                      ? 'opacity-50 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800'
                      : flashingButton === `${shot.id}-0`
                        ? 'border-yellow-500 bg-yellow-500/20'
                        : isDarkMode
                          ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40 cursor-pointer'
                          : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
                  }`}
                >
                  {/* Dotted circles representing shot.balls count */}
                  <div className="flex items-center gap-2">
                    {Array.from({ length: shot.balls }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full border-2 border-dashed ${
                          flashingButton === `${shot.id}-0`
                            ? 'border-yellow-500'
                            : isDarkMode
                              ? 'border-white'
                              : 'border-black'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-xs mt-1 ${
                      flashingButton === `${shot.id}-0`
                        ? 'text-yellow-500'
                        : isDarkMode
                          ? 'text-team-white-60'
                          : 'text-gray-500'
                    }`}
                  >
                    missed
                  </span>
                </button>

                {/* Ball options */}
                {Array.from({ length: shot.balls }).map((_, index) => {
                  const ballCount = index + 1;
                  const isFlashing =
                    flashingButton === `${shot.id}-${ballCount}`;

                  return (
                    <button
                      key={ballCount}
                      onClick={() => handleBallSelect(shot.id, ballCount)}
                      disabled={!isScoringAllowed()}
                      className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                        !isScoringAllowed()
                          ? 'opacity-50 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800'
                          : isFlashing
                            ? 'border-green-500 bg-green-500/20 cursor-pointer'
                            : isDarkMode
                              ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40 cursor-pointer'
                              : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
                      }`}
                    >
                      {/* Circles representing ball count - outline only */}
                      <div className="flex items-center gap-2">
                        {Array.from({ length: ballCount }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded-full border-2 ${
                              isFlashing
                                ? 'border-green-500'
                                : isDarkMode
                                  ? 'border-white'
                                  : 'border-black'
                            }`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs mt-1 ${
                          isFlashing
                            ? 'text-green-500'
                            : isDarkMode
                              ? 'text-team-white-60'
                              : 'text-gray-500'
                        }`}
                      >
                        scored
                      </span>
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
