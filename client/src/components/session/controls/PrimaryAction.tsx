import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import {
  formatPoints,
  isPrimarySlotConfirm,
  useLiveControls,
} from './liveControlsContext';
import { useStartNudge } from './startNudge';
import {
  useCatchDroppedFocus,
  useTakeDroppedFocus,
  useWatchFocus,
} from './takeDroppedFocus';
import { actionClass } from './tones';
import { useCompactControls } from './useCompactControls';
import { ELEMENT_LABELS } from '@/lib';
import {
  countersShown,
  useScoringLocks,
} from '@/components/session/useScoringLocks';

/** Shape of the buttons in the action bar; width and colours are per button */
const BAR_BUTTON = 'h-12 rounded-2xl text-base whitespace-nowrap';

/** How long "Press Start first" stays up after a nudge */
const NUDGE_NOTE_MS = 2200;

/**
 * Where keyboard focus goes when the control that had it is gone and
 * nothing took its place: Pause while a match is played, else the one
 * filled button of the moment (Start Match, Save Match, Save the edit).
 */
const focusFallback = (): HTMLElement | null => {
  for (const selector of ['[data-play-pause]', '[data-primary-action]']) {
    const el = document.querySelector<HTMLButtonElement>(selector);
    if (el && !el.disabled && el.getClientRects().length > 0) return el;
  }
  return null;
};

/**
 * Save / Discard changes for a logged match that is open for editing.
 *
 * The filled pair goes in the primary action slot (the bar on a phone). The
 * Match Log shows a `quiet` copy under its list on a full-size screen, where
 * the primary slot can be scrolled out of sight: outlined, so the page still
 * has one filled button.
 */
export const EditMatchActions = ({ quiet = false }: { quiet?: boolean }) => {
  const {
    isDarkMode,
    editingMatchNumber,
    setShowUnsavedEditWarning,
    saveEditedMatch,
    returnToCurrentMatch,
  } = useLiveControls();

  const name =
    editingMatchNumber === null ? 'Match' : `Match ${editingMatchNumber}`;
  const size = quiet ? 'min-h-11 rounded-xl text-sm' : BAR_BUTTON;

  return (
    // Save is the wider of the two at every width. A size container, so
    // the rest goes by the width the pair actually has (a phone's bar, or
    // its narrower column on its side), not the screen's: under 22rem
    // "Discard changes" would be the wider, so it is just "Discard" there.
    // Too narrow for both on one line (a 200% zoom), Discard goes under
    // Save, at the end of the line, rather than past the screen's edge.
    <div className="flex-1 min-w-0 flex flex-wrap items-center justify-end gap-2 [container-type:inline-size]">
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          // The second tap of a double tap saves nothing, so says nothing.
          if (!saveEditedMatch()) return;
          toast.success(`${name} updated`);
          setShowUnsavedEditWarning(false);
        }}
        data-primary-action={quiet ? undefined : true}
        className={`min-w-0 flex-[1_1_auto] px-4 ${size} ${actionClass(quiet ? 'neutral' : 'primary', isDarkMode)}`}
      >
        Save {name}
      </button>
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          returnToCurrentMatch();
          setShowUnsavedEditWarning(false);
        }}
        className={`shrink-0 px-4 ${size} ${actionClass('neutral', isDarkMode)}`}
      >
        <span className="[@container(min-width:22rem)]:hidden">Discard</span>
        <span className="hidden [@container(min-width:22rem)]:inline">
          Discard changes
        </span>
      </button>
    </div>
  );
};

/**
 * Complete Session pressed with numbers in Match Entry that belong to no
 * saved match: asked in the bar, where that button is. On a phone in two
 * rows, the question over its answers; on a full-size screen in one line
 * as tall as the row of controls, so nothing under it moves.
 */
const StrayNumbersQuestion = () => {
  const {
    currentMatchTotal,
    handleKeepConfirm,
    handleConfirmCompleteWithStray,
  } = useLiveControls();
  const stacked = useCompactControls();

  return (
    <ConfirmInline
      stacked={stacked}
      inline={!stacked}
      className={stacked ? 'flex-1 basis-full' : 'flex-1 min-w-0 justify-end'}
      question={`There are unsaved numbers in Match Entry${
        currentMatchTotal > 0 ? ` (${formatPoints(currentMatchTotal)})` : ''
      }.`}
      detail="They are not part of any saved match."
      keepLabel="Keep editing"
      confirmLabel="Discard them and finish"
      onKeep={handleKeepConfirm}
      onConfirm={handleConfirmCompleteWithStray}
    />
  );
};

/**
 * Start Match N. It comes up where Save Match (or the X) was pressed, and
 * a keyboard user's focus carries on from it.
 *
 * Before Start, the controls a match uses look ready, but a tap on one has
 * no match to go into: it nudges this button instead (see `startNudge`).
 * Each nudge plays a short pulse around it and shows "Press Start first"
 * above it for a moment, also said to a screen reader.
 */
const StartMatchButton = () => {
  const { sessionData, isDarkMode, matchNumber, handleStartMatch } =
    useLiveControls();
  const ref = useRef<HTMLButtonElement>(null);
  useTakeDroppedFocus(ref);
  const hasName = Boolean(sessionData.sessionName?.trim());
  const nudge = useStartNudge();
  const [noteShown, setNoteShown] = useState(false);

  useEffect(() => {
    if (nudge === 0) return;
    setNoteShown(true);
    const timer = setTimeout(() => setNoteShown(false), NUDGE_NOTE_MS);
    return () => clearTimeout(timer);
  }, [nudge]);

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleStartMatch}
      data-start-match
      data-primary-action
      title={hasName ? undefined : 'Name the session before starting'}
      // Takes whatever Complete Session leaves: from a 320px phone up that
      // fits "Start Match 100", so the two share one row. Narrower than
      // that (a 200% zoom), it is as wide as its words at least, and
      // Complete Session goes onto a line of its own.
      className={`relative min-w-0 flex-[1_1_0%] max-[319px]:flex-[1_1_auto] px-3 ${BAR_BUTTON} ${actionClass('primary', isDarkMode)}`}
    >
      Start Match {matchNumber}
      {/* Replayed from the start on every nudge */}
      {nudge > 0 && (
        <span
          key={nudge}
          aria-hidden
          className="tt-start-nudge pointer-events-none absolute -inset-0.5 rounded-2xl"
        />
      )}
      {noteShown && (
        <span
          key={`note-${nudge}`}
          aria-hidden
          className={`tt-start-note pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm font-bold shadow-lg ${
            isDarkMode
              ? 'border-team-blue bg-team-dark text-white'
              : 'border-team-blue bg-white text-gray-900'
          }`}
        >
          Press Start first
        </span>
      )}
      <span role="status" className="sr-only">
        {noteShown ? 'Press Start first' : ''}
      </span>
      <style>{`
        @keyframes ttStartNudge {
          from { box-shadow: 0 0 0 0 rgb(var(--team-blue) / 0.75); }
          to { box-shadow: 0 0 0 14px rgb(var(--team-blue) / 0); }
        }
        @keyframes ttStartNote {
          from { opacity: 0; transform: translate(-50%, 4px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .tt-start-nudge { animation: ttStartNudge 700ms ease-out 2 both; }
        .tt-start-note { animation: ttStartNote 160ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .tt-start-nudge { animation: none; box-shadow: 0 0 0 3px rgb(var(--team-blue) / 0.6); }
          .tt-start-note { animation: none; }
        }
      `}</style>
    </button>
  );
};

/**
 * End early: the match ends at once, as at its buzzer, and is counted and
 * saved from there; its toast has the Undo. A small outline, so the one
 * large target during play is Pause and a stray thumb pauses rather than
 * ends the match. A press the moment it appears (the tail of a double tap
 * on Start or Resume) does nothing.
 */
const EndEarlyButton = () => {
  const { isDarkMode, handleEndEarly } = useLiveControls();

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleEndEarly}
      className={`shrink-0 px-4 ${BAR_BUTTON} ${actionClass('neutral', isDarkMode)}`}
    >
      End early
    </button>
  );
};

/**
 * The button that drives a match forward, by state:
 *
 * - no match running: "Start Match N", and once a match is saved, Complete
 *   Session beside it, on every layout;
 * - match running or paused: a small "End early", so the one large target
 *   during play is Pause and a stray thumb can't end the match. It ends
 *   the match as the buzzer does (it is never saved before the
 *   end-of-match counts can be made), with an Undo;
 * - after the buzzer: "Save Match N (X pts)" alone. What to count first is
 *   said once, by End of Match's own caption; here it is only announced;
 * - a logged match open for editing: Save / Discard changes;
 * - Complete Session's question about stray numbers, in place of Start.
 *
 * Its children sit in the layout's action bar (fixed to the bottom of the
 * screen on a phone) next to Pause / Resume. Exactly one of them is filled
 * at a time.
 */
export const PrimaryAction = () => {
  const { matchEnded, matchNumber } = useLiveControls();
  // An Autonomous match has no end-of-match counters (AUTO scores none of
  // them): only its park is left to mark
  const { hasTeleop, scoring } = useScoringLocks();
  const shown = countersShown(hasTeleop, scoring);
  const counts = [
    shown.flowers && 'the flowers',
    shown.hiveGarden && `${ELEMENT_LABELS.hive} and ${ELEMENT_LABELS.garden}`,
  ].filter(Boolean);
  const todo =
    counts.length > 0
      ? `count ${counts.join(', ')}, then save`
      : `mark ${ELEMENT_LABELS.parkAuto}, then save`;
  useWatchFocus();
  useCatchDroppedFocus(focusFallback);

  return (
    <>
      {/* Always on the page, so the buzzer's message is a change to it that
          screen readers announce. */}
      <p role="status" className="sr-only">
        {matchEnded ? `Match ${matchNumber} over: ${todo}` : ''}
      </p>
      <PrimaryControls />
    </>
  );
};

const PrimaryControls = () => {
  const {
    isDarkMode,
    loading,
    matchActive,
    matchEnded,
    matchNumber,
    savedMatchCount,
    currentMatchTotal,
    editingMatchId,
    pendingConfirm,
    handleSaveMatch,
    handleRequestCompleteSession,
  } = useLiveControls();

  if (isPrimarySlotConfirm(pendingConfirm)) return <StrayNumbersQuestion />;

  // Tapping another match while this one has unsaved changes is answered
  // under the row that was tapped, in the Match Log, not here.
  if (editingMatchId) return <EditMatchActions />;

  if (!matchActive) {
    return (
      <>
        <StartMatchButton />
        {savedMatchCount > 0 && (
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={handleRequestCompleteSession}
            disabled={loading}
            className={`shrink-0 px-3 h-12 rounded-2xl text-sm whitespace-nowrap ${actionClass('neutral', isDarkMode)}`}
          >
            {loading ? 'Saving…' : 'Complete Session'}
          </button>
        )}
      </>
    );
  }

  if (!matchEnded) return <EndEarlyButton />;

  return (
    <SaveMatchButton
      matchNumber={matchNumber}
      total={currentMatchTotal}
      onSave={handleSaveMatch}
    />
  );
};

/**
 * Save Match N, with its points, after the buzzer. One button, the width
 * Start Match will have: on a phone the bar stays one button tall at the
 * buzzer, and on a full-size screen the next match's Start comes up where
 * this was. It comes up where End early or Skip to Buzzer was pressed, and
 * a keyboard user's focus carries on from them.
 *
 * Too narrow for it on one line (a 200% zoom), the points go under the
 * name rather than past the edge of the screen.
 */
const SaveMatchButton = ({
  matchNumber,
  total,
  onSave,
}: {
  matchNumber: number;
  total: number;
  onSave: () => void;
}) => {
  const { isDarkMode } = useLiveControls();
  const ref = useRef<HTMLButtonElement>(null);
  useTakeDroppedFocus(ref);

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={onSave}
      data-primary-action
      className={`flex-1 min-w-0 flex-wrap gap-x-1.5 px-3 ${BAR_BUTTON} max-[259px]:h-auto max-[259px]:min-h-12 max-[259px]:py-1 max-[259px]:leading-tight ${actionClass('primary', isDarkMode)}`}
    >
      <span>Save Match {matchNumber}</span> <span>({formatPoints(total)})</span>
    </button>
  );
};
