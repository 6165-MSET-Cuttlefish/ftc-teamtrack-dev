import { Link } from 'react-router-dom';

import { ROUTES } from '@/constants';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { toneText } from './tones';
import { useArmed } from './useArmed';

/** Post-session actions, shown once the session has been saved. */
export const CompletedActions = () => {
  const {
    isDarkMode,
    loading,
    newSessionConfirm,
    setNewSessionConfirm,
    handleViewAnalysis,
    handleNewSession,
    handleConfirmNewSession,
  } = useLiveControls();

  // These buttons appear where Complete Session / Save Session were a moment
  // ago, so the second half of a double tap would land on them.
  const armed = useArmed();

  return (
    <div className="flex flex-wrap gap-4 w-full">
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          if (armed) handleViewAnalysis();
        }}
        disabled={loading}
        className={`flex-1 min-w-[160px] px-6 py-4 h-14 md:h-16 rounded-2xl border-2 border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 ${toneText('blue', isDarkMode)} text-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? 'Loading...' : 'View Full Analysis Report'}
      </button>

      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          if (armed) handleNewSession();
        }}
        className={`flex-1 min-w-[160px] px-6 py-4 h-14 md:h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 ${toneText('green', isDarkMode)} text-lg font-bold transition-colors flex items-center justify-center`}
      >
        New Session
      </button>

      {newSessionConfirm && (
        <div
          className={`flex-1 min-w-[240px] flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-lg border ${isDarkMode ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'}`}
        >
          <span className={`text-sm ${toneText('red', isDarkMode)}`}>
            Discard unsaved matches?
          </span>
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={handleConfirmNewSession}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
          >
            Yes, Discard
          </button>
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={() => setNewSessionConfirm(false)}
            className={`px-3 py-1 rounded border text-xs font-bold transition-colors ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The link to the sessions list on the completed screen. It sits where the
 * save dialog's Save Session button was, so it waits out a double tap too.
 */
export const ViewSessionsLink = () => {
  const { isDarkMode } = useLiveControls();
  const armed = useArmed();

  return (
    <Link
      to={ROUTES.SESSIONS}
      onClick={e => {
        if (!armed) e.preventDefault();
      }}
      className={`inline-flex items-center justify-center px-6 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
        isDarkMode
          ? 'border-team-blue-40 text-team-white-60 hover:text-white hover:border-team-blue'
          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      View Sessions
    </Link>
  );
};
