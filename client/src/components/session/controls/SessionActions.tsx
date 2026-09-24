import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { useLiveControls } from './liveControlsContext';
import { swallowEnter } from './swallowEnter';

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
    loading,
    isTimerRunning,
    setIsTimerRunning,
    hasStarted,
    sessionLimitReached,
    cancelConfirm,
    setCancelConfirm,
    sessionWasCancelled,
    setSessionWasCancelled,
    onSessionReset,
    resetSession,
    handleCompleteSession,
  } = useLiveControls();

  return (
    <>
      {sessionWasCancelled ? (
        <button
          type="button"
          onKeyDown={swallowEnter}
          onClick={() => {
            resetSession();
            onSessionReset?.();
            setSessionWasCancelled(false);
          }}
          className="shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-base font-bold transition-colors flex items-center justify-center"
          title="Start a new session"
        >
          New Session
        </button>
      ) : (
        <button
          type="button"
          onKeyDown={swallowEnter}
          onClick={handleCompleteSession}
          disabled={loading || sessionLimitReached}
          className="shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title={
            loading
              ? 'Saving...'
              : sessionLimitReached
                ? 'Session Limit Reached'
                : 'Complete Session'
          }
        >
          {loading ? 'Saving...' : 'Complete Session'}
        </button>
      )}

      {!cancelConfirm ? (
        <button
          type="button"
          onKeyDown={swallowEnter}
          onClick={() => {
            setCancelConfirm(true);
            if (isTimerRunning) setIsTimerRunning(false);
          }}
          className="shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl border-2 border-red-500/40 bg-red-500/20 hover:bg-red-500/30 text-red-600 text-base font-bold transition-colors flex items-center justify-center"
          title="Cancel Session"
        >
          Cancel Session
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={() => {
              resetSession();
              setSessionWasCancelled(true);
              setCancelConfirm(false);
              toast.success('Session cancelled');
            }}
            className="h-12 px-4 rounded-xl bg-red-500 hover:bg-red-600 transition-colors"
            title="Confirm cancel — discard session"
          >
            <Check className="h-5 w-5 text-white" />
          </button>
          <button
            type="button"
            onKeyDown={swallowEnter}
            onClick={() => {
              setCancelConfirm(false);
              if (hasStarted) setIsTimerRunning(true);
            }}
            className="h-12 px-4 rounded-xl bg-gray-500 hover:bg-gray-600 transition-colors"
            title="Keep session"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
};
