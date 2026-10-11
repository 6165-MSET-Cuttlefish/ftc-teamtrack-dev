import { useEffect, useId, useRef, type ReactNode } from 'react';

import { DESTRUCTIVE_CLASS } from '@/components/ui/tokens';
import { useTheme } from '@/contexts';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { actionClass } from './tones';
import { useArmed } from './useArmed';

interface ConfirmInlineProps {
  /** One short sentence naming what is acted on and what is lost */
  question: ReactNode;
  /** A second, quieter line under the question */
  detail?: ReactNode;
  /** The choice that changes nothing ("Keep editing") */
  keepLabel: string;
  /** The choice that goes ahead and throws something away */
  confirmLabel: string;
  onKeep: () => void;
  onConfirm: () => void;
  /**
   * Question on its own line with the two buttons sharing the next one, for
   * where the question has the full width of a phone to itself.
   */
  stacked?: boolean;
  /**
   * One row exactly as tall as its buttons, for a row of controls on a
   * full-size screen: the question never wraps the row (and so never moves
   * what is under it). It keeps to two lines at most, right beside its
   * buttons, and gives up width first when the row is short.
   */
  inline?: boolean;
  className?: string;
}

/** The answers' shape where a long label may wrap to a second line */
const BUTTON = 'min-h-12 px-4 py-1.5 rounded-2xl text-base leading-tight';

/**
 * The answers of a question asked in a row of match controls: the same
 * shape as every button of that row, both of them. Where that row is short
 * (a tablet held upright) they take smaller type, so the question still
 * reads in two lines beside them. (Spelled out in full for Tailwind to
 * find.)
 */
const INLINE_BUTTON =
  'h-12 px-4 rounded-2xl text-base whitespace-nowrap [@container(max-width:54rem)]:px-3 [@container(max-width:54rem)]:text-sm';

/** Solid red with white text: 4.8:1, the same in every theme */
const DESTRUCTIVE = `border-2 font-bold transition-colors flex items-center justify-center ${DESTRUCTIVE_CLASS}`;

/**
 * The way /active asks "are you sure?", for the few things that can't be
 * undone afterwards: a worded question in place of the button that was
 * pressed, with two text buttons. Going ahead is red, as it throws
 * something away; keeping is a plain outline, never filled.
 *
 * The safe choice goes at the right-hand end, where the button that asked
 * was, so a second press on the same spot lands on it or on the question,
 * never on the other button. It also comes first for the keyboard and takes
 * focus when the pressed button had it. The other button ignores presses
 * for a moment after the question appears, so a double tap can never
 * answer it.
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
  stacked = false,
  inline = false,
  className = '',
}: ConfirmInlineProps) => {
  const { isDarkMode } = useTheme();
  const questionId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const armed = useArmed();

  // The pressed button is gone, and keyboard focus with it: carry on from
  // the safe choice rather than from the top of the page. Focus anywhere
  // else (Notes, a count being typed) is left where it is.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      keepRef.current?.focus({ preventScroll: true });
    }
  }, []);

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
      className={`${shape} ${actionClass('neutral', isDarkMode)}`}
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
      className={`${shape} ${DESTRUCTIVE}`}
    >
      {confirmLabel}
    </button>
  );

  if (inline) {
    return (
      <div
        role="group"
        aria-labelledby={questionId}
        data-confirm-inline
        className={`flex items-center gap-2 ${className}`}
      >
        {questionText(
          'leading-tight line-clamp-2 text-right [@container(max-width:54rem)]:text-xs'
        )}
        {/* Safe choice first for the keyboard, and last on screen */}
        <div className="flex shrink-0 flex-row-reverse gap-2">
          {keepButton(INLINE_BUTTON)}
          {confirmButton(`${INLINE_BUTTON} shrink-0`)}
        </div>
      </div>
    );
  }

  // Stacked, the buttons split the row by the length of their labels, and a
  // long label may wrap; in a row they keep to one line each.
  const fit = stacked ? 'flex-auto text-center' : 'whitespace-nowrap';

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      data-confirm-inline
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 min-h-12 ${className}`}
    >
      {questionText(
        `leading-snug ${stacked ? 'basis-full' : 'flex-1 basis-40'}`
      )}
      {/* Safe choice first for the keyboard, wherever it is shown. */}
      <div
        className={`flex gap-2 flex-row-reverse ${
          stacked ? 'basis-full' : 'shrink-0 ml-auto'
        }`}
      >
        {keepButton(`${BUTTON} ${fit}`)}
        {confirmButton(`${BUTTON} ${fit}`)}
      </div>
    </div>
  );
};
