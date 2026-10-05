import { useEffect, useState } from 'react';

import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { StrayNumbersQuestion } from './PrimaryAction';
import { SaveSessionDialog } from './SaveSessionDialog';
import { actionClass } from './tones';
import { useCompactControls } from './useCompactControls';

const BUTTON = 'shrink-0 whitespace-nowrap px-5 h-12 rounded-2xl text-base';

/** "Discard this session and its 2 saved matches?", naming all that goes. */
const discardQuestion = (savedMatches: number, matchRunning: boolean) => {
  const lost = [
    ...(savedMatches > 0
      ? [
          savedMatches === 1
            ? 'its saved match'
            : `its ${savedMatches} saved matches`,
        ]
      : []),
    ...(matchRunning ? ['the match in progress'] : []),
  ];
  if (lost.length === 0) return 'Discard this session?';
  if (lost.length === 1) return `Discard this session and ${lost[0]}?`;
  return `Discard this session, ${lost[0]} and ${lost[1]}?`;
};

/**
 * Session-level actions: complete the session, discard it.
 *
 * Neither is filled: the filled button on this page is always the one that
 * moves the match forward. Complete Session only appears once a match is
 * saved: before that there is nothing to complete, and the button could
 * only answer with an error. They are at the end of the page on every
 * layout, away from the scoring steppers: in the footer under Session
 * Notes on a full-size screen. On a phone Complete Session is offered in
 * the action bar between matches instead (see `PrimaryAction`), so only
 * Discard Session shows here. (The setup toggle used to live here too;
 * it's now `OpenSetupButton`, next to the setup panel it controls.)
 *
 * Discard Session asks first, in place of the button, and never touches the
 * match clock; what it discards can be put back from the toast that follows.
 */
export const SessionActions = () => {
  const {
    isDarkMode,
    loading,
    matchActive,
    savedMatchCount,
    pendingConfirm,
    showSaveSessionDialog,
    handleRequestCompleteSession,
    handleRequestDiscardSession,
    handleConfirmDiscardSession,
    handleKeepConfirm,
  } = useLiveControls();
  const isCompact = useCompactControls();
  /** How wide Discard Session was when pressed: the safe choice covers it */
  const [pressedWidth, setPressedWidth] = useState<number>();

  // That width belongs to the layout it was pressed in. Turning the phone
  // while the question is open lays the page out afresh, where it could be
  // wider than the screen: the safe choice then takes its own width.
  useEffect(() => {
    if (pressedWidth === undefined) return;
    const pressedAt = window.innerWidth;
    const forget = () => {
      if (window.innerWidth !== pressedAt) setPressedWidth(undefined);
    };
    window.addEventListener('resize', forget);
    return () => window.removeEventListener('resize', forget);
  }, [pressedWidth]);

  // One question at a time, and nothing else to press beside it.
  const asking =
    pendingConfirm === 'discardSession' ||
    (pendingConfirm === 'completeWithStray' && !isCompact);

  return (
    <>
      {showSaveSessionDialog && <SaveSessionDialog />}

      {pendingConfirm === 'completeWithStray' && !isCompact && (
        <StrayNumbersQuestion keepFirst />
      )}
      {pendingConfirm === 'discardSession' && (
        <ConfirmInline
          // On a phone the button is full width: Keep Session takes all of
          // its spot, and Discard goes up beside the question. On a full
          // screen the session buttons are a row of their own in the
          // footer, under Session Notes, in every state, and the question
          // takes that whole row: Keep Session follows the narrow question,
          // over where Discard Session was and at least as wide, and
          // Discard comes after it.
          keepBelow={isCompact}
          keepFirst={!isCompact}
          keepMinWidth={pressedWidth}
          reveal
          question={discardQuestion(savedMatchCount, matchActive)}
          keepLabel="Keep Session"
          confirmLabel="Discard"
          onKeep={handleKeepConfirm}
          onConfirm={handleConfirmDiscardSession}
        />
      )}

      {/*
        Stays enabled at the session limit: pressing it is what explains why
        the session can't be saved.
      */}
      {!asking && !isCompact && savedMatchCount > 0 && (
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={handleRequestCompleteSession}
          disabled={loading}
          className={`${BUTTON} ${actionClass('neutral', isDarkMode)}`}
        >
          {loading ? 'Saving…' : 'Complete Session'}
        </button>
      )}
      {!asking && (
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={event => {
            setPressedWidth(event.currentTarget.offsetWidth);
            handleRequestDiscardSession();
          }}
          className={`${BUTTON} ${actionClass('dangerOutline', isDarkMode)}`}
        >
          Discard Session
        </button>
      )}
    </>
  );
};
