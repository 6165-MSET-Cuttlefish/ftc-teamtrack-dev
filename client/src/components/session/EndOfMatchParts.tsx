import { Info } from 'lucide-react';
import { useTheme } from '@/contexts';
import { formatPoints } from '@/lib/points';

/**
 * The pieces the end-of-match counters are built from on the scoring page,
 * shared by the desktop ScoringPad and the phone's MatchEntry: a heading for
 * an element (or the Flowers group), the line that says what to count, and
 * the flower picture that tells Flower from Flower Bonus.
 */

/**
 * The one tone of a locked counter's name and points, in every theme: muted,
 * but over 3:1 on each theme's page. ScoreField uses it too, so locked
 * labels look the same whichever component draws them.
 */
export const LOCKED_TEXT = 'text-gray-500';

/**
 * Points beside a counter: data, in the text colour, never the accent.
 * Muted to the locked tone while the counter is locked.
 */
const pointsTone = (dim: boolean, isDarkMode: boolean): string =>
  dim ? LOCKED_TEXT : isDarkMode ? 'text-gray-100' : 'text-gray-900';

/**
 * The (i) beside a counter's name: a 24px target for a mouse and 44px under
 * a finger, both without making the line taller than its 14px icon.
 */
export const INFO_BUTTON_CLASS =
  '-m-[5px] inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full transition-colors [@media(pointer:coarse)]:-m-[15px] [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/**
 * A FLOWER drawn as its stack of slots, with your NECTAR lit in the one that
 * matters: on top (you own the flower, so every piece in it scores) or at
 * the bottom (the bonus). The other slots on top are filled in, since those
 * pieces count too; for the bonus they don't matter, so they are outlines:
 * solid ones, which still read as empty slots at 1x where dashes broke up.
 */
export const FlowerSlots = ({
  nectar,
  dim = false,
}: {
  nectar: 'top' | 'bottom';
  /** Drawn faded while the counter beside it is locked */
  dim?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  const line = isDarkMode ? 'stroke-gray-500' : 'stroke-gray-400';
  const piece = isDarkMode ? 'fill-gray-500' : 'fill-gray-400';
  const slots = [6.5, 13, 19.5];
  const lit = nectar === 'top' ? 0 : 2;
  return (
    <svg
      role="img"
      aria-label={
        nectar === 'top'
          ? 'A flower with your nectar on top'
          : 'A flower with your nectar at the bottom'
      }
      viewBox="0 0 14 26"
      width={20}
      height={37}
      className={`shrink-0 self-start transition-opacity ${dim ? 'opacity-40' : ''}`}
    >
      {/* Drawn at 1.42x: 1.3 here is the 1.85px frame it had before */}
      <rect
        x={0.65}
        y={0.65}
        width={12.7}
        height={24.7}
        rx={6.35}
        fill="none"
        strokeWidth={1.3}
        className={line}
      />
      {slots.map((cy, i) =>
        i === lit ? (
          <circle key={cy} cx={7} cy={cy} r={4} className="fill-team-blue" />
        ) : nectar === 'top' ? (
          <circle key={cy} cx={7} cy={cy} r={3.25} className={piece} />
        ) : (
          // 0.9 here is a 1.25px outline on screen
          <circle
            key={cy}
            cx={7}
            cy={cy}
            r={3}
            fill="none"
            strokeWidth={0.9}
            className={line}
          />
        )
      )}
    </svg>
  );
};

/**
 * The name over one element's counter, or over the Flowers pair: its points
 * on the right, the rule behind an (i). Not a heading element: the buzzer's
 * scroll and the walkthrough look for the section's first `h3`.
 */
export const CounterHead = ({
  id,
  title,
  points,
  info,
  infoId,
  infoOpen = false,
  onInfo,
  dim = false,
}: {
  /** Id of the title, for the group's `aria-labelledby` */
  id: string;
  title: string;
  points?: number;
  /**
   * The rule; the (i) toggles it open. The caller shows it, under its own
   * group, with `infoId` as its id.
   */
  info?: string;
  /** Id of the element the (i) opens */
  infoId?: string;
  infoOpen?: boolean;
  onInfo?: () => void;
  /** The counters under it are locked */
  dim?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-2 border-b pb-1 ${
        isDarkMode ? 'border-white/15' : 'border-gray-300'
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-1">
        <span
          id={id}
          className={`truncate text-sm font-semibold leading-5 ${
            dim ? LOCKED_TEXT : isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
          {title}
        </span>
        {info && onInfo && (
          <button
            type="button"
            aria-label={`About ${title}`}
            aria-expanded={infoOpen}
            aria-controls={infoOpen ? infoId : undefined}
            onClick={onInfo}
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
      {points !== undefined && (
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${pointsTone(
            dim,
            isDarkMode
          )}`}
        >
          {formatPoints(points)}
        </span>
      )}
    </div>
  );
};

/**
 * What to count for one counter and what one is worth, with the points it
 * holds now. Its `id` goes in the counter's `describedBy`, so the input and
 * its steppers read it out. In a grid row it fills the row's height, and
 * with `footAligned` the worth line sits at its foot, level with its
 * neighbours' and just over the stepper, however the labels above wrap.
 * The label wraps balanced, so a second line never holds one word alone.
 */
export const CountLine = ({
  id,
  label,
  each,
  points,
  icon,
  dim = false,
  footAligned = true,
  pointsClassName = '',
}: {
  id: string;
  label: string;
  each: string;
  points: number;
  icon?: React.ReactNode;
  dim?: boolean;
  footAligned?: boolean;
  /**
   * Extra classes for the points, e.g. `md:hidden` where a wider layout
   * shows them in a column of their own instead.
   */
  pointsClassName?: string;
}) => {
  const { isDarkMode } = useTheme();
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  return (
    <div id={id} className="flex h-full min-w-0 gap-2">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Readable while locked too: it is what to look for on the field */}
        <p
          className={`text-balance text-sm font-medium leading-5 ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          {label}
        </p>
        {/*
          Where the worth and the points don't fit on one line, the points
          go under it, still on the right: "5 pts, max 4" is never split.
        */}
        <p
          className={`flex flex-wrap items-baseline justify-between gap-x-2 text-xs leading-4 ${
            footAligned ? 'mt-auto' : ''
          }`}
        >
          <span className={muted}>{each}</span>
          <span
            className={`ml-auto shrink-0 font-semibold tabular-nums ${pointsTone(
              dim,
              isDarkMode
            )} ${pointsClassName}`}
          >
            {formatPoints(points)}
          </span>
        </p>
      </div>
    </div>
  );
};
