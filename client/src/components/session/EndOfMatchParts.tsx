import { Info } from 'lucide-react';
import { useTheme } from '@/contexts';
import { formatPoints } from '@/lib/points';

/**
 * The pieces the end-of-match counters are built from on the scoring page,
 * shared by the desktop ScoringPad, the phone's MatchEntry and the Add/Edit
 * Match dialog: the name over each counter, with its rule (and what one is
 * worth) behind an (i).
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
 * Points beside a counter: data, in the text colour, never the accent.
 * Only shown once there are some; their place is kept, so nothing moves
 * when the first one is counted.
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
 * The name over one end-of-match counter, its points beside it, and the
 * rule behind its (i). The one label above a counter, not muted, and never
 * dimmed while the counters are locked: the steppers show that. A long name
 * wraps rather than cut off, with the (i) after its last word. Not a heading element: the buzzer's scroll and
 * the walkthrough look for the section's first `h3`.
 */
export const CounterHead = ({
  id,
  title,
  points,
  pointsClassName = '',
  info,
  infoId,
  infoOpen = false,
  onInfo,
}: {
  /** Id of the title, for the group's `aria-labelledby` */
  id: string;
  title: string;
  points?: number;
  /**
   * Extra classes for the points, e.g. `md:hidden` where a wider layout
   * shows them in a column of their own instead.
   */
  pointsClassName?: string;
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
      {points !== undefined && (
        <span
          className={`shrink-0 text-sm font-semibold leading-5 tabular-nums ${
            points !== 0 ? pointsTone(isDarkMode) : 'invisible'
          } ${pointsClassName}`}
        >
          {formatPoints(points)}
        </span>
      )}
    </div>
  );
};
