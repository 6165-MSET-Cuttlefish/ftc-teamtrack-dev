import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession, useTheme } from '@/contexts';
import { MotifSetupDialog } from './MotifSetupDialog';
import { TUTORIAL_GATE_CYCLE_EVENT } from '@/constants/events';
import type { MotifColor } from '@/types';

const GATE_CAPACITY = 9;
const POINTS_PER_MOTIF = 2;
const TELEOP_MOTIF_WINDOW_SECS = 10;

// Count number of set bits in a bitmask
const countBits = (n: number): number => {
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  return count;
};

export const GateVisual = () => {
  const { sessionData, updateSessionData, matchPhase, matchActive } = useSession();
  const { isDarkMode } = useTheme();
  const [showMotifDialog, setShowMotifDialog] = useState(false);
  const [isTutorialGateStep, setIsTutorialGateStep] = useState(false);
  const [isTutorialMotifStep, setIsTutorialMotifStep] = useState(false);

  // Listen for tutorial step changes to distinguish Gate vs Motif tutorial steps
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const isGateTarget = detail?.target === 'gate';
      setIsTutorialGateStep(isGateTarget && detail?.stepTitle === 'Gate Mechanic');
      setIsTutorialMotifStep(isGateTarget && detail?.stepTitle === 'Motif Scoring');
    };
    window.addEventListener('teamtrack-tutorial-step-changed', handler);
    return () => window.removeEventListener('teamtrack-tutorial-step-changed', handler);
  }, []);

  const gateBallCount = sessionData.gateBallCount ?? 0;
  const isGateOpen = sessionData.gateAddBackMode ?? false;
  const addBackCount = sessionData.gateAddBackCount ?? 0;
  const motifPattern: MotifColor[] = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
  const hasMotifEnabled = sessionData.motifPattern !== undefined;

  // Track when teleop started so we can show motif buttons for first 10 seconds
  const teleopStartedAtRef = useRef<number | null>(null);
  const [isInTeleopMotifWindow, setIsInTeleopMotifWindow] = useState(false);
  // Track if gate was opened during the auton motif phase (blocks rest of 10s window)
  const [gateOpenedDuringAutonWindow, setGateOpenedDuringAutonWindow] = useState(false);
  // Track if gate was opened during an end-of-match motif window (permanently hides M buttons)
  const [gateOpenedDuringEndMotif, setGateOpenedDuringEndMotif] = useState(false);

  useEffect(() => {
    if (matchPhase === 'teleop' && teleopStartedAtRef.current === null) {
      teleopStartedAtRef.current = Date.now();
      setGateOpenedDuringAutonWindow(false);
    }
    if (matchPhase !== 'teleop' && matchPhase !== 'controller_pickup' && matchPhase !== 'ended') {
      teleopStartedAtRef.current = null;
      setIsInTeleopMotifWindow(false);
      setGateOpenedDuringAutonWindow(false);
      setGateOpenedDuringEndMotif(false);
    }
  }, [matchPhase]);

  useEffect(() => {
    if (matchPhase !== 'teleop') return;
    const interval = setInterval(() => {
      if (teleopStartedAtRef.current === null) return;
      const elapsed = (Date.now() - teleopStartedAtRef.current) / 1000;
      setIsInTeleopMotifWindow(elapsed <= TELEOP_MOTIF_WINDOW_SECS);
      if (elapsed > TELEOP_MOTIF_WINDOW_SECS) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [matchPhase]);

  // Reset gateOpenedDuringEndMotif when the tutorial enters the motif step
  // (prevents stale state from a previous gate interaction blocking M buttons)
  useEffect(() => {
    if (isTutorialMotifStep) {
      setGateOpenedDuringEndMotif(false);
    }
  }, [isTutorialMotifStep]);

  // Determine if we're in a motif-scoring window
  // Auton just ended → controller_pickup phase (Full Game)
  const isAutonMotifPhase =
    matchActive &&
    sessionData.matchType === 'Full Game' &&
    matchPhase === 'controller_pickup';

  // Autonomous-only match: motifs scorable after match ends
  const isAutonEndMotifPhase =
    matchActive &&
    sessionData.matchType === 'Autonomous' &&
    matchPhase === 'ended' &&
    !isGateOpen;

  // First 10 seconds of teleop — Full Game only (not standalone Teleop mode)
  const isTeleopMotifPhase =
    matchActive &&
    matchPhase === 'teleop' &&
    isInTeleopMotifWindow &&
    sessionData.matchType === 'Full Game';

  // Teleop motif scoring: only after the match has ended, for Full Game and Teleop modes
  const isTeleopEndMotifPhase =
    matchActive &&
    matchPhase === 'ended' &&
    !isGateOpen &&
    sessionData.matchType !== 'Autonomous';

  // Hide auto motif M buttons if gate was opened during this phase during the early window
  // (gate open = no balls in gate to form motif pattern)
  // Once gate opens, motif scoring disabled for rest of the 10-second window
  const isGateOpenedDuringAutonMotif = gateOpenedDuringAutonWindow && (isAutonMotifPhase || isTeleopMotifPhase);

  // Show motif M buttons: only if motif is enabled AND in appropriate phases
  // During the tutorial motif step, force-show regardless of phase logic
  const showMotifButtons =
    (isTutorialMotifStep && hasMotifEnabled && gateBallCount > 0) ||
    (hasMotifEnabled &&
    (((isAutonMotifPhase || isTeleopMotifPhase) && !isGateOpenedDuringAutonMotif) ||
    (isTeleopEndMotifPhase && !gateOpenedDuringEndMotif) ||
    (isAutonEndMotifPhase && !gateOpenedDuringEndMotif)));

  // Current motif bitmask being edited
  // During buffer and first 10s of teleop: edit autonMotif
  // After match ends: edit teleMotif
  const autonMotifMask = sessionData.autonMotif ?? 0;
  const teleMotifMask = sessionData.teleMotif ?? 0;
  
  const currentMotifMask = (isAutonMotifPhase || isTeleopMotifPhase || isAutonEndMotifPhase) ? autonMotifMask : teleMotifMask;
  const currentMotifField = (isAutonMotifPhase || isTeleopMotifPhase || isAutonEndMotifPhase) ? 'autonMotif' : 'teleMotif';

  const handleOpenGate = useCallback(() => {
    // If gate is opened during auto motif scoring window, block further scoring but DON'T clear already-scored autonMotif
    const isInAutonMotifWindow = isAutonMotifPhase || isTeleopMotifPhase;
    if (isInAutonMotifWindow) {
      setGateOpenedDuringAutonWindow(true);
    }
    // If gate is opened during an end-of-match motif window, permanently hide M buttons
    if (isTeleopEndMotifPhase || isAutonEndMotifPhase) {
      setGateOpenedDuringEndMotif(true);
    }
    updateSessionData({
      gateAddBackMode: true,
      gateAddBackCount: 0,
    });
  }, [updateSessionData, isAutonMotifPhase, isTeleopMotifPhase, isTeleopEndMotifPhase, isAutonEndMotifPhase]);

  const handleConfirmGateOpen = useCallback(() => {
    updateSessionData({
      gateBallCount: addBackCount,
      gateAddBackMode: false,
      gateAddBackCount: 0,
    });
    window.dispatchEvent(new CustomEvent(TUTORIAL_GATE_CYCLE_EVENT, { detail: { method: 'click' } }));
  }, [addBackCount, updateSessionData]);

  const handleCancelGateOpen = useCallback(() => {
    updateSessionData({
      gateAddBackMode: false,
      gateAddBackCount: 0,
    });
  }, [updateSessionData]);

  const handleAddBackClick = useCallback(
    (slotIndex: number) => {
      if (!isGateOpen) return;
      // Clamp to current gateBallCount - can only keep what you have
      const count = Math.min(slotIndex + 1, gateBallCount);
      updateSessionData({
        gateAddBackCount: count,
      });
    },
    [isGateOpen, gateBallCount, updateSessionData]
  );

  const handleMotifScoreClick = useCallback(
    (index: number) => {
      // Toggle motif index in bitmask (independent on/off)
      let mask = currentMotifMask;
      mask ^= (1 << index);
      updateSessionData({ [currentMotifField]: mask });
    },
    [currentMotifMask, currentMotifField, updateSessionData]
  );

  const handleMotifDialogConfirm = useCallback(
    (pattern: MotifColor[]) => {
      updateSessionData({ motifPattern: pattern });
      setShowMotifDialog(false);
    },
    [updateSessionData]
  );

  // Determine fill colors for gate balls — uses motifPattern for the first 3 slots
  const getMotifColorClass = (color: MotifColor) => {
    if (color === 'purple') return isDarkMode ? 'bg-purple-500 border-purple-400' : 'bg-purple-400 border-purple-500';
    if (color === 'green') return isDarkMode ? 'bg-emerald-500 border-emerald-400' : 'bg-emerald-400 border-emerald-500';
    // fallback for empty (shouldn't happen for filled slots)
    return isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-200 border-gray-300';
  };

  // Each gate slot has a fixed motif-color assignment based on slot index:
  //   Slots 0, 3, 6 → motifPattern[0]
  //   Slots 1, 4, 7 → motifPattern[1]
  //   Slots 2, 5, 8 → motifPattern[2]
  const getSlotPatternColor = (index: number): MotifColor => {
    const patternIndex = index % 3;
    const color = motifPattern[patternIndex];
    return color !== 'empty' ? color : 'purple';
  };

  const getBallColor = (index: number) => {
    const emptyClass = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300';
    const filledGrey = isDarkMode ? 'bg-gray-500 border-gray-400' : 'bg-gray-400 border-gray-500';

    if (isGateOpen) {
      if (index < addBackCount) return filledGrey;
      return emptyClass;
    }

    if (index >= gateBallCount) return emptyClass;

    const patternColor = getSlotPatternColor(index);

    const isMotifScored = !!(currentMotifMask & (1 << index));

    if (isMotifScored) {
      return getMotifColorClass(patternColor);
    }

    return filledGrey;
  };

  return (
    <div className="space-y-3" data-tutorial="gate">
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
      `}</style>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-team-blue text-2xl font-semibold leading-6">
            Gate
          </h2>
          <span className="text-xs font-bold text-white bg-team-blue/30 px-2 py-0.5 rounded">
            G
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-semibold ${
              gateBallCount >= GATE_CAPACITY
                ? 'text-red-500'
                : isDarkMode
                  ? 'text-gray-300'
                  : 'text-gray-600'
            }`}
          >
            {gateBallCount}/{GATE_CAPACITY}
          </span>
          {gateBallCount >= GATE_CAPACITY && (
            <span className="text-xs font-bold text-red-500 uppercase tracking-wide">
              Full — Overflow!
            </span>
          )}
        </div>
      </div>

      <div
        className={`relative rounded-xl p-3 ${
          isDarkMode ? 'bg-team-dark' : 'bg-white'
        }`}
      >
        {showMotifButtons && gateBallCount > 0 && (
          <p
            className={`text-xs text-center font-semibold mb-1 ${
              currentMotifMask > 0 ? 'text-amber-500' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {countBits(currentMotifMask) * POINTS_PER_MOTIF} motif pts
          </p>
        )}

        {/* Unified per-slot column layout: M button (if motif phase) above each ball */}
        <div className="flex items-end gap-1.5 justify-center">
          {Array.from({ length: GATE_CAPACITY }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* No M button above — M now appears inside the ball during motif phase */}
              {showMotifButtons ? (
                // Spacer to keep ball rows aligned whether or not M shows
                <div className="w-9 h-9 sm:w-10 sm:h-10" />
              ) : null}

              <button
                onClick={() => showMotifButtons && i < gateBallCount ? handleMotifScoreClick(i) : handleAddBackClick(i)}
                disabled={
                  showMotifButtons
                    ? (i >= gateBallCount || !matchActive)
                    : (!isGateOpen || i >= gateBallCount)
                }
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-xs font-bold ${
                  showMotifButtons ? (i >= gateBallCount ? 'opacity-40' : '') : (isGateOpen && i >= gateBallCount ? 'opacity-40' : '')
                } ${getBallColor(i)} ${
                  showMotifButtons && i < gateBallCount && matchActive
                    ? 'cursor-pointer hover:scale-110'
                    : isGateOpen && i < gateBallCount ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                }`}
                title={
                  showMotifButtons
                    ? `Toggle motif ${i + 1} (${POINTS_PER_MOTIF} pts)`
                    : isGateOpen
                    ? i < gateBallCount
                      ? `Keep ${i + 1} ball${i > 0 ? 's' : ''} in gate`
                      : `No ball here`
                    : `Ball ${i + 1}`
                }
              >
                <span className={`text-[10px] font-bold leading-none select-none ${
                  i >= gateBallCount
                    ? isDarkMode ? 'text-gray-600' : 'text-gray-300'
                    : showMotifButtons && i < gateBallCount
                    ? 'text-base' // M is larger
                    : (currentMotifMask & (1 << i))
                    ? 'text-white/70'
                    : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {showMotifButtons && i < gateBallCount ? 'M' : i + 1}
                </span>
              </button>
            </div>
          ))}
        </div>

        {isGateOpen && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className={`text-sm font-bold text-center rounded px-3 py-2 ${
              addBackCount === 0 && gateBallCount > 0
                ? 'bg-red-500/20 border border-red-500/40 text-red-600'
                : 'bg-blue-500/10 border border-blue-500/30 text-blue-600'
            }`}>
              Keeping {addBackCount} of {gateBallCount}
            </div>
            <p
              className={`text-xs font-medium ${
                addBackCount === 0 ? 'text-red-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Click balls or press 0-9 to set how many stayed
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmGateOpen}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  addBackCount === 0 && gateBallCount > 0
                    ? 'bg-red-500/20 border border-red-500 text-red-600 hover:bg-red-500/30'
                    : isDarkMode ? 'bg-team-blue text-black hover:opacity-90' : 'bg-team-blue text-white hover:opacity-90'
                }`}
              >
                {addBackCount === 0 && gateBallCount > 0
                  ? `Release ALL (${gateBallCount})?`
                  : `Confirm (${gateBallCount - addBackCount} released)`}
              </button>
              <button
                onClick={handleCancelGateOpen}
                className={`px-4 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!isGateOpen && (
        <>
          <style>{`
            @keyframes gateButtonPulse {
              0%, 100% {
                box-shadow: 0 0 0 0 rgba(var(--team-blue) / 0.4);
              }
              50% {
                box-shadow: 0 0 0 8px rgba(var(--team-blue) / 0.1);
              }
            }
            .gate-button-pulse {
              animation: gateButtonPulse 2.5s ease-in-out infinite;
            }
          `}</style>
          <button
            onClick={handleOpenGate}
            disabled={gateBallCount === 0}
            className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isTutorialGateStep ? 'gate-button-pulse' : ''} ${
              isDarkMode
                ? 'bg-team-dark text-team-blue hover:bg-team-blue/10'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Open Gate (Release All {gateBallCount} Balls)
          </button>
        </>
      )}

      <button
        onClick={() => {
          if (hasMotifEnabled && (!sessionData.motifPattern || sessionData.motifPattern.some(c => c === 'empty'))) {
            setShowMotifDialog(true);
          } else {
            handleMotifDialogConfirm(sessionData.motifPattern ?? ['empty', 'empty', 'empty']);
          }
        }}
        title={matchActive ? 'Pattern is locked during match' : 'Start the match'}
        className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${matchActive ? 'opacity-50 cursor-not-allowed' : ''} ${
          isDarkMode
            ? 'bg-team-dark border border-team-blue/20 text-team-blue hover:bg-team-blue/10'
            : 'bg-white border border-team-blue/20 text-team-blue hover:bg-team-blue/5'
        }`}
        disabled={matchActive}
      >
        Start Match
      </button>

      {hasMotifEnabled && (
        <MotifSetupDialog
          isOpen={showMotifDialog}
          onConfirm={handleMotifDialogConfirm}
          onCancel={() => setShowMotifDialog(false)}
          initialPattern={motifPattern}
        />
      )}
    </div>
  );
};
