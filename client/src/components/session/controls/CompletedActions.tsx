import { Link } from 'react-router-dom';

import { ROUTES } from '@/constants';
import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass, toneText } from './tones';
import { useArmed } from './useArmed';

/** Tall enough for a thumb, and free to grow when the label wraps */
const BUTTON =
  'flex-1 min-w-[160px] px-4 md:px-6 py-3 min-h-14 md:min-h-16 rounded-2xl text-lg text-center whitespace-normal';

/**
 * Post-session actions, shown once the session has been saved. Looking at
 * what was just recorded is the next step, so that is the filled button;
 * starting over is the outline.
 */
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
        className={`${BUTTON} ${actionClass('primary', isDarkMode)}`}
      >
        {loading ? 'Loading…' : 'View Analysis'}
      </button>

      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          if (armed) handleNewSession();
        }}
        className={`${BUTTON} ${actionClass('neutral', isDarkMode)}`}
      >
        New Session
      </button>

      {newSessionConfirm && (
        <ConfirmInline
          className="basis-full"
          question="Discard unsaved matches?"
          keepLabel="Keep"
          confirmLabel="Discard"
          onKeep={() => setNewSessionConfirm(false)}
          onConfirm={handleConfirmNewSession}
        />
      )}
    </div>
  );
};

/**
 * The link to the sessions list on the completed screen: a plain link, the
 * quiet third choice under the two buttons. It sits where the save dialog's
 * Save Session button was, so it waits out a double tap too.
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
      className={`inline-flex min-h-11 items-center justify-center px-4 text-base font-semibold underline underline-offset-4 decoration-2 hover:decoration-[3px] ${toneText('blue', isDarkMode)}`}
    >
      View Sessions
    </Link>
  );
};
