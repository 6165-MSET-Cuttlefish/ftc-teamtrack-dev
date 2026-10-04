import { toast } from 'sonner';

import { GAME_TIMING } from '@/constants';
import { useSession } from '@/contexts';
import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { PauseResumeButton } from './MatchControls';
import {
  formatPoints,
  isPrimarySlotConfirm,
  useLiveControls,
  type PendingConfirm,
} from './liveControlsContext';
import { actionClass, toneText } from './tones';
import { useCompactControls } from './useCompactControls';

/** Match clock values above this are the 3-2-1 before AUTO of a Full Game */
const PLAYING_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

/** Shape of the buttons in the action bar; width and colours are per button */
const BAR_BUTTON = 'h-12 rounded-2xl text-base whitespace-nowrap';

/**
 * "1:35": the playing time left in the match. The only part of the controls
 * that follows the clock, so it alone re-renders every second.
 */
const TimeLeft = () => {
  const { timer, formatTime } = useSession();
  return <>{formatTime(Math.min(timer, PLAYING_SECONDS))}</>;
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
    <>
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={() => {
          // The second tap of a double tap saves nothing, so says nothing.
          if (!saveEditedMatch()) return;
          toast.success(`${name} updated`);
          setShowUnsavedEditWarning(false);
        }}
        className={`flex-1 min-w-0 px-4 ${size} ${actionClass(quiet ? 'neutral' : 'primary', isDarkMode)}`}
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
        Discard changes
      </button>
    </>
  );
};

/** The question about the match (or, on a phone, the session) in the bar. */
const PrimaryQuestion = ({ pending }: { pending: PendingConfirm }) => {
  const {
    matchNumber,
    matchActive,
    matchEnded,
    handleKeepConfirm,
    handleConfirmEndMatch,
    handleConfirmSaveMatch,
    handleCountFirst,
    handleDiscardCurrentMatch,
  } = useLiveControls();
  const stacked = useCompactControls();
  const layout = { stacked, className: 'flex-1 basis-full' };
  // On a phone the bar's bottom row is where the thumb goes back to without
  // looking. Through a question about the match it keeps Pause on its spot
  // (until the buzzer) and the safe choice on the rest, where End early or
  // the full-width Save Match was: a reach for either can't land on the
  // button that ends, saves or discards.
  const matchLayout =
    stacked && matchActive
      ? {
          ...layout,
          keepBelow: true,
          aside: matchEnded ? undefined : <PauseResumeButton quiet />,
        }
      : layout;

  switch (pending) {
    case 'endEarly':
      // Ending stops the clock as the buzzer does; the match is then counted
      // and saved like any other.
      return (
        <ConfirmInline
          {...matchLayout}
          tone="save"
          question={
            <>
              End Match {matchNumber} now? (<TimeLeft /> left)
            </>
          }
          keepLabel="Keep scoring"
          confirmLabel="End match"
          onKeep={handleKeepConfirm}
          onConfirm={handleConfirmEndMatch}
        />
      );
    case 'saveZeroEom':
      return (
        <ConfirmInline
          {...matchLayout}
          tone="save"
          question={`Flowers, Left in Hive and Garden are all 0. Save Match ${matchNumber} anyway?`}
          keepLabel="Count them first"
          confirmLabel="Save"
          onKeep={handleCountFirst}
          onConfirm={handleConfirmSaveMatch}
        />
      );
    case 'discardMatch':
      return (
        <ConfirmInline
          {...matchLayout}
          question={`Discard Match ${matchNumber}?`}
          detail="Nothing from it is saved."
          keepLabel="Keep match"
          confirmLabel="Discard match"
          onKeep={handleKeepConfirm}
          onConfirm={handleDiscardCurrentMatch}
        />
      );
    case 'completeWithStray':
      return <StrayNumbersQuestion {...layout} />;
    default:
      return null;
  }
};

/**
 * Complete Session pressed with numbers in Match Entry that belong to no
 * saved match. Asked where that button is: in the bar on a phone, with the
 * session buttons on a full-size screen.
 */
export const StrayNumbersQuestion = ({
  stacked = false,
  keepFirst = false,
  className = '',
}: {
  stacked?: boolean;
  keepFirst?: boolean;
  className?: string;
}) => {
  const {
    currentMatchTotal,
    handleKeepConfirm,
    handleConfirmCompleteWithStray,
  } = useLiveControls();

  return (
    <ConfirmInline
      stacked={stacked}
      keepFirst={keepFirst}
      className={className}
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
 * The button that drives a match forward, by state:
 *
 * - no match running: "Start Match N", and on a phone, once a match is
 *   saved, Complete Session beside it (the session buttons are at the far
 *   end of the page there);
 * - match running or paused: a small "End early", so the one large target
 *   during play is Pause and a stray thumb can't end the match. It asks,
 *   then ends the match as the buzzer does (it is never saved before the
 *   end-of-match counts can be made);
 * - after the buzzer: "Save Match N · X pts", under a line that says what
 *   to count first;
 * - a logged match open for editing: Save / Discard changes;
 * - a question about the match, in place of all of the above.
 *
 * Its children sit in the layout's action bar (a wrapping row; fixed to the
 * bottom of the screen on a phone) next to Pause / Resume. Exactly one of
 * them is filled at a time.
 */
export const PrimaryAction = () => {
  const {
    sessionData,
    isDarkMode,
    loading,
    matchActive,
    matchEnded,
    matchNumber,
    savedMatchCount,
    currentMatchTotal,
    editingMatchId,
    pendingConfirm,
    showUnsavedEditWarning,
    isSessionSetupSaved,
    handleStartMatch,
    handleRequestEndMatch,
    handleSaveMatch,
    handleRequestCompleteSession,
  } = useLiveControls();
  const isCompact = useCompactControls();

  if (pendingConfirm && isPrimarySlotConfirm(pendingConfirm, isCompact)) {
    return <PrimaryQuestion pending={pendingConfirm} />;
  }

  if (editingMatchId) {
    return (
      <>
        <EditMatchActions />
        {showUnsavedEditWarning && (
          <p
            role="alert"
            className={`basis-full rounded-xl border-2 border-orange-500/60 bg-orange-500/15 px-3 py-2 text-xs font-semibold ${toneText('orange', isDarkMode)}`}
          >
            You have unsaved changes. Save or discard them before switching
            matches.
          </p>
        )}
      </>
    );
  }

  if (!matchActive) {
    const hasName = Boolean(sessionData.sessionName?.trim());
    // A question about the session (Discard Session, or Complete Session
    // with stray numbers on a full-size screen) is asked elsewhere on the
    // page: while it is open its answer is the next step, so Start Match
    // stays usable as an outline, as +1 Tip does.
    const asking = pendingConfirm !== null;
    return (
      <>
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={handleStartMatch}
          disabled={!hasName}
          title={
            !isSessionSetupSaved
              ? 'Save session settings before starting'
              : !hasName
                ? 'Complete session setup (Session Name) before starting'
                : undefined
          }
          className={`flex-1 min-w-0 px-3 ${BAR_BUTTON} ${actionClass(asking ? 'neutral' : 'primary', isDarkMode)}`}
        >
          Start Match {matchNumber}
        </button>
        {isCompact && savedMatchCount > 0 && (
          <button
            type="button"
            onKeyDown={ignoreHeldEnter}
            onClick={handleRequestCompleteSession}
            disabled={loading}
            className={`shrink-0 px-3 h-12 rounded-2xl text-sm whitespace-nowrap ${actionClass('neutral', isDarkMode)}`}
          >
            {loading ? 'Saving...' : 'Complete Session'}
          </button>
        )}
      </>
    );
  }

  if (!matchEnded) {
    return (
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={handleRequestEndMatch}
        className={`shrink-0 px-4 ${BAR_BUTTON} ${actionClass('neutral', isDarkMode)}`}
      >
        End early
      </button>
    );
  }

  // On a phone the line goes over the button; on a wider screen beside it,
  // where it fits in the button's height (two lines at most), so the
  // scoring fields under the controls don't move at the buzzer.
  return (
    <div
      className={`flex-1 basis-full min-w-0 flex ${isCompact ? 'flex-col gap-1.5' : 'items-center gap-3'}`}
    >
      <p
        role="status"
        className={`text-sm font-semibold leading-snug ${isCompact ? '' : 'flex-1 min-w-0 line-clamp-2'} ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
      >
        Match {matchNumber} over: count Flowers, Left in Hive and Garden, then
        save
      </p>
      <button
        type="button"
        onKeyDown={ignoreHeldEnter}
        onClick={handleSaveMatch}
        className={`${isCompact ? 'w-full px-3' : 'shrink-0 px-6'} ${BAR_BUTTON} ${actionClass('primary', isDarkMode)}`}
      >
        Save Match {matchNumber} · {formatPoints(currentMatchTotal)}
      </button>
    </div>
  );
};
