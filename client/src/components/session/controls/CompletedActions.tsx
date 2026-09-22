import { useLiveControls } from './liveControlsContext';

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

  return (
    <div className="flex flex-wrap gap-4 w-full">
      <button
        onClick={handleViewAnalysis}
        disabled={loading}
        className="flex-1 min-w-[160px] px-6 py-4 h-14 md:h-16 rounded-2xl border-2 border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 text-team-blue text-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : 'View Full Analysis Report'}
      </button>

      <button
        onClick={handleNewSession}
        className="flex-1 min-w-[160px] px-6 py-4 h-14 md:h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors flex items-center justify-center"
      >
        New Session
      </button>

      {newSessionConfirm && (
        <div
          className={`flex-1 min-w-[240px] flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-lg border ${isDarkMode ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'}`}
        >
          <span
            className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}
          >
            Discard unsaved matches?
          </span>
          <button
            onClick={handleConfirmNewSession}
            className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
          >
            Yes, Discard
          </button>
          <button
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
