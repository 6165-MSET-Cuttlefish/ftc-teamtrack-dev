import { useState, useEffect, useId, useRef, memo } from 'react';
import { Info, Lock, Minus, Plus } from 'lucide-react';
import { useTheme } from '@/contexts';
import { formatPoints } from '@/lib/points';
import { FIELD_BORDER } from '@/components/ui/input';
import {
  INFO_BUTTON_CLASS,
  LOCKED_TEXT,
  LOCKED_SURFACE,
} from './EndOfMatchParts';

interface ScoreFieldProps {
  label: string;
  /**
   * The element's name for screen readers and the form ("Increase Flower"),
   * where the visible label says what to count instead. Defaults to `label`.
   */
  ariaName?: string;
  /** A small picture before the visible label */
  icon?: React.ReactNode;
  /**
   * Draw only the input and its steppers: the caller lays out the label,
   * points and rules itself (a group of counters under one heading). Name
   * the element in `label` and point `describedBy` at the visible text.
   */
  hideLabel?: boolean;
  /** Ids of visible text elsewhere that describes the field */
  describedBy?: string;
  value: number;
  onChange: (value: number) => void;
  /** Points this field currently contributes, shown beside the input */
  points?: number;
  /**
   * Points this field hands to the opponent (fouls). Shown under the label
   * as "+N to opponent" — never as part of this alliance's own score.
   */
  opponentPoints?: number;
  disabled?: boolean;
  /**
   * The field looks ready but takes nothing yet (no match is open): its
   * buttons and its box stay drawn as usable, a press on any of them changes
   * nothing and calls this instead (asking for Start), and they are read
   * out as unavailable, with `lockedReasonId` saying why.
   */
  blockedPress?: () => void;
  max?: number;
  /** Render larger, for the scoring fields on the active-session page */
  size?: 'default' | 'large';
  /**
   * Classes for the visible label (size, weight, leading) in place of the
   * ones `size` and `layout` pick, for a field under section headings in a
   * dialog. Not used by `segment`, whose label is already small.
   */
  labelClassName?: string;
  /**
   * `stacked` puts the stepper under the label on a phone, so two fields fit
   * side by side. `compact` keeps one row on a phone by moving the points
   * under the label, for a field in a narrow dialog. From `md` up both are
   * the same single row as `row`. `segment` is a compact tile for the
   * desktop scoring pad: label, (i) and points on one line, and the stepper
   * under it drawn as one joined control.
   */
  layout?: 'row' | 'stacked' | 'compact' | 'segment';
  /** Rules reminder shown under the field and read out with the input */
  hint?: string;
  /**
   * Rules reminder behind an (i) icon beside the label. Shows on hover, and
   * toggles open on tap since phones have no hover.
   */
  info?: string;
  /** Show +/- buttons for quick tap adjustment without opening the keyboard */
  stepper?: boolean;
  /**
   * Text for the + button of a counter tapped while the match runs ("+1
   * Tip"). The button then takes the width the points column had, in every
   * state, so the row keeps its shape when `live` flips. Needs `stepper`.
   */
  liveActionLabel?: string;
  /**
   * The match is being played: the count is a read-only readout instead of
   * a text box, so a tap that misses + can't open the keyboard over the
   * count. Typed entry comes back when this is false.
   */
  live?: boolean;
  /** A key that adds one while `live`, printed on the + button from `md` up */
  liveShortcut?: string;
  /**
   * The + button is the next thing to press, so it is filled. Defaults to
   * `live`. Otherwise (paused, after the buzzer, a saved match) it is an
   * outline like the other steppers, and the page's one filled button stays
   * Resume or Save.
   */
  liveActionFilled?: boolean;
  /** Why the field is locked, shown under it while it is disabled */
  lockedReason?: string;
  /**
   * Id of a caption shown elsewhere (a section header) that says why the
   * field is locked, for fields that share one reason.
   */
  lockedReasonId?: string;
  /** Form field name; defaults to the label in kebab-case */
  name?: string;
  /**
   * Names the record this field belongs to, where one record can replace
   * another without `value` changing (a saved match and the next one both
   * start at 0). Text typed but not committed is dropped when it changes.
   */
  resetKey?: string | number;
}

/** How long a rejected entry keeps the input marked invalid */
const INVALID_FLASH_MS = 1200;

/** Whole, unsigned numbers only: "2.5", "-5" and "1e3" are typos. */
const WHOLE_NUMBER = /^\d+$/;

/**
 * A numeric entry field for one scoring element.
 *
 * Shows the committed value until something is typed, then holds the typed
 * text as a draft so partial input (an empty box mid-edit) is left alone,
 * and commits it on blur, on Enter or when something else on the page is
 * pressed. Only a whole number is accepted, capped at `max`; anything else
 * puts the last value back rather than guessing what was meant.
 */
export const ScoreField = memo(
  ({
    label,
    ariaName,
    icon,
    hideLabel = false,
    describedBy: extraDescribedBy,
    value,
    onChange,
    points,
    opponentPoints,
    disabled = false,
    blockedPress,
    max = 999,
    size = 'default',
    labelClassName,
    layout = 'row',
    hint,
    info,
    stepper = false,
    liveActionLabel,
    live = false,
    liveShortcut,
    liveActionFilled,
    lockedReason,
    lockedReasonId,
    name,
    resetKey,
  }: ScoreFieldProps) => {
    const { isDarkMode } = useTheme();
    const hintId = useId();
    const reasonId = useId();
    const opponentId = useId();
    const infoId = useId();
    const [showInfo, setShowInfo] = useState(false);
    /** Text typed but not yet committed; null when nothing is being edited */
    const [draft, setDraft] = useState<string | null>(null);
    const [invalid, setInvalid] = useState(false);
    const invalidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    /** Set while a commit has left focus in the field with its text selected */
    const reselectOnClick = useRef(false);

    /** The + button is the row's main target ("+1 Tip") */
    const hasLiveAction = stepper && liveActionLabel !== undefined;
    /** No text box: the count only changes by a tap */
    const isLive = hasLiveAction && live && !disabled;
    /** Drawn usable, but every press goes to `blockedPress` */
    const blocked = blockedPress !== undefined && !disabled;
    /**
     * The count is the readout rather than a text box: while live, and
     * while a live counter waits for play to start, so it looks then as it
     * will once play is on
     */
    const readout = isLive || (hasLiveAction && blocked);
    /** Changes counted while live; each one replays the readout's flash */
    const [liveChanges, setLiveChanges] = useState(0);

    // A draft belongs to the value and record it started from. When either
    // is replaced from outside (the match is saved or reset, the walkthrough
    // rolls back) or the field is locked, the draft is dropped rather than
    // committed into the wrong match by a later blur.
    const [draftBase, setDraftBase] = useState({ value, resetKey });
    if (draftBase.value !== value || draftBase.resetKey !== resetKey) {
      if (isLive && draftBase.value !== value) setLiveChanges(n => n + 1);
      // A new record (the match was saved or a new one started) closes the
      // rule, as the counters' own (i) rules close.
      if (draftBase.resetKey !== resetKey) setShowInfo(false);
      setDraftBase({ value, resetKey });
      setDraft(null);
    } else if ((disabled || isLive) && draft !== null) {
      setDraft(null);
    } else if (!isLive && liveChanges !== 0) {
      // The readout is gone; the next time it appears it should not flash.
      setLiveChanges(0);
    }

    const editing = draft !== null && !disabled && !isLive;
    const text = editing ? draft : String(value);

    const selectAll = () => {
      inputRef.current?.select();
      reselectOnClick.current = true;
    };

    // Whenever the committed value lands in a field that still has focus
    // (Enter, a stepper tap that didn't move focus, a reset), select it so
    // the next digits typed replace it instead of being appended.
    useEffect(() => {
      if (!editing && document.activeElement === inputRef.current) {
        selectAll();
      }
    }, [editing, text]);

    useEffect(
      () => () => {
        if (invalidTimer.current) clearTimeout(invalidTimer.current);
      },
      []
    );

    const flashInvalid = () => {
      setInvalid(true);
      if (invalidTimer.current) clearTimeout(invalidTimer.current);
      invalidTimer.current = setTimeout(
        () => setInvalid(false),
        INVALID_FLASH_MS
      );
    };

    const commit = () => {
      if (!editing) return;
      setDraft(null);
      const typedText = draft.trim();
      if (!WHOLE_NUMBER.test(typedText)) {
        // An emptied box is an abandoned edit, not a mistake worth flagging.
        if (typedText !== '') flashInvalid();
        return;
      }
      const typed = parseInt(typedText, 10);
      const next = Math.min(max, typed);
      if (next !== typed) flashInvalid();
      if (next !== value) onChange(next);
    };

    // Pressing anything else on the page ends the edit, even when focus
    // stays in the field: a phone can leave the keyboard up when a button is
    // tapped, and Save Match would then save the match without the number
    // just typed. Heard in the capture phase, so the draft is committed
    // before the control that was pressed acts on it.
    const commitRef = useRef(commit);
    useEffect(() => {
      commitRef.current = commit;
    });
    useEffect(() => {
      if (!editing) return;
      const commitOnOutsideClick = (e: MouseEvent) => {
        if (e.target instanceof Node && rootRef.current?.contains(e.target)) {
          return;
        }
        commitRef.current();
      };
      document.addEventListener('click', commitOnOutsideClick, true);
      return () =>
        document.removeEventListener('click', commitOnOutsideClick, true);
    }, [editing]);

    const isLarge = size === 'large';
    const isStacked = layout === 'stacked';
    const isCompact = layout === 'compact';
    /** On a phone the points sit under the label instead of in a column */
    const pointsUnderLabel = isStacked || isCompact;
    /**
     * A large row has three 48px buttons' worth of controls: on a phone
     * under 360px wide the points column leaves its label too little room,
     * so there the points go under the label too.
     */
    const pointsUnderOnNarrow = isLarge && !pointsUnderLabel;
    /**
     * A compact row with no live button (a dialog's counter) under 280px
     * wide, a phone zoomed to 200%: there the name, with its points, takes
     * a line of its own and the stepper fills the line under it, where
     * side by side the name was drawn over − and + ran off the edge.
     */
    const stackWhenNarrow = isCompact && !hasLiveAction;

    const step = (delta: number) => {
      const typedText = editing ? draft.trim() : '';
      const current = WHOLE_NUMBER.test(typedText)
        ? parseInt(typedText, 10)
        : value;
      const next = Math.min(max, Math.max(0, current + delta));
      setDraft(null);
      if (next !== value) onChange(next);
    };
    /** A press on a stepper: the step, or the ask for Start */
    const press = (delta: number) => (blocked ? blockedPress?.() : step(delta));

    // 48px on a phone keeps the tap target over the 44px minimum while
    // leaving room for the label on a 360px-wide screen. A stacked field
    // gives up 4px of that so the pair still fits on a short phone. Beside
    // a live button they take its height, so the row is one height; on a
    // phone on its side too narrow for the clock's column (an iPhone SE)
    // the row gives up its extra height, down to 44px, so the robot rows
    // under it clear the bar fixed over the bottom of the screen. A row
    // stacked under 280px gives − and + 40px, so the count between them
    // keeps room for two digits.
    const shortStacked = hasLiveAction
      ? '[@media(max-height:500px)_and_(max-width:639px)]:h-11'
      : '';
    const stepBtnSize = isStacked
      ? 'w-11 h-11 md:w-12 md:h-12'
      : hasLiveAction
        ? `w-12 h-14 ${shortStacked}`
        : `${isLarge ? 'w-12 h-12' : 'w-10 h-10'} ${
            stackWhenNarrow ? 'max-[279px]:w-10' : ''
          }`;
    const stepIconSize = isLarge || isStacked ? 20 : 16;
    // The one locked look, as on the robot toggles and the desktop pad: no
    // outline, a faint fill and muted text that still reads (over 3:1).
    // Also a button at its limit (− at 0): it can't be used either.
    const lockedTone = `cursor-not-allowed ${LOCKED_SURFACE}`;
    // `touch-manipulation`: a quick second tap is a second count, not a
    // double-tap zoom.
    const stepBtnClass = (atLimit: boolean) =>
      `flex items-center justify-center rounded-lg border-2 shrink-0 transition-colors touch-manipulation ${stepBtnSize} ${
        disabled || atLimit
          ? lockedTone
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10 active:bg-team-white-10 cursor-pointer'
            : // gray-300 is under 3:1 on the light page; a control's edge
              // has to be visible to be found.
              'border-gray-500 bg-white text-black hover:bg-gray-100 active:bg-gray-100 cursor-pointer'
      }`;
    // The one button pressed over and over while watching the field, not the
    // phone: as wide as the row allows, filled while play is on, and it
    // gives under the thumb. Hover moves the fill away from its text, as on
    // the other filled buttons (lighter would take white on slate under 4.5:1).
    const liveBtnClass = (atLimit: boolean) =>
      `flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border-2 text-lg font-bold whitespace-nowrap select-none touch-manipulation transition-[transform,filter] duration-75 md:w-40 md:flex-none [@media(max-height:500px)_and_(max-width:639px)]:h-11 ${
        disabled || atLimit
          ? lockedTone
          : (liveActionFilled ?? isLive)
            ? `cursor-pointer border-team-blue bg-team-blue active:scale-[0.97] ${
                isDarkMode
                  ? 'text-black hover:brightness-110 active:brightness-90'
                  : 'text-white hover:brightness-90 active:brightness-75'
              }`
            : `cursor-pointer active:scale-[0.97] ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10 active:bg-team-white-10'
                  : 'border-gray-500 bg-white text-black hover:bg-gray-100 active:bg-gray-100'
              }`
      }`;

    // A name stays readable while its field is locked: the controls show
    // the lock.
    const labelTone = isDarkMode ? 'text-gray-200' : 'text-gray-800';
    const mutedTone = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    // red-400 is unreadable on the light background
    const foulTone = isDarkMode ? 'text-red-400' : 'text-red-700';

    // Points are data: the text colour, never the accent. They only show
    // once there are some; their place is kept, so nothing moves when the
    // first one is counted.
    const pointsTone = !points
      ? 'invisible'
      : points < 0
        ? foulTone
        : isDarkMode
          ? 'text-gray-100'
          : 'text-gray-900';

    const pointsWidth = isLarge ? 'w-12 md:w-16' : 'w-16';

    const labelSize =
      isStacked || hasLiveAction
        ? `text-sm leading-4 md:leading-7 ${isLarge ? 'md:text-xl' : 'md:text-lg'}`
        : isCompact
          ? `text-base leading-5 md:leading-7 ${isLarge ? 'md:text-xl' : 'md:text-lg'}`
          : isLarge
            ? 'text-xl'
            : 'text-lg';

    // The text box and the live readout share one box, so swapping one for
    // the other moves nothing. Beside a live button it takes its height.
    const countBox = isStacked
      ? 'h-11 w-full md:h-12 md:w-20'
      : isCompact
        ? `${hasLiveAction ? `h-14 w-11 ${shortStacked}` : isLarge ? 'h-12 w-12' : 'h-10 w-12'} md:w-20 ${
            stackWhenNarrow ? 'max-[279px]:min-w-0 max-[279px]:flex-1' : ''
          }`
        : isLarge
          ? 'h-12 w-16 md:w-20'
          : 'h-10 w-20';
    const countText = isLarge || isStacked ? 'text-xl' : 'text-lg';

    const showLockedReason = disabled && lockedReason !== undefined;
    // Read out with the box and with the steppers, so a locked or maxed-out
    // button still says what it belongs to and why it won't move.
    /** What the input and steppers are called to a screen reader */
    const a11yName = ariaName ?? label;
    const describedBy =
      [
        extraDescribedBy ?? null,
        opponentPoints !== undefined ? opponentId : null,
        hint ? hintId : null,
        showLockedReason ? reasonId : null,
        (disabled || blocked) && lockedReasonId ? lockedReasonId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    const renderInput = (className: string) => (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        name={name ?? a11yName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        aria-label={a11yName}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-disabled={blocked || undefined}
        readOnly={blocked}
        value={text}
        disabled={disabled}
        onClick={blocked ? blockedPress : undefined}
        onChange={e => {
          reselectOnClick.current = false;
          setDraft(e.target.value);
        }}
        onFocus={e => e.target.select()}
        onBlur={() => {
          reselectOnClick.current = false;
          commit();
        }}
        onMouseUp={e => {
          // A click into a field that kept focus after a commit isn't a
          // focus, so it would only drop a caret into the old number and
          // the next digits would be appended. Treat it like the click
          // that focuses the field: select all. The browser places its
          // caret after this event, so that is cancelled here, and the
          // selection is put back a frame later for any browser that
          // places the caret regardless.
          if (!reselectOnClick.current) return;
          const input = e.currentTarget;
          e.preventDefault();
          input.select();
          requestAnimationFrame(() => {
            if (reselectOnClick.current && document.activeElement === input) {
              input.select();
            }
            reselectOnClick.current = false;
          });
        }}
        onKeyDown={e => {
          if (blocked) {
            // Typing a count asks for Start, as a tap does
            if (/^\d$|^Enter$/.test(e.key)) blockedPress?.();
            return;
          }
          if (e.key === 'Enter') {
            // Commit in place: blurring would drop keyboard focus to the
            // page, losing the scorer's place mid-match.
            e.preventDefault();
            commit();
            selectAll();
          }
        }}
        className={className}
      />
    );

    if (layout === 'segment') {
      // Buttons inside the joined control: no box of their own, a tint on
      // hover and a small press so the tap is felt. 44px wide and tall. The
      // control clips its children to its rounded edge, so the focus ring
      // is drawn inside the button, where nothing can cut it off.
      const segBtnClass = (atLimit: boolean) =>
        `flex w-11 shrink-0 items-center justify-center touch-manipulation transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] focus-visible:rounded-[10px] focus-visible:outline-offset-[-3px] ${
          disabled || atLimit
            ? isDarkMode
              ? 'cursor-not-allowed text-white/30'
              : 'cursor-not-allowed text-gray-400'
            : isDarkMode
              ? 'cursor-pointer text-white/85 hover:bg-white/[0.06] active:bg-team-blue/15'
              : 'cursor-pointer text-gray-700 hover:bg-gray-100 active:bg-team-blue/15'
        }`;

      return (
        <div ref={rootRef} className="min-w-0 space-y-1.5">
          {!hideLabel && (
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span
                className={`inline-flex min-w-0 items-center gap-1 text-sm font-semibold leading-5 ${labelTone}`}
              >
                {icon}
                <span className="truncate">{label}</span>
                {info && (
                  <button
                    type="button"
                    aria-label={`About ${a11yName}`}
                    aria-expanded={showInfo}
                    aria-controls={showInfo ? infoId : undefined}
                    onClick={() => setShowInfo(v => !v)}
                    className={`${INFO_BUTTON_CLASS} ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-team-blue'
                        : 'text-gray-500 hover:text-team-blue'
                    }`}
                  >
                    <Info size={14} />
                  </button>
                )}
              </span>
              {points !== undefined ? (
                <span
                  className={`shrink-0 text-xs font-semibold tabular-nums ${pointsTone}`}
                >
                  {formatPoints(points)}
                </span>
              ) : (
                opponentPoints !== undefined && (
                  <span
                    id={opponentId}
                    className={`shrink-0 truncate text-xs font-semibold tabular-nums ${
                      opponentPoints > 0 ? foulTone : mutedTone
                    }`}
                  >
                    +{opponentPoints} to opponent
                  </span>
                )
              )}
            </div>
          )}
          <div
            // The −, count and + have no box of their own: this frame is
            // their outline, a field's (the full gold in honeycomb)
            data-joined
            className={`flex h-11 items-stretch overflow-hidden rounded-xl border transition-colors [@media(pointer:coarse)]:h-[2.875rem] ${
              disabled
                ? LOCKED_SURFACE
                : invalid
                  ? 'border-red-500'
                  : `${FIELD_BORDER} focus-within:border-team-blue ${
                      isDarkMode ? 'bg-black/30' : 'bg-white'
                    }`
            }`}
          >
            {stepper && (
              <button
                type="button"
                aria-label={`Decrease ${a11yName}`}
                aria-describedby={describedBy}
                aria-disabled={blocked || undefined}
                disabled={disabled || value <= 0}
                onClick={() => press(-1)}
                className={segBtnClass(value <= 0)}
              >
                <Minus size={18} />
              </button>
            )}
            {/* Focused, the number's own segment takes a tint of the accent,
                so it is told apart from a focused − or + */}
            {renderInput(
              `h-full w-full min-w-0 rounded-none bg-transparent text-center text-lg font-semibold tabular-nums focus:outline-none focus-visible:bg-team-blue/15 ${
                stepper ? 'border-x' : ''
              } ${
                disabled
                  ? `cursor-not-allowed border-transparent ${LOCKED_TEXT}`
                  : isDarkMode
                    ? 'border-white/10 text-white'
                    : 'border-gray-300 text-gray-900'
              } ${invalid ? 'text-red-500' : ''}`
            )}
            {stepper && (
              <button
                type="button"
                aria-label={`Increase ${a11yName}`}
                aria-describedby={describedBy}
                aria-disabled={blocked || undefined}
                disabled={disabled || value >= max}
                onClick={() => press(1)}
                className={segBtnClass(value >= max)}
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          {info && showInfo && (
            <p
              id={infoId}
              className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              {info}
            </p>
          )}
        </div>
      );
    }

    return (
      <div
        ref={rootRef}
        className={`space-y-1 ${stackWhenNarrow ? 'max-[279px]:w-full' : ''}`}
      >
        <div
          className={
            isStacked
              ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 md:flex md:gap-3'
              : isCompact
                ? // In a column narrower than 15rem (a 200% zoom) the live
                  // row's name takes a line of its own above −, the count
                  // and +1 Tip, which would not fit beside it; so does a
                  // dialog's row on a screen that narrow (stackWhenNarrow)
                  `flex items-center gap-1.5 md:gap-3 ${hasLiveAction ? 'min-h-14 [@media(max-height:500px)_and_(max-width:639px)]:min-h-11 [@container(max-width:15rem)]:flex-wrap [@container(max-width:15rem)]:gap-y-1' : 'max-[279px]:flex-wrap max-[279px]:gap-x-1'}`
                : 'flex items-center gap-2 md:gap-3'
          }
        >
          {!hideLabel && (
            // Compact, the name alone is what is centred in the row: the
            // points hang under it (once there are some) without taking a
            // line of their own, so the name sits level with the buttons
            // and nothing moves when the first point is counted.
            <div
              className={`min-w-0 ${isCompact ? 'relative' : ''} ${
                isStacked
                  ? 'col-span-3 md:flex-1'
                  : hasLiveAction
                    ? 'flex-none md:flex-1 [@container(max-width:15rem)]:basis-full'
                    : `flex-1 ${stackWhenNarrow ? 'max-[279px]:basis-full' : ''}`
              }`}
            >
              <div
                className={`${labelClassName ?? `font-semibold ${labelSize}`} ${labelTone}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {icon}
                  {label}
                  {info && (
                    <button
                      type="button"
                      aria-label={`About ${a11yName}`}
                      aria-expanded={showInfo}
                      aria-controls={showInfo ? infoId : undefined}
                      onClick={() => setShowInfo(v => !v)}
                      className={`${INFO_BUTTON_CLASS} ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-team-blue'
                          : 'text-gray-500 hover:text-team-blue'
                      }`}
                    >
                      <Info size={14} />
                    </button>
                  )}
                </span>
              </div>
              {opponentPoints !== undefined && (
                <div
                  id={opponentId}
                  className={`text-xs leading-4 font-semibold tabular-nums ${
                    opponentPoints > 0 ? foulTone : mutedTone
                  }`}
                >
                  +{opponentPoints} to opponent
                </div>
              )}
              {(pointsUnderLabel || pointsUnderOnNarrow) &&
                points !== undefined && (
                  <div
                    className={`text-xs leading-4 font-semibold tabular-nums ${
                      isCompact
                        ? `absolute left-0 top-full whitespace-nowrap ${hasLiveAction ? '[@container(max-width:15rem)]:static' : 'max-[279px]:static'}`
                        : ''
                    } ${
                      pointsUnderOnNarrow ? 'min-[360px]:hidden' : 'md:hidden'
                    } ${pointsTone}`}
                  >
                    {formatPoints(points)}
                  </div>
                )}
            </div>
          )}

          {stepper && (
            <button
              type="button"
              aria-label={`Decrease ${a11yName}`}
              aria-describedby={describedBy}
              aria-disabled={blocked || undefined}
              disabled={disabled || value <= 0}
              onClick={() => press(-1)}
              className={stepBtnClass(value <= 0)}
            >
              <Minus size={stepIconSize} />
            </button>
          )}

          {readout ? (
            // Not an input and not focusable: a thumb that lands here does
            // nothing, where the text box would open the keyboard with the
            // count selected. The key replays the flash on every change. All
            // three classes carry `motion-safe:`: `animate-in` resets the
            // scale and duration, so a plain `zoom-in-150` would come before
            // it in the stylesheet and be wiped out.
            <div
              key={liveChanges}
              data-live-count
              className={`flex shrink-0 select-none items-center justify-center text-2xl font-bold tabular-nums ${countBox} ${
                isDarkMode ? 'text-white' : 'text-black'
              } ${
                liveChanges > 0
                  ? 'motion-safe:animate-in motion-safe:zoom-in-150 motion-safe:duration-200'
                  : ''
              }`}
            >
              <span className="sr-only">{a11yName}: </span>
              {value}
            </div>
          ) : (
            // Focused, as an Input is: the accent border inside a solid ring
            // of it, red while the entry is rejected. The outline at rest is
            // about as dark as the accent in light, and is the accent in
            // honeycomb, so a border change alone hardly showed. Only the
            // box itself takes it: a press on − or + doesn't focus it.
            renderInput(
              `text-center font-bold rounded-lg border-2 transition-colors tabular-nums ${countBox} ${countText} ${
                disabled
                  ? lockedTone
                  : `${
                      invalid
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : `${FIELD_BORDER} focus:border-team-blue focus-visible:ring-team-blue`
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ${
                      isDarkMode
                        ? 'bg-team-dark text-white'
                        : 'bg-white text-black'
                    }`
              }`
            )
          )}

          {stepper &&
            (hasLiveAction ? (
              <button
                type="button"
                aria-describedby={describedBy}
                aria-keyshortcuts={isLive ? liveShortcut : undefined}
                aria-disabled={blocked || undefined}
                disabled={disabled || value >= max}
                onClick={() => press(1)}
                className={liveBtnClass(value >= max)}
              >
                {/* Locked, the one target everyone tries first says so
                    itself: the reason is read out from its description */}
                {disabled && (
                  <Lock size={16} aria-hidden className="shrink-0" />
                )}
                {liveActionLabel}
                {isLive && liveShortcut && (
                  <kbd
                    aria-hidden
                    // Faded only where that still reads: white on the
                    // light theme's filled button is under 4.5:1 faded
                    className={`hidden rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 md:inline-block [@media(pointer:coarse)]:hidden ${isDarkMode ? 'opacity-70' : ''}`}
                  >
                    {liveShortcut}
                  </kbd>
                )}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Increase ${a11yName}`}
                aria-describedby={describedBy}
                aria-disabled={blocked || undefined}
                disabled={disabled || value >= max}
                onClick={() => press(1)}
                className={stepBtnClass(value >= max)}
              >
                <Plus size={stepIconSize} />
              </button>
            ))}

          {points !== undefined ? (
            <div
              className={`text-right tabular-nums shrink-0 text-sm font-semibold ${pointsWidth} ${
                pointsUnderLabel
                  ? 'hidden md:block'
                  : pointsUnderOnNarrow
                    ? 'hidden min-[360px]:block'
                    : ''
              } ${pointsTone}`}
            >
              {formatPoints(points)}
            </div>
          ) : (
            opponentPoints !== undefined && (
              // Holds the points column open so the steppers line up with
              // the scoring fields above and below.
              <div
                aria-hidden
                className={`shrink-0 ${pointsWidth} ${pointsUnderLabel ? 'hidden md:block' : ''}`}
              />
            )
          )}
        </div>

        {showLockedReason && (
          <p
            id={reasonId}
            className={`flex items-center gap-1.5 text-xs text-balance ${mutedTone}`}
          >
            <Lock size={12} aria-hidden className="shrink-0" />
            {lockedReason}
          </p>
        )}
        {hint && (
          <p id={hintId} className={`text-xs ${mutedTone}`}>
            {hint}
          </p>
        )}
        {info && showInfo && (
          <p
            id={infoId}
            className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {info}
          </p>
        )}
      </div>
    );
  }
);

ScoreField.displayName = 'ScoreField';
