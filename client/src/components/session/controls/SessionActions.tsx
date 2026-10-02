import { Check, X } from 'lucide-react';

import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { SaveSessionDialog } from './SaveSessionDialog';
import { toneText } from './tones';

/**
 * Session-level actions: complete the session, cancel it.
 *
 * These are deliberately outside the fixed pane on a phone — they are
 * between-match actions, and putting them next to the scoring steppers is
 * how you lose a match to a mis-tap. (The setup toggle used to live here too;
 * it's now `OpenSetupButton`, next to the setup panel it controls.)
 */
export const SessionActions = () => {
  const {
    isDarkMode,
    loading,
    cancelConfirm,
    showSaveSessionDialog,
    handleRequestCompleteSession,
    handleRequestCancelSession,
    handleConfirmCancelSession,
    handleKeepSession,
  } = useLiveControls();

  return (
    <>
      {showSaveSessionDialog && <SaveSessionDialog />}
      {/*
        Stays enabled at the session limit: pressing it is what explains why
        the session can't be saved.
      */}
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={handleRequestCompleteSession}
        disabled={loading}
        className={`shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 ${toneText('green', isDarkMode)} text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
        title={loading ? 'Saving...' : 'Complete Session'}
      >
        {loading ? 'Saving...' : 'Complete Session'}
      </button>

      {!cancelConfirm ? (
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={handleRequestCancelSession}
          className={`shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl border-2 border-red-500/40 bg-red-500/20 hover:bg-red-500/25 ${toneText('red', isDarkMode)} text-base font-bold transition-colors flex items-center justify-center`}
          title="Cancel Session"
        >
          Cancel Session
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={handleConfirmCancelSession}
            className="h-12 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-base font-bold transition-colors flex items-center gap-2"
            title="Discard session"
            aria-label="Discard session"
          >
            <Check className="h-5 w-5" aria-hidden />
            Discard
          </button>
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={handleKeepSession}
            className="h-12 px-4 rounded-xl bg-gray-600 hover:bg-gray-700 text-white text-base font-bold transition-colors flex items-center gap-2"
            title="Keep session"
            aria-label="Keep session"
          >
            <X className="h-5 w-5" aria-hidden />
            Keep
          </button>
        </div>
      )}
    </>
  );
};
