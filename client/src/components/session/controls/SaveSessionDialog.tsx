import { useId, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass, toneText } from './tones';
import { useArmed } from './useArmed';

/** Same cap as the name field in session setup */
const MAX_NAME_LENGTH = 80;

/**
 * Asks the user to confirm the session name before the session is saved.
 * New sessions start out named after their type and date ("Practice · Oct
 * 1"), so this is where most users actually name theirs.
 *
 * Built on the shared Dialog, which keeps Tab inside it and hands focus back
 * to Complete Session when it closes.
 *
 * It stays open, with nothing in it to press, while the session is saved:
 * the page under it can't be changed until what was stored is known.
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
  const nameId = useId();
  const errorId = useId();
  // The name field takes focus as the dialog opens, so a second Enter right
  // behind the one on Complete Session would save the session unseen.
  const armed = useArmed();

  const confirm = () => {
    if (!hasName || loading) return;
    handleCompleteSession(name.trim());
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !loading) setShowSaveSessionDialog(false);
      }}
    >
      <DialogContent
        className={`max-w-sm border p-6 ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        <form
          noValidate
          // The Enter that opened the dialog must not submit it too: not while
          // still held, and not pressed again before the dialog has been seen.
          onKeyDown={e => {
            ignoreHeldEnter(e);
            if (e.key === 'Enter' && !armed) e.preventDefault();
          }}
          onSubmit={e => {
            e.preventDefault();
            confirm();
          }}
          className="space-y-4"
        >
          <DialogTitle
            className={`justify-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Save session?
          </DialogTitle>
          <div className="space-y-2">
            <label
              htmlFor={nameId}
              className={`block text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Session Name
            </label>
            <Input
              id={nameId}
              name="sessionName"
              type="text"
              autoComplete="off"
              data-autofocus
              maxLength={MAX_NAME_LENGTH}
              disabled={loading}
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={e => e.target.select()}
              aria-invalid={!hasName}
              aria-describedby={hasName ? undefined : errorId}
              className={`h-12 px-4 rounded-xl border-2 border-team-blue-40 focus:ring-2 focus:ring-team-blue/20 ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              }`}
            />
            {!hasName && (
              <p
                id={errorId}
                role="alert"
                className={`text-xs font-medium ${toneText('red', isDarkMode)}`}
              >
                Session name is required
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowSaveSessionDialog(false)}
              className={`px-4 min-h-11 rounded-xl text-sm ${actionClass('neutral', isDarkMode)}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasName || loading}
              className={`px-4 min-h-11 rounded-xl text-sm ${actionClass('primary', isDarkMode)}`}
            >
              {loading ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
