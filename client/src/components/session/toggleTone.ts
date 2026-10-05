import { selectedClass } from '@/components/ui/tokens';
import { cn } from '@/lib/utils';

/**
 * The colours of a robot toggle (Leave, Park), on the phone and on the
 * desktop pad. Colours only: the caller gives both states the same 2px
 * border, size and shape, and shows a Check icon while it is on.
 */

/**
 * On: picked, not pressed, so a tint (SELECTED) rather than the solid
 * accent, and Start stays the one fill. On the dark themes the accent
 * border is bright and an off one is dim. On the light page the accent and
 * an off border are equally dark, so there an on toggle also gets a frame
 * twice as thick (an inset ring: nothing moves) and a deeper tint, which
 * still tell it apart from an off one in sunlight.
 */
export const toggleOnClass = (isDarkMode: boolean): string =>
  cn(
    selectedClass(isDarkMode),
    !isDarkMode && 'bg-team-blue/25 ring-2 ring-inset ring-team-blue'
  );

/** Off: an outline on the page colour */
export const toggleOffClass = (isDarkMode: boolean): string =>
  isDarkMode
    ? 'border-team-blue-40 bg-team-dark text-gray-300 hover:bg-team-white-10'
    : // gray-300 is under 3:1 on the light page
      'border-gray-500 bg-white text-gray-700 hover:bg-gray-100';
