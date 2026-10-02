import { useState, useEffect, useId, useRef, memo } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
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
   * side by side. From `md` up it is the same single row as `row`.
   */
  layout?: 'row' | 'stacked';
  /** Rules reminder shown under the field and read out with the input */
  hint?: string;
  /**
   * Rules reminder behind an (i) icon beside the label. Shows on hover, and
   * toggles open on tap since phones have no hover.
   */
  info?: string;
  /** Show +/- buttons for quick tap adjustment without opening the keyboard */
  stepper?: boolean;
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
    name,
    resetKey,
  }: ScoreFieldProps) => {
    const { isDarkMode } = useTheme();
    const hintId = useId();
    const [showInfo, setShowInfo] = useState(false);
    /** Text typed but not yet committed; null when nothing is being edited */
    const [draft, setDraft] = useState<string | null>(null);
    const [invalid, setInvalid] = useState(false);
    const invalidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    /** Set while a commit has left focus in the field with its text selected */
    const reselectOnClick = useRef(false);

    // A draft belongs to the value and record it started from. When either
    // is replaced from outside (the match is saved or reset, the walkthrough
    // rolls back) or the field is locked, the draft is dropped rather than
    // committed into the wrong match by a later blur.
    const [draftBase, setDraftBase] = useState({ value, resetKey });
    if (draftBase.value !== value || draftBase.resetKey !== resetKey) {
      setDraftBase({ value, resetKey });
      setDraft(null);
    } else if (disabled && draft !== null) {
      setDraft(null);
    }

    const editing = draft !== null && !disabled;
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
    const stepBtnClass = (atLimit: boolean) =>
      `flex items-center justify-center rounded-lg border-2 shrink-0 transition-colors ${stepBtnSize} ${
        disabled || atLimit
          ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10 active:bg-team-white-10 cursor-pointer'
            : 'border-gray-300 bg-white text-black hover:bg-gray-100 active:bg-gray-100 cursor-pointer'
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

    return (
      <div ref={rootRef} className="space-y-1">
        <div
          className={
            isStacked
              ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 md:flex md:gap-3'
              : 'flex items-center gap-2 md:gap-3'
          }
        >
          <div
            className={`min-w-0 ${isStacked ? 'col-span-3 md:flex-1' : 'flex-1'}`}
          >
            <div
              className={`font-semibold ${
                isStacked
                  ? `text-sm leading-4 md:leading-7 ${isLarge ? 'md:text-xl' : 'md:text-lg'}`
                  : isLarge
                    ? 'text-xl'
                    : 'text-lg'
              } ${labelTone}`}
            >
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
                className={`text-xs leading-4 font-semibold tabular-nums ${
                  opponentPoints > 0 ? foulTone : mutedTone
                }`}
              >
                +{opponentPoints} to opponent
              </div>
            )}
            {isStacked && points !== undefined && (
              <div
                className={`text-xs leading-4 font-semibold tabular-nums md:hidden ${pointsTone}`}
              >
                {points} pts
              </div>
            )}
          </div>

          {stepper && (
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              disabled={disabled || value <= 0}
              onClick={() => step(-1)}
              className={stepBtnClass(value <= 0)}
            >
              <Minus size={stepIconSize} />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            name={name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            aria-label={label}
            aria-describedby={hint ? hintId : undefined}
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
                if (
                  reselectOnClick.current &&
                  document.activeElement === input
                ) {
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
            className={`text-center font-bold rounded-lg border-2 transition-colors tabular-nums ${
              isStacked
                ? 'h-11 w-full text-xl md:h-12 md:w-20'
                : isLarge
                  ? 'h-12 w-16 text-xl md:w-20'
                  : 'h-10 w-20 text-lg'
            } ${
              disabled
                ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
                : `${invalid ? 'border-red-500' : isDarkMode ? 'border-team-blue-40 focus:border-team-blue' : 'border-gray-300 focus:border-team-blue'} focus:outline-none ${
                    isDarkMode
                      ? 'bg-team-dark text-white'
                      : 'bg-white text-black'
                  }`
            }`}
          />

          {stepper && (
            <button
              type="button"
              aria-label={`Increase ${label}`}
              disabled={disabled || value >= max}
              onClick={() => step(1)}
              className={stepBtnClass(value >= max)}
            >
              <Plus size={stepIconSize} />
            </button>
          )}

          {points !== undefined ? (
            <div
              className={`text-right tabular-nums shrink-0 text-sm font-semibold ${pointsWidth} ${
                isStacked ? 'hidden md:block' : ''
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
                className={`shrink-0 ${pointsWidth} ${isStacked ? 'hidden md:block' : ''}`}
              />
            )
          )}
        </div>

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
