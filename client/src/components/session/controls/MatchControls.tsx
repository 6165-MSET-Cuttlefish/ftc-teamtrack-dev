import { useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, X } from 'lucide-react';

import { GAME_TIMING } from '@/constants';
import { useSession, useSessionCore } from '@/contexts';
import type { MatchPhase } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { isPrimarySlotConfirm, useLiveControls } from './liveControlsContext';
import { actionClass } from './tones';
import { useArmed } from './useArmed';
import { useCompactControls } from './useCompactControls';

/**
 * Pause / resume: one large button, for as long as there is a match clock
 * to stop (the 3-2-1, AUTO, controller pickup, TELEOP).
 *
 * It is the big target while a match runs, where Save used to be, so a
 * stray thumb pauses rather than ends the match. Pause is an outline in
 * every theme; Resume is the filled button, the next step once paused.
 * A question about the match takes its place in the action bar, and on a
 * phone brings it along (see `PrimaryAction`). On a full-size screen it
 * stays where it is, beside the question, giving it the width it needs.
 *
 * Controller pickup has its own countdown (the match clock is stopped for
 * it), so there the button freezes and resumes that countdown instead.
 */
export const PlayPauseControl = () => {
  const { matchPhase, matchActive, editingMatchId, pendingConfirm } =
    useLiveControls();
  const isCompact = useCompactControls();

  if (editingMatchId || !matchActive || matchPhase === 'ended') return null;
  const asking = isPrimarySlotConfirm(pendingConfirm, isCompact);
  if (asking && isCompact) return null;

  // Discard Session asks at the end of the page: until it is answered,
  // Resume is an outline, and the question's own buttons are the next step.
  return (
    <PauseResumeButton
      quiet={pendingConfirm !== null}
      besideQuestion={asking}
    />
  );
};

/**
 * True on a full-size screen while a question about the match is asked in
 * the row of controls: the tools beside it (Skip, the X) give up their
 * places to it, so the question and its answers are the row, end to end,
 * and they are all there is to press there. Its safe answer reaches the
 * row's end, over where they were (see `PrimaryQuestion`).
 */
const useRowQuestionOpen = (): boolean => {
  const { pendingConfirm } = useLiveControls();
  const isCompact = useCompactControls();
  return !isCompact && isPrimarySlotConfirm(pendingConfirm, isCompact);
};

/**
 * The Pause / Resume button itself. `quiet` keeps Resume an outline too,
 * for when a question beside it is what needs answering first.
 * `besideQuestion`: it gives up its spare width to a question asked beside
 * it in the row, but never past its label; in a row too short for both it
 * shows its icon alone (the label stays its name for a screen reader).
 */
export const PauseResumeButton = ({
  quiet = false,
  besideQuestion = false,
}: {
  quiet?: boolean;
  besideQuestion?: boolean;
}) => {
  const { isDarkMode, isTimerRunning, setIsTimerRunning, matchPhase } =
    useLiveControls();
  const { isPickupPaused, setIsPickupPaused, isTutorialActive } =
    useSessionCore();

  const inPickup = matchPhase === 'controller_pickup';
  // The walkthrough's practice match never starts its clock, and stands for
  // a match being played: it is not one the user paused.
  const running =
    isTutorialActive || (inPickup ? !isPickupPaused : isTimerRunning);
  const Icon = running ? Pause : Play;

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() =>
        inPickup ? setIsPickupPaused(running) : setIsTimerRunning(!running)
      }
      className={`flex-1 ${besideQuestion ? 'min-w-fit' : 'min-w-0'} px-4 h-12 rounded-2xl text-base gap-2 ${actionClass(running || quiet ? 'neutral' : 'primary', isDarkMode)}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {/* Beside a question, a short row (the full-size layout's controls
          row is a size container) keeps only the icon on screen */}
      <span
        className={
          besideQuestion ? '[@container(max-width:54rem)]:sr-only' : undefined
        }
      >
        {running ? 'Pause' : 'Resume'}
      </span>
    </button>
  );
};

/**
 * Discard the in-progress match: a small X, out of the way of the scoring
 * thumb. It only asks; the question, and the button that discards, show in
 * the action bar. On a phone it is 44px, as the gear it takes the place of
 * at the end of the title row; on a full-size screen as tall as its row.
 */
export const CancelMatchButton = () => {
  const {
    isDarkMode,
    matchActive,
    matchNumber,
    editingMatchId,
    handleRequestDiscardMatch,
  } = useLiveControls();
  const standAside = useRowQuestionOpen();
  const isCompact = useCompactControls();

  if (editingMatchId || !matchActive) return null;

  const name = `Discard Match ${matchNumber}`;
  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleRequestDiscardMatch}
      title={name}
      aria-label={name}
      className={`ml-auto shrink-0 ${
        isCompact ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl'
      } ${actionClass('dangerOutline', isDarkMode)} ${standAside ? 'hidden' : ''}`}
    >
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
};

/** The next point of the match that Skip jumps to */
type SkipTarget = 'teleop' | 'endgame' | 'end';

const SKIP_LABELS: Record<SkipTarget, { full: string; to: string }> = {
  teleop: { full: 'Skip to Teleop', to: 'to Teleop' },
  endgame: { full: 'Skip to Endgame', to: 'to Endgame' },
  end: { full: 'Skip to Buzzer', to: 'to Buzzer' },
};

/** Every target a match of this type gets to, in the order it gets there */
const skipTargetsFor = (matchType: string): SkipTarget[] => {
  switch (matchType) {
    case 'Full Game':
      return ['teleop', 'endgame', 'end'];
    case 'Teleop':
      return ['endgame', 'end'];
    default:
      return ['end'];
  }
};

/**
 * Where Skip goes from here: TELEOP from AUTO (and controller pickup) of a
 * Full Game, ENDGAME from earlier in TELEOP, and the buzzer from ENDGAME or
 * from AUTO of an Autonomous match. Null once the match is over.
 */
const skipTargetOf = (
  matchType: string,
  matchPhase: MatchPhase,
  timer: number
): SkipTarget | null => {
  if (matchPhase === 'teleop') {
    return timer > GAME_TIMING.ENDGAME_REMAINING ? 'endgame' : 'end';
  }
  if (matchPhase === 'auton' || matchPhase === 'controller_pickup') {
    if (matchType === 'Full Game') return 'teleop';
    if (matchType === 'Autonomous' && matchPhase === 'auton') return 'end';
  }
  return null;
};

/** A press this soon after Skip changed where it goes is ignored */
const SKIP_ARM_DELAY_MS = 1000;

/** One target's label: "Skip to Teleop", or "Skip" over a small "to Teleop" */
const SkipLabel = ({
  target,
  twoLines,
}: {
  target: SkipTarget;
  twoLines: boolean;
}) =>
  twoLines ? (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      <span className="flex items-center gap-1.5">
        <SkipForward className="h-4 w-4 shrink-0" />
        Skip
      </span>
      <span className="text-xs font-semibold">{SKIP_LABELS[target].to}</span>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <SkipForward className="h-4 w-4 shrink-0" />
      {SKIP_LABELS[target].full}
    </span>
  );

/**
 * Every label this match will show, one over the other, only `shown`'s
 * visible: as wide as the longest, so the row doesn't shift when the
 * target moves on.
 */
const SkipLabels = ({
  targets,
  shown,
  twoLines,
}: {
  targets: SkipTarget[];
  shown: SkipTarget | null;
  twoLines: boolean;
}) => (
  <span className="grid justify-items-center">
    {targets.map(t => (
      <span
        key={t}
        className={`col-start-1 row-start-1 ${t === shown ? '' : 'invisible'}`}
      >
        <SkipLabel target={t} twoLines={twoLines} />
      </span>
    ))}
  </span>
);

/**
 * The width `button`'s row can give it: the row less its other controls
 * and gaps. A control that stretches (the phone's title, the desktop's
 * Pause and End early) counts at the least width it can take.
 */
const roomFor = (button: HTMLElement): number => {
  const row = button.parentElement;
  if (!row) return Infinity;
  const rowStyle = getComputedStyle(row);
  const gap = parseFloat(rowStyle.columnGap) || 0;
  let room =
    row.clientWidth -
    (parseFloat(rowStyle.paddingLeft) || 0) -
    (parseFloat(rowStyle.paddingRight) || 0);
  for (const child of row.children) {
    if (child === button || !(child instanceof HTMLElement)) continue;
    const style = getComputedStyle(child);
    if (
      style.display === 'none' ||
      ['absolute', 'fixed'].includes(style.position)
    ) {
      continue;
    }
    room -= gap;
    room -=
      parseFloat(style.flexGrow) > 0
        ? parseFloat(style.minWidth) || 0
        : child.getBoundingClientRect().width;
  }
  return room;
};

/**
 * Skip ahead to the next point of the match — a deliberate, between-action
 * control. One button whose target moves on with the match, so it never
 * adds a second one to the row.
 *
 * It says where it goes in full ("Skip to Teleop") wherever its row has
 * the width for that, measured rather than guessed from the layout; only a
 * row too narrow for it gets "Skip" over a small "to Teleop". On a phone it
 * is a 44px button in smaller type, as the other buttons of the title row:
 * a deliberate control, not one to compete with the clock under it.
 */
export const MatchExtras = () => {
  const {
    sessionData,
    isDarkMode,
    matchPhase,
    matchActive,
    editingMatchId,
    skipToTeleop,
    skipToEndgame,
    skipToEnd,
  } = useLiveControls();
  const { timer } = useSession();
  const standAside = useRowQuestionOpen();
  const isCompact = useCompactControls();
  const target =
    editingMatchId || !matchActive
      ? null
      : skipTargetOf(sessionData.matchType, matchPhase, timer);
  // The label changes in place under the pointer: the second tap of a
  // double tap (or a press right as ENDGAME starts) must not skip again.
  const armed = useArmed(SKIP_ARM_DELAY_MS, target);
  const targets = skipTargetsFor(sessionData.matchType);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const shownRef = useRef<HTMLSpanElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const [twoLines, setTwoLines] = useState(false);
  const showing = target !== null;

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const shown = shownRef.current;
    const full = fullRef.current;
    const row = button?.parentElement;
    if (!button || !shown || !full || !row) return;
    const fit = () => {
      // Out of the row while a question has its place: it comes back as
      // it went
      if (button.offsetWidth === 0) return;
      // The button's padding and border, around the full labels
      const needed = button.offsetWidth - shown.offsetWidth + full.offsetWidth;
      setTwoLines(needed > roomFor(button));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    // The labels' own width changes once the web font is in
    observer.observe(full);
    return () => observer.disconnect();
  }, [showing, sessionData.matchType]);

  if (!target) return null;

  const skip = { teleop: skipToTeleop, endgame: skipToEndgame, end: skipToEnd };

  return (
    <button
      ref={buttonRef}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() => {
        if (!armed) return;
        // What comes up in its place (the next Skip, or after the buzzer the
        // hint and Save Match) must not take the second press of a double
        // tap. Skip to Buzzer also holds Save Match off for a moment.
        absorbDoubleTap();
        skip[target]();
      }}
      aria-label={SKIP_LABELS[target].full}
      className={`relative shrink-0 px-3 whitespace-nowrap ${
        isCompact ? 'h-11 rounded-xl text-sm' : 'h-12 rounded-2xl text-base'
      } ${actionClass('neutral', isDarkMode)} ${standAside ? 'hidden' : ''}`}
    >
      <span ref={shownRef} aria-hidden>
        <SkipLabels targets={targets} shown={target} twoLines={twoLines} />
      </span>
      {/* The full labels, unseen, to know whether they fit. Laid out from
          the right edge, so they never widen the page. */}
      <span
        ref={fullRef}
        aria-hidden
        className="absolute right-0 top-0 invisible pointer-events-none"
      >
        <SkipLabels targets={targets} shown={null} twoLines={false} />
      </span>
    </button>
  );
};
