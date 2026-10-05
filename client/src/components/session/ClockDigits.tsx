import { cn } from '@/lib/utils';

// Righteous's digits are proportional: a '1' is half as wide as a '0', so
// '1:11' and '2:28' would come out at different widths and the clock would
// shuffle sideways as it ticks. Each character gets a cell of its own fixed
// width instead, just over the font's widest digit ('0', 0.64em) and its
// colon (0.28em). The cells set the spacing, so letter spacing is cleared
// in them: it would push every glyph off the centre of its cell. The font
// goes on the cells, since the global `*` rule gives every element Inter.
const CELL = 'inline-block text-center font-righteous tracking-normal';
const DIGIT_CELL = `${CELL} w-[0.66em]`;
const COLON_CELL = `${CELL} w-[0.32em]`;

/**
 * An already formatted clock reading ('2:30', or a bare '3' in the 3-2-1),
 * drawn so that neither its digits nor anything beside it move as the
 * seconds tick. Size and colour come from the wrapper (or `className`).
 *
 * Hidden from assistive tech: the wrapper keeps `role="timer"` and its
 * `aria-label`.
 */
export const ClockDigits = ({
  text,
  className,
}: {
  /** The reading as shown, e.g. formatTime(seconds) */
  text: string;
  className?: string;
}) => (
  <span aria-hidden="true" className={cn('inline-flex', className)}>
    {[...text].map((char, i) => (
      // Keyed by position: each cell stays put while its digit changes
      <span key={i} className={char === ':' ? COLON_CELL : DIGIT_CELL}>
        {char}
      </span>
    ))}
  </span>
);
