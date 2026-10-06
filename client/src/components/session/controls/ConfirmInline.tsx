import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

import { DESTRUCTIVE_CLASS } from '@/components/ui/tokens';
import { useTheme } from '@/contexts';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { revealInView } from './scrollUnderHeader';
import { actionClass } from './tones';
import { useArmed } from './useArmed';

interface ConfirmInlineProps {
  /** One short sentence naming what is acted on and what is lost */
  question: ReactNode;
  /** A second, quieter line under the question */
  detail?: ReactNode;
  /** The choice that changes nothing ("Keep Session") */
  keepLabel: string;
  /** The choice that goes ahead ("Discard") */
  confirmLabel: string;
  /**
   * The go-ahead's name for assistive technology, containing its label,
   * where the label alone would name another control too (the X that asked
   * "Discard Match").
   */
  confirmAriaLabel?: string;
  onKeep: () => void;
  onConfirm: () => void;
  /**
   * `danger`: going ahead throws something away, so that button is red.
   * `save`: going ahead throws nothing away, it only moves the match on
   * sooner than usual (ends it early, or saves it as it is); the safe choice
   * is the filled one and going ahead is the quiet one.
   */
  tone?: 'danger' | 'save';
  /**
   * Question on its own line with the two buttons sharing the next one, for
   * where the question has the full width of a phone to itself.
   */
  stacked?: boolean;
  /**
   * The safe choice straight after the question instead of at the far
   * right: for a question whose button sat at the left end of its row. The
   * question is kept narrow, so the safe choice lands on that button's spot.
   */
  keepFirst?: boolean;
  /**
   * The safe choice on a row of its own under the question, across the
   * width a full-width button (or a row of them) had, and the go-ahead up
   * beside the question: off every spot the thumb already knows. For a
   * phone, where any point along such a button is "the same spot".
   */
  keepBelow?: boolean;
  /**
   * The safe choice is at least this wide, in px: the width of the button
   * it lands on, so that all of that button's spot is covered.
   */
  keepMinWidth?: number;
  /**
   * With `keepBelow`: a control that stays usable while the question is
   * open (Pause, in the phone's action bar). It keeps its place at the
   * start of the last row, and the safe choice sits beside it where the
   * pressed button was.
   */
  aside?: ReactNode;
  /**
   * The question and both answers in one row as tall as the buttons it
   * replaces, for the phone's bar while the match clock runs: there the bar
   * must not grow over the page (which may not scroll to make room). The
   * row shows `shortQuestion`, then the go-ahead, and ends with the safe
   * choice, over the button that asked (`keepMinWidth` covers all of it).
   * Where the row is short, the go-ahead's label takes two lines before
   * the question gets too narrow to read.
   */
  oneRow?: boolean;
  /**
   * With `oneRow`: the question as the row shows it, in at most two short
   * lines. It sits in a size container, so it can word itself by the width
   * it gets rather than take smaller type. The full `question` (and
   * `detail`) still name the group for assistive technology.
   */
  shortQuestion?: ReactNode;
  /**
   * One row exactly as tall as its buttons, for a row of controls on a
   * full-size screen: the question never wraps the row (and so never moves
   * what is under it). It keeps to two lines at most, right beside its
   * buttons, and gives up width first when the row is short.
   */
  inline?: boolean;
  /**
   * With `inline`: the safe choice takes the row's spare width, right
   * after the question, and the go-ahead ends the row. For a question
   * asked in place of a button as wide as the row (Save Match): where that
   * button was pressed, the safe choice is.
   */
  keepWide?: boolean;
  /**
   * The safe choice takes focus as the question opens, even though the
   * button that asked keeps it: for a question asked by a button that
   * stays on screen (the X), so the keyboard carries on from the question
   * and it is announced.
   */
  autoFocusKeep?: boolean;
  /**
   * Scroll the question fully into view when it opens, clear of the pinned
   * header and the phone's bar: it can be taller than the button it
   * replaces, at the very end of the page. With `keepBelow` the safe choice
   * is first put back where the pressed button was, and the question grows
   * upwards from it.
   */
  reveal?: boolean;
  className?: string;
}

/** The answers' shape where a long label may wrap to a second line */
const BUTTON = 'min-h-12 px-4 py-1.5 rounded-2xl text-base leading-tight';

/**
 * The answers of a question asked in a row of match controls: the same
 * shape as every button of that row (Pause, End early, Skip), both of them.
 */
const ROW_BUTTON = 'h-12 px-4 rounded-2xl text-base whitespace-nowrap';

/**
 * In a row of controls that is a size container (the full-size layout's):
 * where that row is short (a tablet held upright), the question and its
 * answers take smaller type, so the question still reads in two lines
 * beside End early's wide safe answer. (Spelled out in full for Tailwind
 * to find.)
 */
const INLINE_BUTTON = `${ROW_BUTTON} [@container(max-width:54rem)]:px-3 [@container(max-width:54rem)]:text-sm`;

/**
 * The answers in the phone bar's one row: as tall as the bar's buttons, in
 * smaller type, so both fit beside the question on a 320 px screen.
 */
const ONE_ROW_BUTTON = 'h-12 px-3 rounded-2xl text-sm leading-tight';

/** Solid red with white text: 4.8:1, the same in every theme */
const DESTRUCTIVE = `border-2 font-bold transition-colors flex items-center justify-center ${DESTRUCTIVE_CLASS}`;

/**
 * The one way /active asks "are you sure?": a worded question in place of
 * the button that was pressed, with two text buttons.
 *
 * The safe choice goes where the button that asked was (the right-hand end
 * unless `keepFirst` or `keepBelow` says otherwise), so a second press on the same spot
 * lands on it or on the question, never on the other button. It also comes
 * first for the keyboard and takes focus when the pressed button had it
 * (or, with `autoFocusKeep`, when that button is still there). The
 * other button ignores presses for a moment after the question appears, so
 * a double tap can never answer it.
 *
 * Escape is handled by whoever owns the question (it answers with the safe
 * choice).
 */
export const ConfirmInline = ({
  question,
  detail,
  keepLabel,
  confirmLabel,
  confirmAriaLabel,
  onKeep,
  onConfirm,
  tone = 'danger',
  stacked = false,
  keepFirst = false,
  keepBelow = false,
  keepMinWidth,
  aside,
  oneRow = false,
  shortQuestion,
  inline = false,
  keepWide = false,
  autoFocusKeep = false,
  reveal = false,
  className = '',
}: ConfirmInlineProps) => {
  const { isDarkMode } = useTheme();
  const questionId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const armed = useArmed();

  // As it opens; a question stays put once shown.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!reveal || !root) return;
    // It has just taken the pressed button's place, so its top is where
    // that button's was: scroll the safe choice up onto that spot.
    if (keepBelow && keepRef.current) {
      window.scrollBy({
        top:
          keepRef.current.getBoundingClientRect().top -
          root.getBoundingClientRect().top,
        behavior: 'instant',
      });
    }
    revealInView(root);
    // Only as it opens: turning the phone must not scroll it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // The pressed button is gone, and keyboard focus with it: carry on from
  // the safe choice rather than from the top of the page. Focus anywhere
  // else (Notes, a count being typed) is left where it is.
  useEffect(() => {
    const active = document.activeElement;
    if (autoFocusKeep || !active || active === document.body) {
      keepRef.current?.focus({ preventScroll: true });
    }
    // Only as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stacked, the buttons split the row by the length of their labels, and a
  // long label may wrap; in a row they keep to one line each.
  const fit = stacked ? 'flex-auto text-center' : 'whitespace-nowrap';

  // Balanced, so a wrapped question never leaves a word on its own line.
  const questionText = (layout: string) => (
    <p
      id={questionId}
      className={`min-w-0 text-sm font-semibold text-balance ${layout} ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
    >
      {question}
      {detail && (
        <>
          {inline && ' '}
          <span
            className={`${inline ? '' : 'block'} font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {detail}
          </span>
        </>
      )}
    </p>
  );
  const keepButton = (shape: string) => (
    <button
      ref={keepRef}
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={onKeep}
      style={keepMinWidth ? { minWidth: keepMinWidth } : undefined}
      className={`${shape} ${actionClass(tone === 'save' ? 'primary' : 'neutral', isDarkMode)}`}
    >
      {keepLabel}
    </button>
  );
  const confirmButton = (shape: string) => (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() => {
        if (armed) onConfirm();
      }}
      aria-label={confirmAriaLabel}
      className={`${shape} ${
        tone === 'save' ? actionClass('neutral', isDarkMode) : DESTRUCTIVE
      }`}
    >
      {confirmLabel}
    </button>
  );

  if (keepBelow) {
    // Two columns: the question and the go-ahead over what stays usable
    // (Pause) and the safe choice. The two answers share the second column,
    // so they are one width, one above the other, at every phone width;
    // without an aside the safe choice takes the whole last row.
    return (
      <div
        ref={rootRef}
        role="group"
        aria-labelledby={questionId}
        data-confirm-inline
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0 ${className}`}
      >
        {questionText('col-start-1 row-start-1 leading-snug')}
        {/* The safe choices come first for the keyboard, and last on screen. */}
        {aside && (
          <div className="col-start-1 row-start-2 flex min-w-0">{aside}</div>
        )}
        {keepButton(
          `row-start-2 ${aside ? 'col-start-2' : 'col-span-2'} ${ROW_BUTTON}`
        )}
        {confirmButton(`col-start-2 row-start-1 ${ROW_BUTTON}`)}
      </div>
    );
  }

  if (oneRow) {
    return (
      <div
        ref={rootRef}
        role="group"
        aria-labelledby={questionId}
        data-confirm-inline
        className={`flex items-center gap-2 min-w-0 ${className}`}
      >
        <p id={questionId} className="sr-only">
          {question}
          {detail && <> {detail}</>}
        </p>
        {/* Never narrower than a short word or two in the bar's type:
            past that, the go-ahead's label wraps instead (it can shrink,
            the safe choice can't). */}
        <div
          aria-hidden
          className="order-1 flex-1 min-w-[4.5rem] [container-type:inline-size]"
        >
          <p
            className={`text-sm font-semibold leading-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
          >
            {shortQuestion ?? question}
          </p>
        </div>
        {/* The safe choice first for the keyboard, and last on screen. */}
        {keepButton(`order-3 shrink-0 whitespace-nowrap ${ONE_ROW_BUTTON}`)}
        {confirmButton(`order-2 text-center ${ONE_ROW_BUTTON}`)}
      </div>
    );
  }

  if (inline) {
    return (
      <div
        ref={rootRef}
        role="group"
        aria-labelledby={questionId}
        data-confirm-inline
        className={`flex items-center gap-2 ${className}`}
      >
        {/* Beside a wide safe choice, the question keeps to under half of
            the row, so the safe choice is under the middle of the button
            that asked */}
        {questionText(
          `leading-tight line-clamp-2 [@container(max-width:54rem)]:text-xs ${keepWide ? 'max-w-[40%]' : 'text-right'}`
        )}
        {/* Safe choice first for the keyboard, and on screen last, or
            first of the two when it is the wide one. */}
        <div
          className={`flex gap-2 ${keepWide ? 'flex-1' : 'shrink-0 flex-row-reverse'}`}
        >
          {keepButton(`${INLINE_BUTTON} ${keepWide ? 'flex-1' : ''}`)}
          {confirmButton(`${INLINE_BUTTON} shrink-0`)}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby={questionId}
      data-confirm-inline
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 min-h-12 ${className}`}
    >
      {questionText(
        `leading-snug ${stacked ? 'basis-full' : keepFirst ? 'w-60' : 'flex-1 basis-40'}`
      )}
      {/* Safe choice first for the keyboard, wherever it is shown. */}
      <div
        className={`flex gap-2 ${
          stacked
            ? 'basis-full flex-row-reverse'
            : keepFirst
              ? 'shrink-0'
              : 'shrink-0 ml-auto flex-row-reverse'
        }`}
      >
        {keepButton(`${BUTTON} ${fit}`)}
        {confirmButton(`${BUTTON} ${fit}`)}
      </div>
    </div>
  );
};
