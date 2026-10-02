import { Settings } from 'lucide-react';

import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { toneText } from './tones';

/**
 * Toggles the session setup panel. Split out of `SessionActions` so it can
 * sit next to the setup panel itself rather than with the session-completion
 * buttons — on a phone those live in different places on the page.
 */
export const OpenSetupButton = () => {
  const { isDarkMode, isSessionSetupSaved, onOpenSessionSetup } =
    useLiveControls();

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={onOpenSessionSetup}
      className={`w-12 h-12 shrink-0 rounded-2xl border-2 transition-colors flex items-center justify-center ${
        !isSessionSetupSaved
          ? 'border-red-500/60 bg-red-500/20 hover:bg-red-500/30'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark hover:bg-[#2a2a2a]'
            : 'border-team-blue-40 bg-white hover:bg-gray-50'
      }`}
      title="Edit Session Setup"
      aria-label="Edit Session Setup"
    >
      <Settings
        aria-hidden
        className={`h-5 w-5 ${!isSessionSetupSaved ? toneText('red', isDarkMode) : isDarkMode ? 'text-white' : 'text-black'}`}
      />
    </button>
  );
};
