import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

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
  /** The choice that changes nothing ("Keep session") */
  keepLabel: string;
  /** The choice that goes ahead ("Discard") */
  confirmLabel: string;
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
   * Scroll the question fully into view when it opens, clear of the pinned
   * header and the phone's bar: it can be taller than the button it
   * replaces, at the very end of the page. With `keepBelow` the safe choice
   * is first put back where the pressed button was, and the question grows
   * upwards from it.
   */
  reveal?: boolean;
  className?: string;
}

const BUTTON = 'min-h-11 px-4 py-1.5 rounded-xl text-sm leading-tight';

/** Solid red with white text: 4.8:1, the same in every theme */
const DESTRUCTIVE =
  'border-2 border-red-600 bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center justify-center';

/**
 * The one way /active asks "are you sure?": a worded question in place of
 * the button that was pressed, with two text buttons.
 *
 * The safe choice goes where the button that asked was (the right-hand end
 * unless `keepFirst` or `keepBelow` says otherwise), so a second press on the same spot
 * lands on it or on the question, never on the other button. It also comes
 * first for the keyboard and takes focus when the pressed button had it. The
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
  onKeep,
  onConfirm,
  tone = 'danger',
  stacked = false,
  keepFirst = false,
  keepBelow = false,
  keepMinWidth,
  aside,
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
  // the safe choice rather than from the top of the page.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      keepRef.current?.focus({ preventScroll: true });
    }
  }, []);

  // Stacked, the buttons split the row by the length of their labels, and a
  // long label may wrap; in a row they keep to one line each.
  const fit = stacked ? 'flex-auto text-center' : 'whitespace-nowrap';

  const questionText = (layout: string) => (
    <p
      id={questionId}
      className={`min-w-0 text-sm font-semibold leading-snug ${layout} ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
    >
      {question}
      {detail && (
        <span
          className={`block font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {detail}
        </span>
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
      className={`${shape} ${
        tone === 'save' ? actionClass('neutral', isDarkMode) : DESTRUCTIVE
      }`}
    >
      {confirmLabel}
    </button>
  );

  if (keepBelow) {
    return (
      <div
        ref={rootRef}
        role="group"
        aria-labelledby={questionId}
        data-confirm-inline
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 ${className}`}
      >
        {questionText('flex-1 basis-40')}
        {/* The safe choices come first for the keyboard, and last on screen. */}
        <div className="order-last basis-full flex items-center gap-2">
          {aside}
          {keepButton(
            `${aside ? 'shrink-0' : 'flex-1'} h-12 px-4 rounded-2xl text-base whitespace-nowrap`
          )}
        </div>
        {confirmButton(`${BUTTON} shrink-0 whitespace-nowrap`)}
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
        stacked ? 'basis-full' : keepFirst ? 'w-60' : 'flex-1 basis-40'
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
