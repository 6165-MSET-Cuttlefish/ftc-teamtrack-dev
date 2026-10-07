import { useState } from 'react';

import { useSessionCore } from '@/contexts';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass } from './tones';

/**
 * The last activity of the session the user chose to carry on with: it is
 * not asked about again until there has been more (a match saved, another
 * day gone by after it).
 */
const CONTINUED_KEY = 'teamtrack-stale-session-continued';

const readContinued = (): number | null => {
  try {
    return Number(localStorage.getItem(CONTINUED_KEY)) || null;
  } catch {
    return null;
  }
};

/** Two times on the same calendar day, where the user is */
const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

/**
 * A session left open since an earlier day (nobody pressed Complete
 * Session): asked about once, in one line at the top of the page, so the
 * next practice doesn't land in it unnoticed. "Continue" keeps it (a scrim
 * over two days); "Finish it, start new" saves it as it stands and opens a
 * fresh session, here. Not while the match clock is counting: nothing on
 * the page moves while a match is being played.
 */
export const StaleSessionNotice = () => {
  const {
    sessionData,
    isDarkMode,
    loading,
    savedMatchCount,
    lastActivityAt,
    handleFinishAndStartNew,
  } = useLiveControls();
  const { isTimerRunning, isPickupPaused, matchPhase, isTutorialActive } =
    useSessionCore();
  const [continued, setContinued] = useState(readContinued);

  const counting =
    matchPhase === 'controller_pickup' ? !isPickupPaused : isTimerRunning;
  if (
    lastActivityAt === null ||
    sameDay(lastActivityAt, Date.now()) ||
    continued === lastActivityAt ||
    counting ||
    isTutorialActive
  ) {
    return null;
  }

  const date = new Date(lastActivityAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const keep = () => {
    try {
      localStorage.setItem(CONTINUED_KEY, String(lastActivityAt));
    } catch {
      /* storage unavailable: asked again next time */
    }
    setContinued(lastActivityAt);
  };

  return (
    <div
      role="region"
      aria-label="Session from an earlier day"
      data-stale-session
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 px-4 py-2 ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-blue/10'
          : 'border-team-blue/50 bg-team-blue/5'
      }`}
    >
      <p
        className={`min-w-0 flex-1 basis-48 text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
      >
        {sessionData.sessionName || 'This session'} from {date} is still open
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={keep}
          className={`min-h-11 px-4 rounded-xl text-sm ${actionClass('neutral', isDarkMode)}`}
        >
          Continue
        </button>
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={handleFinishAndStartNew}
          disabled={loading}
          className={`min-h-11 px-4 rounded-xl text-sm ${actionClass('neutral', isDarkMode)}`}
        >
          {loading
            ? 'Saving…'
            : savedMatchCount > 0
              ? 'Finish it, start new'
              : 'Start new'}
        </button>
      </div>
    </div>
  );
};
