import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession, useTheme } from '@/contexts';
import { MotifSetupDialog } from './MotifSetupDialog';
import { Edit2 } from 'lucide-react';

const GATE_CAPACITY = 9;
const POINTS_PER_MOTIF = 2;
const TELEOP_MOTIF_WINDOW_SECS = 10;

type MotifColor = 'purple' | 'green' | 'empty';

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

  const gateBallCount = sessionData.gateBallCount ?? 0;
  const isGateOpen = sessionData.gateAddBackMode ?? false;
  const addBackCount = sessionData.gateAddBackCount ?? 0;
  const motifPattern: MotifColor[] = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
  const autonMotif = sessionData.autonMotif ?? 0;
  const teleMotif = sessionData.teleMotif ?? 0;

  // Track when teleop started so we can show motif buttons for first 10 seconds
  const teleopStartedAtRef = useRef<number | null>(null);
  const [isInTeleopMotifWindow, setIsInTeleopMotifWindow] = useState(false);

  useEffect(() => {
    if (matchPhase === 'teleop' && teleopStartedAtRef.current === null) {
      teleopStartedAtRef.current = Date.now();
    }
    if (matchPhase !== 'teleop' && matchPhase !== 'controller_pickup' && matchPhase !== 'prepare') {
      teleopStartedAtRef.current = null;
      setIsInTeleopMotifWindow(false);
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

  // Determine if we're in a motif-scoring window
  // Auton just ended → controller_pickup or prepare phase (Full Game)
  const isAutonMotifPhase =
    matchActive &&
    sessionData.matchType === 'Full Game' &&
    (matchPhase === 'controller_pickup' || matchPhase === 'prepare');

  // First 10 seconds of teleop (still counts as auto motif scoring)
  const isTeleopMotifPhase = matchActive && matchPhase === 'teleop' && isInTeleopMotifWindow;

  // Teleop motif scoring: only after the match has ended (timer done)
  const isTeleopEndMotifPhase = matchActive && matchPhase === 'ended';

  // Hide auto motif M buttons if gate has been opened during this phase
  // (gate open = no balls in gate to form motif pattern)
  const isGateOpenedDuringAutonMotif = (isAutonMotifPhase || isTeleopMotifPhase) && isGateOpen;

  // Show motif M buttons: auto motifs during buffer/first-10s (unless gate opened), teleop motifs only after match ends
  const showMotifButtons =
    ((isAutonMotifPhase || isTeleopMotifPhase) && !isGateOpenedDuringAutonMotif) ||
    isTeleopEndMotifPhase;

  // Current motif bitmask being edited
  // During buffer and first 10s of teleop: edit autonMotif
  // After match ends: edit teleMotif
  const autonMotifMask = sessionData.autonMotif ?? 0;
  const teleMotifMask = sessionData.teleMotif ?? 0;
  
  const currentMotifMask = (isAutonMotifPhase || isTeleopMotifPhase) ? autonMotifMask : teleMotifMask;
  const currentMotifField = (isAutonMotifPhase || isTeleopMotifPhase) ? 'autonMotif' : 'teleMotif';

  const handleOpenGate = useCallback(() => {
    // If gate is opened during auto motif scoring window, clear autonMotif
    const clearAutonMotif = isAutonMotifPhase || isTeleopMotifPhase;
    // If gate is opened during active teleop (before timer ends), clear teleMotif
    const clearTeleMotif = matchActive && matchPhase === 'teleop' && !isInTeleopMotifWindow;
    updateSessionData({
      gateAddBackMode: true,
      gateAddBackCount: 0,
      ...(clearAutonMotif && { autonMotif: 0 }),
      ...(clearTeleMotif && { teleMotif: 0 }),
    });
  }, [updateSessionData, isAutonMotifPhase, isTeleopMotifPhase, matchActive, matchPhase, isInTeleopMotifWindow]);

  const handleConfirmGateOpen = useCallback(() => {
    updateSessionData({
      gateBallCount: addBackCount,
      gateAddBackMode: false,
      gateAddBackCount: 0,
    });
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
      const count = slotIndex + 1;
      // Set to count directly — no toggle. Only 0 key resets to 0.
      updateSessionData({
        gateAddBackCount: count,
      });
    },
    [isGateOpen, updateSessionData]
  );

  // Motif M button click - toggle a motif point
  const handleMotifScoreClick = useCallback(
    (index: number) => {
      // Toggle motif index in bitmask (independent on/off)
      let mask = currentMotifMask;
      mask ^= (1 << index);  // Toggle bit at position index
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

  // Determine fill colors for gate balls
  const getBallColor = (index: number) => {
    if (isGateOpen) {
      if (index < addBackCount) {
        return isDarkMode
          ? 'bg-purple-500 border-purple-400'
          : 'bg-purple-400 border-purple-500';
      }
      return isDarkMode
        ? 'bg-gray-800 border-gray-600'
        : 'bg-gray-200 border-gray-300';
    }

    if (index < gateBallCount) {
      if (index < GATE_CAPACITY) {
        return index % 2 === 0
          ? isDarkMode
            ? 'bg-purple-500 border-purple-400'
            : 'bg-purple-400 border-purple-500'
          : isDarkMode
            ? 'bg-emerald-500 border-emerald-400'
            : 'bg-emerald-400 border-emerald-500';
      }
    }
    return isDarkMode
      ? 'bg-gray-800 border-gray-600'
      : 'bg-gray-200 border-gray-300';
  };

  return (
    <div className="space-y-3">
      {/* Gate Header */}
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

      {/* Gate Visual - Horizontal tube */}
      <div
        className={`relative rounded-xl p-3 ${
          isDarkMode ? 'bg-team-dark' : 'bg-white'
        }`}
      >
        {/* Motif pts label */}
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
              {/* M letter sits directly above its ball — only for filled slots during motif phase */}
              {showMotifButtons && i < gateBallCount ? (
                <button
                  onClick={() => handleMotifScoreClick(i)}
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-base font-black transition-all duration-150 cursor-pointer hover:scale-110 ${
                    (currentMotifMask & (1 << i)) ? 'text-amber-400' : isDarkMode ? 'text-gray-600 hover:text-amber-400/60' : 'text-gray-300 hover:text-amber-400/60'
                  }`}
                  title={`Toggle motif ${i + 1} (${POINTS_PER_MOTIF} pts)`}
                >
                  M
                </button>
              ) : showMotifButtons ? (
                // Spacer to keep ball rows aligned whether or not M shows
                <div className="w-9 h-9 sm:w-10 sm:h-10" />
              ) : null}

              {/* Ball slot */}
              <button
                onClick={() => handleAddBackClick(i)}
                disabled={!isGateOpen}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-xs font-bold ${getBallColor(i)} ${
                  isGateOpen ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                }`}
                title={
                  isGateOpen
                    ? `Keep ${i + 1} ball${i > 0 ? 's' : ''} in gate`
                    : `Slot ${i + 1}`
                }
              >
                {((isGateOpen && i < addBackCount) ||
                  (!isGateOpen && i < gateBallCount)) && (
                  <div className="w-2 h-2 rounded-full bg-white/60" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Gate open state overlay */}
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
                    : 'bg-team-blue text-black hover:opacity-90'
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

      {/* Open Gate Button */}
      {!isGateOpen && (
        <button
          onClick={handleOpenGate}
          disabled={gateBallCount === 0}
          className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isDarkMode
              ? 'bg-team-dark text-team-blue hover:bg-team-blue/10'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Open Gate (Release All {gateBallCount} Balls)
        </button>
      )}

      {/* Motif Edit Button */}
      <button
        onClick={() => setShowMotifDialog(true)}
        title={matchActive ? 'Pattern is locked during match' : 'Set motif pattern'}
        className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${
          isDarkMode
            ? 'bg-team-dark border border-team-blue/20 text-team-blue hover:bg-team-blue/10'
            : 'bg-white border border-team-blue/20 text-team-blue hover:bg-team-blue/5'
        }`}
      >
        <Edit2 className="w-3.5 h-3.5" />
        {motifPattern.every(c => c === 'empty') ? 'Set Motif Pattern' : 'Edit Motif Pattern'}
      </button>

      {/* Motif Setup Dialog */}
      <MotifSetupDialog
        isOpen={showMotifDialog}
        onConfirm={handleMotifDialogConfirm}
        onCancel={() => setShowMotifDialog(false)}
        initialPattern={motifPattern}
      />
    </div>
  );
};
