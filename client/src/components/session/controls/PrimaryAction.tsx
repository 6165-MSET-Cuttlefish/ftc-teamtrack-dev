import { toast } from 'sonner';

import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { toneText } from './tones';

/**
 * Save / Cancel for a logged match that is open for editing.
 *
 * Rendered beside the timer (the primary action slot) and in the Match Log,
 * by the match that was tapped — so the controls are next to whichever part
 * of the page the user was looking at.
 */
export const EditMatchActions = () => {
  const {
    isDarkMode,
    setShowUnsavedEditWarning,
    saveEditedMatch,
    returnToCurrentMatch,
  } = useLiveControls();

  return (
    <>
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          // The second tap of a double tap saves nothing, so says nothing.
          if (!saveEditedMatch()) return;
          toast.success('Match changes saved!');
          setShowUnsavedEditWarning(false);
        }}
        className={`flex-1 py-2 h-12 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 ${toneText('green', isDarkMode)} text-base font-bold transition-colors flex items-center justify-center`}
      >
        Save Changes
      </button>
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          returnToCurrentMatch();
          setShowUnsavedEditWarning(false);
        }}
        className={`flex-1 py-2 h-12 rounded-2xl border-2 border-yellow-500/40 bg-yellow-500/20 hover:bg-yellow-500/30 ${toneText('yellow', isDarkMode)} text-base font-bold transition-colors flex items-center justify-center`}
      >
        Cancel
      </button>
    </>
  );
};

/**
 * The one button that drives a match forward: Start, Save, or the
 * save/cancel pair while editing a logged match.
 *
 * On a phone this is the only control in the fixed one-screen area, so it
 * must always render something actionable for the current state.
 */
export const PrimaryAction = () => {
  const {
    sessionData,
    isDarkMode,
    matchActive,
    hasStarted,
    editingMatchId,
    showUnsavedEditWarning,
    isSessionSetupSaved,
    handleStartMatch,
    handleSaveMatch,
  } = useLiveControls();

  /** Nothing has been played yet, so this press starts the whole session. */
  const isFirstStart = !hasStarted && !sessionData.matches?.length;

  return (
    <>
      {!editingMatchId && (
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={!matchActive ? handleStartMatch : handleSaveMatch}
          disabled={!matchActive && !sessionData.sessionName?.trim()}
          title={
            !matchActive && !isSessionSetupSaved
              ? 'Save session settings before starting'
              : !matchActive && !sessionData.sessionName?.trim()
                ? 'Complete session setup (Session Name) before starting'
                : ''
          }
          className={`w-full px-6 py-2 h-12 rounded-2xl border-2 text-base font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            !matchActive && isSessionSetupSaved
              ? `border-green-500/40 bg-green-500/20 hover:bg-green-500/30 ${toneText('green', isDarkMode)} disabled:hover:bg-green-500/20`
              : `border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 ${toneText('blue', isDarkMode)} disabled:hover:bg-team-blue/10`
          }`}
        >
          {matchActive
            ? 'Save Match'
            : isFirstStart
              ? 'Start Session'
              : 'Start Match'}
        </button>
      )}

      {editingMatchId && <EditMatchActions />}

      {showUnsavedEditWarning && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-orange-500/60 bg-orange-500/15 px-4 py-4 min-h-12 flex items-center"
        >
          <p
            className={`text-xs font-semibold ${toneText('orange', isDarkMode)}`}
          >
            You have unsaved changes. Please save or cancel before switching
            matches.
          </p>
        </div>
      )}
    </>
  );
};
