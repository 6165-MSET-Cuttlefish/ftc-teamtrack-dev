import { useEffect, useRef, useState } from 'react';
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
import { useTakeDroppedFocus, useWatchFocus } from './takeDroppedFocus';
import { actionClass } from './tones';
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
    // Save is the wider of the two at every width. A size container, so
    // the rest goes by the width the pair actually has (a phone's bar, or
    // its narrower column on its side), not the screen's: under 22rem
    // "Discard changes" would be the wider, so it is just "Discard" there.
    <div className="flex-1 min-w-0 flex items-center gap-2 [container-type:inline-size]">
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
        <span className="[@container(min-width:22rem)]:hidden">Discard</span>
        <span className="hidden [@container(min-width:22rem)]:inline">
          Discard changes
        </span>
      </button>
    </div>
  );
};

/**
 * From the left edge of `button` to the end of the row of controls it is
 * in, in px: how wide the safe answer of the question it asks has to be to
 * cover its spot, ending the row where the tools that give way to the
 * question (Skip, the X) were.
 */
const spanToRowEnd = (button: HTMLElement): number | undefined => {
  const row = button.closest<HTMLElement>('[data-tutorial="controls"]');
  if (!row) return undefined;
  const end =
    row.getBoundingClientRect().right -
    (parseFloat(getComputedStyle(row).paddingRight) || 0);
  return Math.ceil(end - button.getBoundingClientRect().left);
};

/** The question about the match (or, on a phone, the session) in the bar. */
const PrimaryQuestion = ({
  pending,
  endEarlySpan,
}: {
  pending: PendingConfirm;
  /** See `spanToRowEnd`: End early's, as it was pressed */
  endEarlySpan?: number;
}) => {
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
  //
  // On a full-size screen the question is asked in the row of controls,
  // in one line as tall as its buttons, so nothing under the row moves.
  // The tools beside it give it their places, so it spans the row. Until
  // the buzzer Pause stays first in the row (see `PlayPauseControl`) and
  // takes the width the question doesn't need. The safe choice ends the
  // row, nearest the button that asked: from where End early was to the
  // end, or over the X. Save Match is the exception: it took the row's
  // whole width, so its question does too, and the safe choice most of
  // it: wherever Save was pressed, it is there.
  const askedBySave = pending === 'saveZeroEom';
  const matchLayout = !matchActive
    ? layout
    : stacked
      ? {
          ...layout,
          keepBelow: true,
          aside: matchEnded ? undefined : <PauseResumeButton quiet />,
        }
      : {
          inline: true,
          keepWide: askedBySave,
          keepMinWidth: pending === 'endEarly' ? endEarlySpan : undefined,
          // With no Pause to take the spare width (after the buzzer), the
          // question takes it and keeps its answers at the end.
          className: matchEnded
            ? `flex-1 min-w-0 ${askedBySave ? '' : 'justify-end'}`
            : '',
        };

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
              End Match {matchNumber} now?{' '}
              <span className="whitespace-nowrap">
                (<TimeLeft /> left)
              </span>
            </>
          }
          keepLabel="Keep scoring"
          confirmLabel="End Match"
          onKeep={handleKeepConfirm}
          onConfirm={handleConfirmEndMatch}
        />
      );
    case 'saveZeroEom':
      return (
        <ConfirmInline
          {...matchLayout}
          tone="save"
          question={`Save Match ${matchNumber} with Flowers, Left in Hive and Garden at 0?`}
          keepLabel="Count them first"
          confirmLabel="Save anyway"
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
          keepLabel="Keep Match"
          confirmLabel="Discard Match"
          // The X that asked is named "Discard Match N" too, and stays on
          // screen: focus moves on to the question's safe answer.
          confirmAriaLabel={`Yes, discard Match ${matchNumber}`}
          autoFocusKeep
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
 * Start Match N. It comes up where Save Match (or Discard Match) was
 * pressed, and keyboard focus carries on from it.
 */
const StartMatchButton = ({ asking }: { asking: boolean }) => {
  const {
    sessionData,
    isDarkMode,
    matchNumber,
    isSessionSetupSaved,
    handleStartMatch,
  } = useLiveControls();
  const ref = useRef<HTMLButtonElement>(null);
  useTakeDroppedFocus(ref);
  const hasName = Boolean(sessionData.sessionName?.trim());

  return (
    <button
      ref={ref}
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
  );
};

/**
 * End early. It comes back where Keep scoring was (or the question closed
 * with Escape), and keyboard focus carries on from it. `onPress` is told
 * how far its spot reaches to the end of its row (see `spanToRowEnd`).
 */
const EndEarlyButton = ({
  onPress,
}: {
  onPress: (span: number | undefined) => void;
}) => {
  const { isDarkMode, handleRequestEndMatch } = useLiveControls();
  const ref = useRef<HTMLButtonElement>(null);
  useTakeDroppedFocus(ref);

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={event => {
        onPress(spanToRowEnd(event.currentTarget));
        handleRequestEndMatch();
      }}
      className={`shrink-0 px-4 ${BAR_BUTTON} ${actionClass('neutral', isDarkMode)}`}
    >
      End early
    </button>
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
 * - after the buzzer: "Save Match N · X pts" alone. What to count first is
 *   said once, by End of Match's own caption; here it is only announced;
 * - a logged match open for editing: Save / Discard changes;
 * - a question about the match, in place of all of the above.
 *
 * Its children sit in the layout's action bar (fixed to the bottom of the
 * screen on a phone) next to Pause / Resume. Exactly one of them is filled
 * at a time.
 */
export const PrimaryAction = () => {
  const { matchEnded, matchNumber } = useLiveControls();
  useWatchFocus();

  return (
    <>
      {/* Always on the page, so the buzzer's message is a change to it that
          screen readers announce. */}
      <p role="status" className="sr-only">
        {matchEnded
          ? `Match ${matchNumber} over: count Flowers, Left in Hive and Garden, then save`
          : ''}
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
  const isCompact = useCompactControls();
  /** End early's spot to the row's end, as it was pressed */
  const [endEarlySpan, setEndEarlySpan] = useState<number>();

  // That span belongs to the width it was pressed at: once the window is
  // made wider or narrower, the safe answer takes its own width. Not when
  // only its height changes (a tablet's toolbar folding away as the page
  // scrolls, an on-screen keyboard): End Match would move along the row to
  // where Skip was.
  useEffect(() => {
    if (endEarlySpan === undefined) return;
    const width = window.innerWidth;
    const forget = () => {
      if (window.innerWidth !== width) setEndEarlySpan(undefined);
    };
    window.addEventListener('resize', forget);
    return () => window.removeEventListener('resize', forget);
  }, [endEarlySpan]);

  if (pendingConfirm && isPrimarySlotConfirm(pendingConfirm, isCompact)) {
    return (
      <PrimaryQuestion pending={pendingConfirm} endEarlySpan={endEarlySpan} />
    );
  }

  // Tapping another match while this one has unsaved changes is answered
  // under the row that was tapped, in the Match Log, not here.
  if (editingMatchId) return <EditMatchActions />;

  if (!matchActive) {
    // A question about the session (Discard Session, or Complete Session
    // with stray numbers on a full-size screen) is asked elsewhere on the
    // page: while it is open its answer is the next step, so Start Match
    // stays usable as an outline, as +1 Tip does.
    const asking = pendingConfirm !== null;
    return (
      <>
        <StartMatchButton asking={asking} />
        {isCompact && savedMatchCount > 0 && (
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

  if (!matchEnded) return <EndEarlyButton onPress={setEndEarlySpan} />;

  // One button, the width Start Match will have: on a phone the bar stays
  // one button tall at the buzzer, and on a full-size screen the next
  // match's Start comes up where this was.
  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleSaveMatch}
      className={`flex-1 min-w-0 px-3 ${BAR_BUTTON} ${actionClass('primary', isDarkMode)}`}
    >
      Save Match {matchNumber} · {formatPoints(currentMatchTotal)}
    </button>
  );
};
