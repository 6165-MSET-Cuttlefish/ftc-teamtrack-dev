import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Settings } from 'lucide-react';

import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { SESSION_SETUP_PANEL_ID } from './setupPanelId';
import { actionClass, toneText } from './tones';
import { useCompactControls } from './useCompactControls';

/**
 * `aria-controls` names the panel only while something on the page has its
 * id, so it never points at nothing. The panel opens and closes with the
 * page's own state, which re-renders this button with it.
 */
const useAriaControls = (ref: RefObject<HTMLButtonElement | null>) => {
  useLayoutEffect(() => {
    const button = ref.current;
    if (!button) return;
    if (document.getElementById(SESSION_SETUP_PANEL_ID)) {
      button.setAttribute('aria-controls', SESSION_SETUP_PANEL_ID);
    } else {
      button.removeAttribute('aria-controls');
    }
  });
};

/**
 * Toggles the session setup panel. Split out of `SessionActions` so it can
 * sit next to the setup panel itself rather than with the session-completion
 * buttons — on a phone those live in different places on the page.
 *
 * It is not there while a match runs: nothing in the settings is needed
 * then (the name is the only thing they would let you change), and the
 * panel would open above the scoring fields and push them off the screen.
 * A panel left open when the match starts closes with it (what was typed
 * in it is already in the session: its own Save only closes it). It comes
 * back as the match is saved or discarded, and while a saved match is open
 * for editing.
 *
 * A gear, as on the desktop: on a phone a 44px icon button at the end of
 * the title row, so the session's name is the row's one word. Its name is
 * "Settings" for a screen reader (and as a tooltip with a mouse). The same
 * outline as the row's other buttons, red only while the settings have not
 * been saved yet: the one time it has to be found.
 *
 * `expanded`: whether the panel is open, from the page that opens it.
 */
export const OpenSetupButton = ({ expanded }: { expanded: boolean }) => {
  const {
    isDarkMode,
    isSessionSetupSaved,
    matchActive,
    editingMatchId,
    onOpenSessionSetup,
  } = useLiveControls();
  const isCompact = useCompactControls();
  const ref = useRef<HTMLButtonElement>(null);
  useAriaControls(ref);

  // A match is under way, rather than a saved one open for editing
  const live = matchActive && !editingMatchId;
  const wasLiveRef = useRef(live);
  // Before the start is drawn, so the panel never shows over the match.
  useLayoutEffect(() => {
    const started = live && !wasLiveRef.current;
    wasLiveRef.current = live;
    // Once, as it starts: never toggled back open.
    if (started && expanded) onOpenSessionSetup?.();
    // Only as a match starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  if (live) return null;

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={onOpenSessionSetup}
      aria-expanded={expanded}
      aria-label="Settings"
      title="Settings"
      className={`shrink-0 ${
        isCompact ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl'
      } ${
        isSessionSetupSaved
          ? actionClass('neutral', isDarkMode)
          : `border-2 font-bold transition-colors flex items-center justify-center border-red-500/60 bg-red-500/20 hover:bg-red-500/30 ${toneText('red', isDarkMode)}`
      }`}
    >
      <Settings aria-hidden className="h-5 w-5 shrink-0" />
    </button>
  );
};
