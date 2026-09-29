import { Fragment } from 'react';
import { Check, Trash2, X } from 'lucide-react';

import { useIsCompact } from '@/hooks';
import { useLiveControls } from './liveControlsContext';
import { EditMatchActions } from './PrimaryAction';

/**
 * The list of saved matches. Tapping a row opens it for editing.
 *
 * The per-match score summary wraps on narrow screens rather than
 * overflowing, so the row stays readable on a phone.
 */
export const MatchLog = () => {
  const {
    sessionData,
    isDarkMode,
    editingMatchId,
    deleteConfirmId,
    setDeleteConfirmId,
    startEditingMatch,
    setPendingEditMatch,
    setShowUnsavedEditWarning,
    handleDeleteMatch,
  } = useLiveControls();
  const isCompact = useIsCompact();

  const matches = sessionData.matches || [];
  if (matches.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border-2 overflow-hidden ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
          isDarkMode
            ? 'text-gray-400 border-b border-gray-700'
            : 'text-gray-500 border-b border-gray-200'
        }`}
      >
        Match Log
      </div>
      <div
        className={`divide-y overflow-y-auto ${isCompact && editingMatchId ? '' : 'max-h-[158px]'} ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}
      >
        {matches.map(match => {
          const isEditing = editingMatchId === match.id;
          const isConfirmingDelete = deleteConfirmId === match.id;
          return (
            <Fragment key={match.id}>
              <div
                className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors cursor-pointer ${
                  isEditing
                    ? 'bg-yellow-400/50'
                    : isDarkMode
                      ? 'hover:bg-gray-800'
                      : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (!isEditing && !isConfirmingDelete) {
                    if (editingMatchId) {
                      setPendingEditMatch(match);
                      setShowUnsavedEditWarning(true);
                    } else {
                      startEditingMatch(match);
                    }
                  }
                }}
              >
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0">
                  <span
                    className={`text-sm font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Match {match.matchNumber}
                  </span>
                  <span
                    className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    Score: {match.finalScore ?? 0}
                  </span>
                  <span
                    className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    G:{match.garden ?? 0} T:{match.tipping ?? 0} F:
                    {match.flower ?? 0} H:{match.ballsInHive ?? 0}
                  </span>
                  {isEditing && (
                    <span className="text-sm font-bold text-yellow-900 bg-yellow-400 px-3 py-1 rounded-full shadow-lg">
                      Editing
                    </span>
                  )}
                </div>
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  {!isConfirmingDelete ? (
                    <button
                      onClick={() => setDeleteConfirmId(match.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400'
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                      }`}
                      title="Delete match"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                        title="Confirm delete"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-black'
                        }`}
                        title="Cancel delete"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/*
                On a phone the primary Save/Cancel pair is a screen away at
                the top of the page, so tapping a match would otherwise look
                like it did nothing. Give it its controls right where the tap
                happened.
              */}
              {isEditing && isCompact && (
                <div className="px-4 py-3 space-y-2 bg-yellow-400/10">
                  <p
                    className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Match {match.matchNumber} is loaded into the scoring fields
                    above. Change what you need, then save.
                  </p>
                  <div className="flex gap-2">
                    <EditMatchActions />
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};
