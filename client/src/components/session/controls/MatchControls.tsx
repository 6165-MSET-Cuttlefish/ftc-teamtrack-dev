import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, X } from 'lucide-react';

import { GAME_TIMING } from '@/constants';
import { useSession, useSessionCore } from '@/contexts';
import type { MatchPhase } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { actionClass } from './tones';
import { useTakeDroppedFocus } from './takeDroppedFocus';
import { useArmed } from './useArmed';
import { useCompactControls } from './useCompactControls';

/** Pauses and resumes the match from a laptop keyboard */
const PAUSE_SHORTCUT = 'P';

/**
 * Pause / resume: one large button, for as long as there is a match clock
 * to stop (the 3-2-1, AUTO, controller pickup, TELEOP).
 *
 * It is the big target while a match runs, where Save used to be, so a
 * stray thumb pauses rather than ends the match. Pause is an outline in
 * every theme; Resume is the filled button, the next step once paused.
 *
 * Controller pickup has its own countdown (the match clock is stopped for
 * it), so there the button freezes and resumes that countdown instead.
 */
export const PlayPauseControl = () => {
  const { matchPhase, matchActive, editingMatchId } = useLiveControls();

  if (editingMatchId || !matchActive || matchPhase === 'ended') return null;
  return <PauseResumeButton />;
};

/**
 * The Pause / Resume button itself. On a laptop P presses it, and so does
 * Space while nothing else on the page has focus (where Space would
 * otherwise scroll the scoring pad away mid-match): never while something
 * is being typed, or a dialog or the tutorial is up.
 */
const PauseResumeButton = () => {
  const { isDarkMode, isTimerRunning, setIsTimerRunning, matchPhase } =
    useLiveControls();
  const { isPickupPaused, setIsPickupPaused, isTutorialActive } =
    useSessionCore();
  // It comes up as Start Match goes: a keyboard user carries on from here,
  // the big target while play is on (End early beside it ends the match).
  const ref = useRef<HTMLButtonElement>(null);
  useTakeDroppedFocus(ref);

  const inPickup = matchPhase === 'controller_pickup';
  // The walkthrough's practice match never starts its clock, and stands for
  // a match being played: it is not one the user paused.
  const running =
    isTutorialActive || (inPickup ? !isPickupPaused : isTimerRunning);
  const Icon = running ? Pause : Play;
  const toggle = () =>
    inPickup ? setIsPickupPaused(running) : setIsTimerRunning(!running);

  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    if (isTutorialActive) return;
    const pauseOnKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented)
        return;
      const target = e.target;
      const onPage =
        !(target instanceof HTMLElement) || target === document.body;
      const isShortcut = e.key.toUpperCase() === PAUSE_SHORTCUT;
      if (!isShortcut && !(e.key === ' ' && onPage)) return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="dialog"]'))
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      toggleRef.current();
    };
    document.addEventListener('keydown', pauseOnKey);
    return () => document.removeEventListener('keydown', pauseOnKey);
  }, [isTutorialActive]);

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={toggle}
      data-play-pause
      aria-keyshortcuts={isTutorialActive ? undefined : PAUSE_SHORTCUT}
      // As wide as its words at least, so that where End early can't fit
      // beside it (a 200% zoom) that goes onto a line of its own
      className={`min-w-0 flex-[1_1_auto] px-4 h-12 rounded-2xl text-base gap-2 ${actionClass(running ? 'neutral' : 'primary', isDarkMode)}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {running ? 'Pause' : 'Resume'}
      {/* Only while the key does something: not in the walkthrough */}
      {!isTutorialActive && (
        <kbd
          aria-hidden
          title={`Shortcut: press ${PAUSE_SHORTCUT} to ${running ? 'pause' : 'resume'}`}
          // Faded only where that still reads: white on the light theme's
          // filled Resume is under 4.5:1 at anything less than full
          className={`rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 [@media(pointer:coarse)]:hidden ${isDarkMode ? 'opacity-70' : ''}`}
        >
          {PAUSE_SHORTCUT}
        </kbd>
      )}
    </button>
  );
};

/**
 * Discard the in-progress match: a small X, out of the way of the scoring
 * thumb. It discards at once; its toast has the Undo, which brings the
 * match back where the field is now. On a phone it is 44px, as the other
 * buttons of the title row; on a full-size screen as tall as its row.
 */
export const CancelMatchButton = () => {
  const {
    isDarkMode,
    matchActive,
    matchNumber,
    editingMatchId,
    handleDiscardMatch,
  } = useLiveControls();
  const isCompact = useCompactControls();

  if (editingMatchId || !matchActive) return null;

  const name = `Discard Match ${matchNumber}`;
  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleDiscardMatch}
      title={name}
      aria-label={name}
      className={`ml-auto shrink-0 ${
        isCompact ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl'
      } ${actionClass('dangerOutline', isDarkMode)}`}
    >
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
};

/** The next point of the match that Skip jumps to */
type SkipTarget = 'teleop' | 'flowers' | 'end';

const SKIP_LABELS: Record<SkipTarget, { full: string; to: string }> = {
  teleop: { full: 'Skip to Teleop', to: 'to Teleop' },
  flowers: { full: 'Skip to 1:00', to: 'to 1:00' },
  end: { full: 'Skip to Buzzer', to: 'to Buzzer' },
};

/** Every target a match of this type gets to, in the order it gets there */
const skipTargetsFor = (matchType: string): SkipTarget[] => {
  switch (matchType) {
    case 'Full Game':
      return ['teleop', 'flowers', 'end'];
    case 'Teleop':
      return ['flowers', 'end'];
    default:
      return ['end'];
  }
};

/**
 * Where Skip goes from here: TELEOP from AUTO (and controller pickup) of a
 * Full Game, 1:00 (FLOWERS) from earlier in TELEOP, and the buzzer from
 * FLOWERS or from AUTO of an Autonomous match. Null once the match is over.
 */
const skipTargetOf = (
  matchType: string,
  matchPhase: MatchPhase,
  timer: number
): SkipTarget | null => {
  if (matchPhase === 'teleop') {
    return timer > GAME_TIMING.FLOWERS_UNLOCK_REMAINING ? 'flowers' : 'end';
  }
  if (matchPhase === 'auton' || matchPhase === 'controller_pickup') {
    if (matchType === 'Full Game') return 'teleop';
    if (matchType === 'Autonomous' && matchPhase === 'auton') return 'end';
  }
  return null;
};

/** A press this soon after Skip changed where it goes is ignored */
const SKIP_ARM_DELAY_MS = 1000;

/**
 * Under 260px wide (a phone at 200% zoom) the title row has room for the
 * Skip icon alone beside Discard and the menu; the button's name still
 * says where it goes.
 */
const NARROW_HIDDEN = 'max-[259px]:hidden';

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
        <span className={NARROW_HIDDEN}>Skip</span>
      </span>
      <span className={`text-xs font-semibold ${NARROW_HIDDEN}`}>
        {SKIP_LABELS[target].to}
      </span>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <SkipForward className="h-4 w-4 shrink-0" />
      <span className={NARROW_HIDDEN}>{SKIP_LABELS[target].full}</span>
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
    skipToFlowers,
    skipToEnd,
  } = useLiveControls();
  const { timer } = useSession();
  const isCompact = useCompactControls();
  const target =
    editingMatchId || !matchActive
      ? null
      : skipTargetOf(sessionData.matchType, matchPhase, timer);
  // The label changes in place under the pointer: the second tap of a
  // double tap (or a press right as FLOWERS starts) must not skip again.
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
      // Not laid out (the page hidden): measured once it is
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

  const skip = { teleop: skipToTeleop, flowers: skipToFlowers, end: skipToEnd };

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
      title={SKIP_LABELS[target].full}
      className={`relative shrink-0 px-3 whitespace-nowrap max-[259px]:w-11 max-[259px]:px-0 ${
        isCompact ? 'h-11 rounded-xl text-sm' : 'h-12 rounded-2xl text-base'
      } ${actionClass('neutral', isDarkMode)}`}
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
