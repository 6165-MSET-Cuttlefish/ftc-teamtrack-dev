import { useCallback } from 'react';
import { useSession, useTheme } from '@/contexts';

const GATE_CAPACITY = 9;

export const GateVisual = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();

  const gateBallCount = sessionData.gateBallCount ?? 0;
  const isGateOpen = sessionData.gateAddBackMode ?? false;
  const addBackCount = sessionData.gateAddBackCount ?? 0;

  const handleOpenGate = useCallback(() => {
    updateSessionData({
      gateAddBackMode: true,
      gateAddBackCount: 0,
    });
  }, [updateSessionData]);

  const handleConfirmGateOpen = useCallback(() => {
    // Balls remaining = addBackCount (balls that didn't roll out)
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
      // slotIndex is 0-based; click sets how many balls stay = slotIndex + 1
      // Clicking the same count again deselects (sets to 0)
      const count = slotIndex + 1;
      updateSessionData({
        gateAddBackCount: addBackCount === count ? 0 : count,
      });
    },
    [isGateOpen, addBackCount, updateSessionData]
  );

  // Determine fill colors
  const getBallColor = (index: number) => {
    if (isGateOpen) {
      // In add-back mode: show balls that will remain
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
      // Filled ball
      if (index < GATE_CAPACITY) {
        // Use alternating purple/green colors like the real gate
        return index % 2 === 0
          ? isDarkMode
            ? 'bg-purple-500 border-purple-400'
            : 'bg-purple-400 border-purple-500'
          : isDarkMode
            ? 'bg-emerald-500 border-emerald-400'
            : 'bg-emerald-400 border-emerald-500';
      }
    }
    // Empty slot
    return isDarkMode
      ? 'bg-gray-800 border-gray-600'
      : 'bg-gray-200 border-gray-300';
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-team-blue text-2xl font-semibold leading-6">
          Gate
        </h2>
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
        {/* Ball slots - horizontal row like the physical gate */}
        <div className="flex items-center gap-1.5 justify-center">
          {Array.from({ length: GATE_CAPACITY }).map((_, i) => (
            <button
              key={i}
              onClick={() => handleAddBackClick(i)}
              disabled={!isGateOpen}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-xs font-bold ${getBallColor(i)} ${
                isGateOpen
                  ? 'cursor-pointer hover:scale-110'
                  : 'cursor-default'
              }`}
              title={
                isGateOpen
                  ? `Keep ${i + 1} ball${i > 0 ? 's' : ''} in gate`
                  : `Slot ${i + 1}`
              }
            >
              {/* Show dots for filled effect */}
              {((isGateOpen && i < addBackCount) ||
                (!isGateOpen && i < gateBallCount)) && (
                <div className="w-2 h-2 rounded-full bg-white/60" />
              )}
            </button>
          ))}
        </div>

        {/* Gate open state overlay */}
        {isGateOpen && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p
              className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Click balls or press 1–9 to set how many stayed, Enter to confirm ({addBackCount}{' '}
              remaining)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmGateOpen}
                className="px-4 py-1.5 rounded-lg bg-team-blue text-sm font-semibold transition-colors hover:opacity-90 text-black"
              >
                Confirm ({gateBallCount - addBackCount} released){' '}
                <span className="font-mono opacity-60 text-xs">[↵]</span>
              </button>
              <button
                onClick={handleCancelGateOpen}
                className={`px-4 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Cancel{' '}
                <span className="font-mono opacity-60 text-xs">[Esc]</span>
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
          Open Gate (Release All {gateBallCount} Balls){' '}
          <span className="font-mono opacity-50 text-xs">[G]</span>
        </button>
      )}
    </div>
  );
};
