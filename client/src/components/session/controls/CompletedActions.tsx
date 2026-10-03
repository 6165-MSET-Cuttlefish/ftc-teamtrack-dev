import { Link } from 'react-router-dom';

import { ROUTES } from '@/constants';
import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass } from './tones';
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
        {loading ? 'Loading...' : 'View analysis'}
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
