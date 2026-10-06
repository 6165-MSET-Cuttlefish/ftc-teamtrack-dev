import { Info, Lock, LockOpen } from 'lucide-react';
import { useTheme } from '@/contexts';
import { formatPoints } from '@/lib/points';

/**
 * The pieces the end-of-match counters are built from on the scoring page,
 * shared by the desktop ScoringPad and the phone's MatchEntry: the name over
 * each counter with its rule behind an (i), the line that says what one is
 * worth, and the flower picture that tells Flower from Flower Bonus.
 */

/**
 * The one tone of a locked control's text, in every theme: muted, but over
 * 3:1 on each theme's page and on `LOCKED_SURFACE`.
 */
export const LOCKED_TEXT = 'text-gray-500';

/**
 * The one look of a control that can't be used yet (or at its limit, as -
 * at 0), on the phone and the desktop pad alike: no outline, a faint fill
 * and the muted LOCKED_TEXT (the three dark themes all put `.dark` on the
 * page). Only usable controls are outlined, so a locked screen reads as a
 * few quiet blocks rather than a wall of grey frames. The border is kept,
 * transparent, so locking and unlocking moves nothing.
 */
export const LOCKED_SURFACE =
  'border-transparent text-gray-500 bg-gray-100 dark:bg-white/[0.05]';

/**
 * The note over the end-of-match counters: why they are locked or, once
 * open, what to do. One filled band in every state, so it reads at a glance
 * during play and doesn't change shape as it opens; the lock on it opens
 * with the counters. It wraps rather than cut off (a 200% zoom), and `reserve` takes
 * the notes of its other states, laid invisibly in the same place, so it is
 * as tall as the tallest of them and the counters under it never move.
 * Its `id` is what the locked steppers point at for their reason.
 */
export const EndNote = ({
  id,
  locked,
  reserve = [],
  children,
}: {
  id?: string;
  locked: boolean;
  reserve?: React.ReactNode[];
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  const Icon = locked ? Lock : LockOpen;
  const tone = isDarkMode
    ? 'bg-white/[0.06] text-gray-200'
    : 'bg-gray-100 text-gray-800';
  const line = (text: React.ReactNode, hidden: boolean, key?: number) => (
    <span
      key={key}
      aria-hidden={hidden || undefined}
      className={`col-start-1 row-start-1 flex min-w-0 items-center gap-2 ${
        hidden ? 'invisible' : ''
      }`}
    >
      <Icon size={14} aria-hidden className="shrink-0" />
      <span className="min-w-0 text-balance">{text}</span>
    </span>
  );
  return (
    <p
      id={id}
      className={`grid min-h-8 min-w-0 items-center rounded-lg px-3 py-1.5 text-sm font-medium leading-5 ${tone}`}
    >
      {line(children, false)}
      {reserve.map((text, i) => line(text, true, i))}
    </p>
  );
};

/**
 * Points beside a counter: data, in the text colour, never the accent.
 * Only shown once there are some (see `CountLine`).
 */
const pointsTone = (isDarkMode: boolean): string =>
  isDarkMode ? 'text-gray-100' : 'text-gray-900';

/**
 * The (i) beside a counter's name: a 24px target for a mouse and 44px under
 * a finger. The button itself is only as big as its 14px icon (min-h-0 and
 * min-w-0 undo the phone-wide 44px minimum for buttons), so the line keeps
 * its height and nothing that measures the button's box (the walkthrough's
 * spotlight) finds it bigger than what it shows; the target is an empty
 * ::after round it, as on the PAUSED pill.
 */
export const INFO_BUTTON_CLASS =
  "relative inline-flex min-h-0 min-w-0 shrink-0 items-center justify-center rounded-full transition-colors after:absolute after:-inset-[5px] after:content-[''] [@media(pointer:coarse)]:after:-inset-[15px]";

/**
 * A FLOWER drawn as its stack of slots, with your NECTAR lit in the one that
 * matters: on top (you own the flower, so every piece in it scores) or at
 * the bottom (the bonus). The other slots on top are filled in, since those
 * pieces count too; for the bonus they don't matter, so they are outlines.
 * As tall as the text line it starts (20px), so it never makes its counter
 * taller than its words.
 */
export const FlowerSlots = ({
  nectar,
  dim = false,
}: {
  nectar: 'top' | 'bottom';
  /** Drawn faded */
  dim?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  const line = isDarkMode ? 'stroke-gray-400' : 'stroke-gray-500';
  const piece = isDarkMode ? 'fill-gray-400' : 'fill-gray-500';
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
      width={11}
      height={20}
      className={`shrink-0 transition-opacity ${dim ? 'opacity-40' : ''}`}
    >
      {/* Drawn at 0.77x: 1.6 here is a 1.2px frame on screen */}
      <rect
        x={0.8}
        y={0.8}
        width={12.4}
        height={24.4}
        rx={6.2}
        fill="none"
        strokeWidth={1.6}
        className={line}
      />
      {slots.map((cy, i) =>
        i === lit ? (
          <circle key={cy} cx={7} cy={cy} r={4} className="fill-team-blue" />
        ) : nectar === 'top' ? (
          <circle key={cy} cx={7} cy={cy} r={3.25} className={piece} />
        ) : (
          // 1.3 here is a 1px outline on screen
          <circle
            key={cy}
            cx={7}
            cy={cy}
            r={3}
            fill="none"
            strokeWidth={1.3}
            className={line}
          />
        )
      )}
    </svg>
  );
};

/**
 * The name over one end-of-match counter (with the flower picture before it
 * on the two flower counters), and the rule behind its (i). The one label
 * above a counter that is not muted, and never dimmed while the counters are
 * locked: the steppers show that. A long name wraps rather than cut off, with
 * the (i) after its last word. Not a heading element: the buzzer's scroll and
 * the walkthrough look for the section's first `h3`.
 */
export const CounterHead = ({
  id,
  title,
  icon,
  points,
  info,
  infoId,
  infoOpen = false,
  onInfo,
}: {
  /** Id of the title, for the group's `aria-labelledby` */
  id: string;
  title: string;
  icon?: React.ReactNode;
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
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <span className="flex min-w-0 items-start gap-1.5">
        {icon}
        <span
          className={`min-w-0 text-balance text-sm font-semibold leading-5 ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
          <span id={id}>{title}</span>
          {info && onInfo && (
            <button
              type="button"
              aria-label={`About ${title}`}
              aria-expanded={infoOpen}
              aria-controls={infoOpen ? infoId : undefined}
              onClick={onInfo}
              className={`${INFO_BUTTON_CLASS} ml-1 align-[-2px] ${
                isDarkMode
                  ? 'text-gray-400 hover:text-team-blue'
                  : 'text-gray-500 hover:text-team-blue'
              }`}
            >
              <Info size={14} />
            </button>
          )}
        </span>
      </span>
      {points !== undefined && (
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            points !== 0 ? pointsTone(isDarkMode) : 'invisible'
          }`}
        >
          {formatPoints(points)}
        </span>
      )}
    </div>
  );
};

/**
 * What one of a counter is worth, with the points it holds so far (and, in
 * the Add/Edit Match dialog, what to count above it, with the flower picture
 * before it where there is one). The points only show once there are some;
 * their place is kept, so nothing moves when the first one is counted. Its
 * `id` goes in the counter's `describedBy`, so the input and its steppers
 * read it out. In a grid row it fills the row's height, and with
 * `footAligned` the worth line sits at its foot, level with its neighbours'
 * and just over the stepper.
 */
export const CountLine = ({
  id,
  label,
  each,
  points,
  icon,
  footAligned = true,
  pointsClassName = '',
}: {
  id: string;
  /** What to count; left out where the counter's name over it says it */
  label?: string;
  each: string;
  points: number;
  icon?: React.ReactNode;
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
    <div id={id} className="flex h-full min-w-0 flex-col">
      {label && (
        // Readable while locked too: it is what to look for on the field
        <p
          className={`flex min-w-0 items-start gap-1.5 text-balance text-sm font-medium leading-5 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          {icon}
          <span className="min-w-0">{label}</span>
        </p>
      )}
      <p
        className={`flex min-w-0 items-baseline justify-between gap-x-2 whitespace-nowrap text-xs leading-4 ${
          footAligned ? 'mt-auto' : ''
        }`}
      >
        <span className={`truncate ${muted}`}>{each}</span>
        <span
          className={`shrink-0 font-semibold tabular-nums ${
            points !== 0 ? pointsTone(isDarkMode) : 'invisible'
          } ${pointsClassName}`}
        >
          {formatPoints(points)}
        </span>
      </p>
    </div>
  );
};
