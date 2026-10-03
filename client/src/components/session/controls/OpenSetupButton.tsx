import { Settings } from 'lucide-react';

import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { toneText } from './tones';
import { useCompactControls } from './useCompactControls';

/**
 * Toggles the session setup panel. Split out of `SessionActions` so it can
 * sit next to the setup panel itself rather than with the session-completion
 * buttons — on a phone those live in different places on the page.
 *
 * On a phone it says "Settings" until a match starts: a bare gear in the
 * corner is easy to miss when it is the only way to the session's name and
 * type. During a match it is the icon alone, leaving the row to the match.
 */
export const OpenSetupButton = () => {
  const { isDarkMode, isSessionSetupSaved, matchActive, onOpenSessionSetup } =
    useLiveControls();
  const isCompact = useCompactControls();
  const labelled = isCompact && !matchActive;
  const ink = !isSessionSetupSaved
    ? toneText('red', isDarkMode)
    : isDarkMode
      ? 'text-white'
      : 'text-black';

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={onOpenSessionSetup}
      className={`h-12 shrink-0 rounded-2xl border-2 transition-colors flex items-center justify-center gap-2 text-sm font-semibold ${ink} ${
        labelled ? 'px-3' : 'w-12'
      } ${
        !isSessionSetupSaved
          ? 'border-red-500/60 bg-red-500/20 hover:bg-red-500/30'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark hover:bg-[#2a2a2a]'
            : 'border-team-blue-40 bg-white hover:bg-gray-50'
      }`}
      title="Edit Session Setup"
      aria-label="Edit Session Setup"
    >
      <Settings aria-hidden className="h-5 w-5 shrink-0" />
      {labelled && 'Settings'}
    </button>
  );
};
