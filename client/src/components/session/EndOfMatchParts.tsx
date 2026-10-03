import { Info } from 'lucide-react';
import { useTheme } from '@/contexts';

/**
 * The pieces the end-of-match counters are built from on the scoring page,
 * shared by the desktop ScoringPad and the phone's MatchEntry: a heading for
 * an element (or the Flowers group), the line that says what to count, and
 * the flower picture that tells Flower from Flower Bonus.
 */

/**
 * A FLOWER drawn as its stack of slots, with your NECTAR lit in the one that
 * matters: on top (you own the flower, so every piece in it scores) or at
 * the bottom (the bonus). The other slots on top are filled in, since those
 * pieces count too; for the bonus they don't matter, so they are outlines.
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
      width={17}
      height={32}
      className={`shrink-0 self-start transition-opacity ${dim ? 'opacity-40' : ''}`}
    >
      <rect
        x={0.75}
        y={0.75}
        width={12.5}
        height={24.5}
        rx={6.25}
        fill="none"
        strokeWidth={1.5}
        className={line}
      />
      {slots.map((cy, i) =>
        i === lit ? (
          <circle key={cy} cx={7} cy={cy} r={4} className="fill-team-blue" />
        ) : nectar === 'top' ? (
          <circle key={cy} cx={7} cy={cy} r={3.25} className={piece} />
        ) : (
          <circle
            key={cy}
            cx={7}
            cy={cy}
            r={3}
            fill="none"
            strokeWidth={1.25}
            strokeDasharray="2 1.5"
            className={line}
          />
        )
      )}
    </svg>
  );
};

/**
 * The name over one element's counter, or over the Flowers pair: its points
 * on the right, the full rule behind an (i). Not a heading element: the
 * buzzer's scroll and the walkthrough look for the section's first `h3`.
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
  /** The full rule; the (i) toggles it open, and it is its tooltip */
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
            dim
              ? 'text-gray-500'
              : isDarkMode
                ? 'text-gray-100'
                : 'text-gray-900'
          }`}
        >
          {title}
        </span>
        {info && onInfo && (
          <button
            type="button"
            title={info}
            aria-label={`About ${title}`}
            aria-expanded={infoOpen}
            aria-controls={infoOpen ? infoId : undefined}
            onClick={onInfo}
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
      {points !== undefined && (
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            dim ? 'text-gray-500' : 'text-team-blue'
          }`}
        >
          {points} pts
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
 */
export const CountLine = ({
  id,
  label,
  each,
  points,
  icon,
  dim = false,
  footAligned = true,
}: {
  id: string;
  label: string;
  each: string;
  points: number;
  icon?: React.ReactNode;
  dim?: boolean;
  footAligned?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  return (
    <div id={id} className="flex h-full min-w-0 gap-2">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Readable while locked too: it is what to look for on the field */}
        <p
          className={`text-sm font-medium leading-5 ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          {label}
        </p>
        <p
          className={`flex items-baseline justify-between gap-2 text-xs leading-4 ${
            footAligned ? 'mt-auto' : ''
          }`}
        >
          <span className={muted}>{each}</span>
          <span
            className={`shrink-0 font-semibold tabular-nums ${
              dim ? 'text-gray-500' : 'text-team-blue'
            }`}
          >
            {points} pts
          </span>
        </p>
      </div>
    </div>
  );
};
