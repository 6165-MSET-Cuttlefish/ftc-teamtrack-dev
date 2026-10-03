import { useState, useEffect, useId, useRef, memo } from 'react';
import { Info, Lock, Minus, Plus } from 'lucide-react';
import { useTheme } from '@/contexts';

interface ScoreFieldProps {
  label: string;
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
  max?: number;
  /** Render larger, for the scoring fields on the active-session page */
  size?: 'default' | 'large';
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
    value,
    onChange,
    points,
    opponentPoints,
    disabled = false,
    max = 999,
    size = 'default',
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
    /** Changes counted while live; each one replays the readout's flash */
    const [liveChanges, setLiveChanges] = useState(0);

    // A draft belongs to the value and record it started from. When either
    // is replaced from outside (the match is saved or reset, the walkthrough
    // rolls back) or the field is locked, the draft is dropped rather than
    // committed into the wrong match by a later blur.
    const [draftBase, setDraftBase] = useState({ value, resetKey });
    if (draftBase.value !== value || draftBase.resetKey !== resetKey) {
      if (isLive && draftBase.value !== value) setLiveChanges(n => n + 1);
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

    const step = (delta: number) => {
      const typedText = editing ? draft.trim() : '';
      const current = WHOLE_NUMBER.test(typedText)
        ? parseInt(typedText, 10)
        : value;
      const next = Math.min(max, Math.max(0, current + delta));
      setDraft(null);
      if (next !== value) onChange(next);
    };

    // 48px on a phone keeps the tap target over the 44px minimum while
    // leaving room for the label on a 360px-wide screen. A stacked field
    // gives up 4px of that so the pair still fits on a short phone.
    const stepBtnSize = isStacked
      ? 'w-11 h-11 md:w-12 md:h-12'
      : isLarge
        ? 'w-12 h-12'
        : 'w-10 h-10';
    const stepIconSize = isLarge || isStacked ? 20 : 16;
    const lockedTone =
      'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800';
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
      `flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border-2 text-lg font-bold whitespace-nowrap select-none touch-manipulation transition-[transform,filter] duration-75 md:w-40 md:flex-none ${
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

    const labelTone = disabled
      ? isDarkMode
        ? 'text-gray-600'
        : 'text-gray-500'
      : isDarkMode
        ? 'text-gray-200'
        : 'text-gray-800';
    const mutedTone = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    // red-400 is unreadable on the light background
    const foulTone = isDarkMode ? 'text-red-400' : 'text-red-700';

    const pointsTone = disabled
      ? isDarkMode
        ? 'text-gray-600'
        : 'text-gray-500'
      : points !== undefined && points < 0
        ? foulTone
        : 'text-team-blue';

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
    // the other moves nothing.
    const countBox = isStacked
      ? 'h-11 w-full md:h-12 md:w-20'
      : isCompact
        ? `${isLarge ? 'h-12' : 'h-10'} ${hasLiveAction ? 'w-11' : 'w-12'} md:w-20`
        : isLarge
          ? 'h-12 w-16 md:w-20'
          : 'h-10 w-20';
    const countText = isLarge || isStacked ? 'text-xl' : 'text-lg';

    const showLockedReason = disabled && lockedReason !== undefined;
    // Read out with the box and with the steppers, so a locked or maxed-out
    // button still says what it belongs to and why it won't move.
    const describedBy =
      [
        opponentPoints !== undefined ? opponentId : null,
        hint ? hintId : null,
        showLockedReason ? reasonId : null,
        disabled && lockedReasonId ? lockedReasonId : null,
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
        name={name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={text}
        disabled={disabled}
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
      // hover and a small press so the tap is felt. 44px wide and tall.
      const segBtnClass = (atLimit: boolean) =>
        `flex w-11 shrink-0 items-center justify-center touch-manipulation transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] ${
          disabled || atLimit
            ? isDarkMode
              ? 'cursor-not-allowed text-white/25'
              : 'cursor-not-allowed text-gray-400'
            : isDarkMode
              ? 'cursor-pointer text-white/85 hover:bg-white/[0.06] active:bg-team-blue/15'
              : 'cursor-pointer text-gray-700 hover:bg-gray-100 active:bg-team-blue/15'
        }`;

      return (
        <div ref={rootRef} className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span
              className={`inline-flex min-w-0 items-center gap-1 text-sm font-semibold leading-5 ${labelTone}`}
            >
              <span className="truncate">{label}</span>
              {info && (
                <button
                  type="button"
                  title={info}
                  aria-label={`About ${label}`}
                  aria-expanded={showInfo}
                  onClick={() => setShowInfo(v => !v)}
                  // 44px under a finger, without making the line taller
                  className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors [@media(pointer:coarse)]:-mx-3 [@media(pointer:coarse)]:-my-3 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
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
                {points} pts
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
          <div
            className={`flex h-11 items-stretch overflow-hidden rounded-xl border transition-colors ${
              disabled
                ? isDarkMode
                  ? 'border-white/10 bg-white/[0.02]'
                  : 'border-gray-300 bg-gray-100'
                : invalid
                  ? 'border-red-500'
                  : isDarkMode
                    ? 'border-team-blue-40 bg-black/30 focus-within:border-team-blue'
                    : 'border-gray-500 bg-white focus-within:border-team-blue'
            }`}
          >
            {stepper && (
              <button
                type="button"
                aria-label={`Decrease ${label}`}
                aria-describedby={describedBy}
                disabled={disabled || value <= 0}
                onClick={() => step(-1)}
                className={segBtnClass(value <= 0)}
              >
                <Minus size={18} />
              </button>
            )}
            {renderInput(
              `h-full w-full min-w-0 rounded-none bg-transparent text-center text-lg font-semibold tabular-nums focus:outline-none ${
                stepper ? 'border-x' : ''
              } ${
                isDarkMode
                  ? 'border-white/10 text-white'
                  : 'border-gray-300 text-gray-900'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                invalid ? 'text-red-500' : ''
              }`
            )}
            {stepper && (
              <button
                type="button"
                aria-label={`Increase ${label}`}
                aria-describedby={describedBy}
                disabled={disabled || value >= max}
                onClick={() => step(1)}
                className={segBtnClass(value >= max)}
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          {info && showInfo && (
            <p
              className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              {info}
            </p>
          )}
        </div>
      );
    }

    return (
      <div ref={rootRef} className="space-y-1">
        <div
          className={
            isStacked
              ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 md:flex md:gap-3'
              : isCompact
                ? `flex items-center gap-1.5 md:gap-3 ${hasLiveAction ? 'min-h-14' : ''}`
                : 'flex items-center gap-2 md:gap-3'
          }
        >
          <div
            className={`min-w-0 ${
              isStacked
                ? 'col-span-3 md:flex-1'
                : hasLiveAction
                  ? 'flex-none md:flex-1'
                  : 'flex-1'
            }`}
          >
            <div className={`font-semibold ${labelSize} ${labelTone}`}>
              <span className="inline-flex items-center gap-1.5">
                {label}
                {info && (
                  <button
                    type="button"
                    title={info}
                    aria-label={`About ${label}`}
                    aria-expanded={showInfo}
                    onClick={() => setShowInfo(v => !v)}
                    className={`inline-flex items-center justify-center rounded-full p-0.5 transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-team-blue'
                        : 'text-gray-500 hover:text-team-blue'
                    }`}
                  >
                    <Info size={16} />
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
                    pointsUnderOnNarrow ? 'min-[360px]:hidden' : 'md:hidden'
                  } ${pointsTone}`}
                >
                  {points} pts
                </div>
              )}
          </div>

          {stepper && (
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              aria-describedby={describedBy}
              disabled={disabled || value <= 0}
              onClick={() => step(-1)}
              className={stepBtnClass(value <= 0)}
            >
              <Minus size={stepIconSize} />
            </button>
          )}

          {isLive ? (
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
              <span className="sr-only">{label}: </span>
              {value}
            </div>
          ) : (
            renderInput(
              `text-center font-bold rounded-lg border-2 transition-colors tabular-nums ${countBox} ${countText} ${
                disabled
                  ? lockedTone
                  : `${invalid ? 'border-red-500' : isDarkMode ? 'border-team-blue-40 focus:border-team-blue' : 'border-gray-500 focus:border-team-blue'} focus:outline-none ${
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
                disabled={disabled || value >= max}
                onClick={() => step(1)}
                className={liveBtnClass(value >= max)}
              >
                {liveActionLabel}
                {isLive && liveShortcut && (
                  <kbd
                    aria-hidden
                    className="hidden rounded border border-current px-1.5 font-sans text-xs font-semibold leading-5 opacity-70 md:inline-block [@media(pointer:coarse)]:hidden"
                  >
                    {liveShortcut}
                  </kbd>
                )}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Increase ${label}`}
                aria-describedby={describedBy}
                disabled={disabled || value >= max}
                onClick={() => step(1)}
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
              {points} pts
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
            className={`flex items-center gap-1.5 text-xs ${mutedTone}`}
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
