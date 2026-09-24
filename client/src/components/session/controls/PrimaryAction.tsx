import { toast } from 'sonner';

import { useLiveControls } from './liveControlsContext';
import { swallowEnter } from './swallowEnter';

/**
 * The one button that drives a match forward: Start, Save, the teleop
 * transition pair, or the save/cancel pair while editing a logged match.
 *
 * On a phone this is the only control in the fixed one-screen area, so it
 * must always render something actionable for the current state.
 */
export const PrimaryAction = () => {
  const {
    sessionData,
    isDarkMode,
    matchActive,
    editingMatchId,
    showTeleopTransition,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,
    setPendingEditMatch,
    saveEditedMatch,
    isSessionSetupSaved,
    handleStartMatch,
    handleSaveMatch,
    handleContinueToTeleop,
    handleSkipTeleop,
  } = useLiveControls();

  return (
    <>
      {!showTeleopTransition && !editingMatchId && (
        <button
          type="button"
          onKeyDown={swallowEnter}
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
              ? 'border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 disabled:hover:bg-green-500/20'
              : 'border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 text-team-blue disabled:hover:bg-team-blue/10'
          }`}
        >
          {!matchActive ? 'Start Match' : 'Save Match'}
        </button>
      )}

      {showTeleopTransition && (
        <>
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={handleContinueToTeleop}
            className={`flex-1 px-6 py-2 h-12 rounded-2xl bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'} text-base font-bold transition-colors flex items-center justify-center`}
          >
            Continue into Teleop
          </button>
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={handleSkipTeleop}
            className={`flex-1 px-6 py-2 h-12 rounded-2xl border-2 border-team-blue bg-transparent text-team-blue text-base font-bold transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-black'}`}
          >
            Skip / End Autonomous Only
          </button>
        </>
      )}

      {editingMatchId && (
        <>
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={() => {
              saveEditedMatch();
              toast.success('Match changes saved!');
              setShowUnsavedEditWarning(false);
              setPendingEditMatch(null);
            }}
            className="flex-1 py-2 h-12 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-base font-bold transition-colors flex items-center justify-center"
          >
            Save Changes
          </button>
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={() => {
              setPendingEditMatch(null);
              setShowUnsavedEditWarning(true);
            }}
            className="flex-1 py-2 h-12 rounded-2xl border-2 border-yellow-500/40 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 text-base font-bold transition-colors flex items-center justify-center"
          >
            Cancel
          </button>
        </>
      )}

      {showUnsavedEditWarning && (
        <div className="rounded-2xl border-2 border-orange-500/60 bg-orange-500/15 px-4 py-4 min-h-12 flex items-center">
          <p
            className={`text-xs font-semibold ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}
          >
            You have unsaved changes. Please save or cancel before switching
            matches.
          </p>
        </div>
      )}
    </>
  );
};
