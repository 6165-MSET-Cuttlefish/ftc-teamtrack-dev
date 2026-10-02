import { X } from 'lucide-react';

import { useSessionCore } from '@/contexts';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { toneText } from './tones';

const CONTROL_CLASS =
  'px-3 py-1.5 min-h-11 md:min-h-10 rounded-xl border-2 text-sm font-semibold transition-colors flex items-center gap-2';

/**
 * Pause / resume only.
 *
 * Kept apart from the bulkier match actions because this is the one in-match
 * control that has to stay reachable without scrolling on a phone — it sits
 * in the fixed pane beside the timer, while the rest scroll below.
 *
 * Controller pickup has its own countdown (the match clock is stopped for
 * it), so there the button freezes and resumes that countdown instead.
 */
export const PlayPauseControl = () => {
  const {
    isDarkMode,
    isTimerRunning,
    setIsTimerRunning,
    matchPhase,
    matchActive,
    editingMatchId,
  } = useLiveControls();
  const { isPickupPaused, setIsPickupPaused } = useSessionCore();

  if (editingMatchId || !matchActive) return null;

  const inPickup = matchPhase === 'controller_pickup';
  const running = inPickup ? !isPickupPaused : isTimerRunning;

  if (running) {
    return (
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() =>
          inPickup ? setIsPickupPaused(true) : setIsTimerRunning(false)
        }
        className={`${CONTROL_CLASS} border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 ${toneText('yellow', isDarkMode)}`}
      >
        <span aria-hidden>⏸</span>
        Pause Match
      </button>
    );
  }

  if (inPickup || matchPhase === 'auton' || matchPhase === 'teleop') {
    return (
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() =>
          inPickup ? setIsPickupPaused(false) : setIsTimerRunning(true)
        }
        className={`${CONTROL_CLASS} border-team-blue-40 bg-team-blue-10 hover:bg-team-blue/20 ${toneText('blue', isDarkMode)}`}
      >
        <span aria-hidden>▶</span>
        Resume Match
      </button>
    );
  }

  return null;
};

/**
 * Discard the in-progress match.
 *
 * Split out of `MatchExtras` so it can sit next to `PlayPauseControl` — on a
 * phone these two are the in-match controls that stay next to the timer,
 * while skip-to-teleop scrolls with the rest of the between-action controls.
 */
export const CancelMatchButton = () => {
  const {
    isDarkMode,
    matchActive,
    editingMatchId,
    cancelMatchConfirm,
    setCancelMatchConfirm,
    handleCancelCurrentMatch,
  } = useLiveControls();

  if (editingMatchId || !matchActive) return null;

  if (cancelMatchConfirm) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Discard this match?
        </span>
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={handleCancelCurrentMatch}
          className="px-3 py-1.5 min-h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
        >
          Yes, Discard
        </button>
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={() => setCancelMatchConfirm(false)}
          className={`px-3 py-1.5 min-h-11 rounded-lg border text-sm font-bold transition-colors ${
            isDarkMode
              ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          No, Keep
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() => setCancelMatchConfirm(true)}
      className={`${CONTROL_CLASS} border-red-500/40 bg-red-500/10 hover:bg-red-500/20 ${toneText('red', isDarkMode)}`}
    >
      <X className="h-4 w-4" aria-hidden />
      Cancel Current Match
    </button>
  );
};

/** Skip to teleop — a deliberate, between-action control. */
export const MatchExtras = () => {
  const {
    sessionData,
    isDarkMode,
    matchPhase,
    matchActive,
    editingMatchId,
    skipToTeleop,
  } = useLiveControls();

  if (editingMatchId || !matchActive) return null;

  if (
    sessionData.matchType !== 'Full Game' ||
    (matchPhase !== 'auton' && matchPhase !== 'controller_pickup')
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={skipToTeleop}
      className={`${CONTROL_CLASS} border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 ${toneText('purple', isDarkMode)}`}
    >
      <span aria-hidden>⏭</span>
      Skip to Teleop
    </button>
  );
};
