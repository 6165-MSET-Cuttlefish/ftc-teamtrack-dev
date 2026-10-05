import { useRef, useState, type ReactNode } from 'react';
import { TooltipPortal } from '@radix-ui/react-tooltip';
import { ChevronRight, Info } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Small controls grow to a thumb-sized target on touch screens. */
const TOUCH_TARGET =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

export interface StatTileProps {
  /** The eyebrow above the figure, e.g. 'Average Score' (upper-cased by CSS) */
  label: string;
  /**
   * The figure. `null` or `undefined` means there is nothing to show yet and
   * draws a muted em dash (with 'No data' for screen readers); 0 is a figure.
   */
  value: ReactNode;
  /** One line of context under the figure */
  caption?: ReactNode;
  /**
   * What the figure means, in a sentence. Adds an (i) in the corner that
   * opens it in a floating layer, so the tile row never changes height.
   */
  info?: ReactNode;
  /**
   * Makes the whole tile a button, e.g. to open the match it names. The
   * caption becomes the link text. Takes the place of `info`.
   */
  onClick?: () => void;
  /**
   * Colours the value only, never the tile: 'success' for a Best, 'danger'
   * for a Worst. Every other figure stays in the text colour.
   */
  tone?: 'default' | 'success' | 'danger';
  isDarkMode: boolean;
  /** Grid placement (a column span) or padding; merged with tailwind-merge */
  className?: string;
}

/**
 * One figure with its label above and a line of context below.
 *
 * Every tile has the same three rows, and inside a grid they are the grid's
 * own rows (subgrid), so the figures of neighbouring tiles line up even when
 * one label wraps. Put tiles straight into a `grid` (any column count); each
 * one spans three of its rows.
 *
 * The tile is a borderless tint, its value is in the text colour (the accent
 * is kept for things that can be pressed), and `tone` tints the value alone.
 * `info` opens in a layer above the page (a controlled Radix tooltip that
 * stays inside the viewport), so it never stretches the tiles beside it; a
 * tap on the (i) or outside the layer, or Escape, closes it.
 */
export const StatTile = ({
  label,
  value,
  caption,
  info,
  onClick,
  tone = 'default',
  isDarkMode,
  className,
}: StatTileProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  // The 500 shades are unreadable on the pale light-theme tint.
  const valueColor =
    tone === 'success'
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : tone === 'danger'
        ? isDarkMode
          ? 'text-red-400'
          : 'text-red-700'
        : 'text-foreground';

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const empty = value === null || value === undefined;
  const hasInfo = Boolean(info) && !onClick;
  const box = cn(
    'relative row-span-3 grid grid-rows-subgrid gap-y-0 content-start min-w-0 rounded-xl p-3 sm:p-5 text-left',
    isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5',
    className
  );

  // A button may only hold phrasing content, so its rows are spans.
  const Row = onClick ? 'span' : 'p';
  const labelRow = (
    // Room on the right for the (i), which sits in the corner
    <Row
      className={`block text-xs font-medium uppercase tracking-wide ${muted} ${hasInfo ? 'pr-6' : ''}`}
    >
      {label}
    </Row>
  );
  const valueRow = (
    <Row
      className={`block mt-1 text-2xl sm:text-3xl tabular-nums ${
        empty ? `font-normal ${muted}` : `font-bold ${valueColor}`
      }`}
    >
      {empty ? (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">No data</span>
        </>
      ) : (
        value
      )}
    </Row>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          box,
          'cursor-pointer transition-colors',
          isDarkMode ? 'hover:bg-team-blue/20' : 'hover:bg-team-blue/10'
        )}
      >
        {labelRow}
        {valueRow}
        <span className="mt-1 self-start justify-self-start inline-flex items-center gap-0.5 text-xs font-semibold text-foreground underline underline-offset-2">
          {caption}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <div className={box}>
      {labelRow}
      {valueRow}
      <div>
        {caption && <p className={`text-xs mt-1 ${muted}`}>{caption}</p>}
      </div>
      {hasInfo && (
        <TooltipProvider delayDuration={0} disableHoverableContent>
          {/* Opened and closed by the (i) alone: the trigger below is only
              the anchor the layer is placed against, so hover and focus do
              nothing. Radix closes it on Escape, on a press outside it and
              when the page scrolls. */}
          <Tooltip
            open={showInfo}
            onOpenChange={open => {
              if (!open) setShowInfo(false);
            }}
          >
            <button
              ref={infoButtonRef}
              type="button"
              aria-label={`About ${label}`}
              aria-expanded={showInfo}
              onClick={() => setShowInfo(v => !v)}
              // Tabbing on to another control closes it.
              onBlur={event => {
                if (event.relatedTarget) setShowInfo(false);
              }}
              className={`absolute top-0.5 right-0.5 sm:top-2.5 sm:right-2.5 inline-flex items-center justify-center rounded-full p-2 transition-colors ${TOUCH_TARGET} ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              } hover:text-team-blue aria-expanded:text-team-blue`}
            >
              <Info size={15} aria-hidden="true" />
              <TooltipTrigger asChild>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                />
              </TooltipTrigger>
            </button>
            <TooltipPortal>
              <TooltipContent
                side="bottom"
                collisionPadding={8}
                className="max-w-64 text-xs leading-relaxed"
                // The (i) is outside the layer: its own click toggles it.
                onPointerDownOutside={event => {
                  if (
                    infoButtonRef.current?.contains(event.target as Node | null)
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                {info}
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
          {/* Announced when it opens (the toggletip pattern) */}
          <span role="status" className="sr-only">
            {showInfo ? info : ''}
          </span>
        </TooltipProvider>
      )}
    </div>
  );
};
