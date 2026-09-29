import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { useLiveControls } from './liveControlsContext';

/**
 * Asks the user to confirm the session name before the session is saved.
 * New sessions start out as "Default Session", so this is where most users
 * actually name theirs.
 */
export const SaveSessionDialog = () => {
  const {
    sessionData,
    isDarkMode,
    loading,
    setShowSaveSessionDialog,
    handleCompleteSession,
  } = useLiveControls();
  const [name, setName] = useState(sessionData.sessionName ?? '');
  const hasName = name.trim().length > 0;

  const confirm = () => {
    if (!hasName || loading) return;
    handleCompleteSession(name.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-session-title"
        onSubmit={e => {
          e.preventDefault();
          confirm();
        }}
        className={`max-w-sm w-full rounded-xl border p-6 space-y-4 shadow-2xl ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        <h3
          id="save-session-title"
          className={`text-lg font-semibold text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Save session?
        </h3>
        <div className="space-y-2">
          <label
            htmlFor="save-session-name"
            className={`block text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
          >
            Session Name
          </label>
          <Input
            id="save-session-name"
            type="text"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => e.target.select()}
            className={`h-12 px-4 rounded-xl border-2 border-team-blue-40 focus:ring-2 focus:ring-team-blue/20 ${
              isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
            }`}
          />
          {!hasName && (
            <p className="text-xs text-red-400 font-medium">
              Session name is required
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => setShowSaveSessionDialog(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              isDarkMode
                ? 'border-team-blue-40 text-white hover:bg-team-white-10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!hasName || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      </form>
    </div>
  );
};
