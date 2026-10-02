import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { ROUTES } from '@/constants';
import { SESSION_LIMIT_MESSAGE, useLiveControls } from './liveControlsContext';

/**
 * Stays on screen for as long as the signed-in user is at their session cap.
 *
 * A toast is gone in seconds, and by then a whole session may have been
 * recorded that can't be saved. The wrapper is always rendered so screen
 * readers announce the message when it appears.
 */
export const SessionLimitBanner = () => {
  const { sessionLimitReached, isDarkMode } = useLiveControls();

  return (
    <div role="status">
      {sessionLimitReached && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-3">
          <div
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 text-sm font-medium ${
              isDarkMode
                ? 'border-red-500/50 bg-red-500/10 text-red-300'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            <p className="flex-1 min-w-0">{SESSION_LIMIT_MESSAGE}</p>
            <Link
              to={ROUTES.SESSIONS}
              className="inline-flex shrink-0 items-center whitespace-nowrap underline font-bold"
            >
              My Sessions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
