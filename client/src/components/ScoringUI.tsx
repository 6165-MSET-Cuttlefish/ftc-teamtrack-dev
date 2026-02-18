import { useSession, useTheme } from '@/contexts';
import { useState } from 'react';

export const ScoringUI = () => {
  const { updateSessionData, sessionData, hasTransitionedToTeleop } = useSession();
  const { isDarkMode } = useTheme();
  const [flashingButton, setFlashingButton] = useState<string | null>(null);

  // Shot types with ball counts
  const shotTypes = [
    { id: 1, balls: 1 },
    { id: 2, balls: 2 },
    { id: 3, balls: 3 },
  ];

  const handleBallSelect = (shotId: number, ballsMade: number) => {
    // Create unique button identifier
    const buttonId = `${shotId}-${ballsMade}`;
    
    // Flash the button
    setFlashingButton(buttonId);
    
    // Record shot in the appropriate phase array
    const isAuton = sessionData.matchType === 'Autonomous' || 
      (sessionData.matchType === 'Full Game' && !hasTransitionedToTeleop);
    const shotEntry = { ballsShot: shotId, ballsMade };
    if (isAuton) {
      const currentAutonShots = sessionData.autonShots || [];
      updateSessionData({ autonShots: [...currentAutonShots, shotEntry] });
    } else {
      const currentTeleopShots = sessionData.teleopShots || [];
      updateSessionData({ teleopShots: [...currentTeleopShots, shotEntry] });
    }

    // Clear flash after animation
    setTimeout(() => {
      setFlashingButton(null);
    }, 200);
  };

  // Determine score label and display the synced score from sessionData
  const isAuton = sessionData.matchType === 'Autonomous' || 
    (sessionData.matchType === 'Full Game' && !hasTransitionedToTeleop);
  const scoreLabel = isAuton ? 'AUTON Score:' : 'TELEOP Score:';
  const displayScore = isAuton ? sessionData.autonomousScore ?? 0 : sessionData.teleopScore ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h2 className="text-team-blue text-2xl font-semibold leading-6 w-16">
          Scoring
        </h2>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
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
                  className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                    flashingButton === `${shot.id}-0`
                      ? 'border-green-500 bg-green-500/20'
                      : isDarkMode
                        ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  {/* Dotted circles representing shot.balls count */}
                  <div className="flex items-center gap-2">
                    {Array.from({ length: shot.balls }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full border-2 border-dashed ${
                          flashingButton === `${shot.id}-0`
                            ? 'border-green-500'
                            : isDarkMode
                              ? 'border-white'
                              : 'border-black'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs mt-1 ${
                    flashingButton === `${shot.id}-0`
                      ? 'text-green-500'
                      : isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }`}>
                    scored
                  </span>
                </button>

                {/* Ball options */}
                {Array.from({ length: shot.balls }).map((_, index) => {
                  const ballCount = index + 1;
                  const isFlashing = flashingButton === `${shot.id}-${ballCount}`;

                  return (
                    <button
                      key={ballCount}
                      onClick={() => handleBallSelect(shot.id, ballCount)}
                      className={`flex-1 flex flex-col items-center justify-center h-20 rounded-lg border-2 transition-all duration-200 ${
                        isFlashing
                          ? 'border-green-500 bg-green-500/20'
                          : isDarkMode
                            ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40'
                            : 'border-gray-300 bg-white hover:border-gray-400'
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
                      <span className={`text-xs mt-1 ${
                        isFlashing
                          ? 'text-green-500' 
                          : isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                      }`}>
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
