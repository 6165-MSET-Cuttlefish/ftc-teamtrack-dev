/**
 * The few looks every screen shares, so the accent keeps one meaning.
 *
 * - PRIMARY: the accent as a solid fill. The one next step of a view, so at
 *   most one per view.
 * - SELECTED: the accent as a tint and a border, with strong text. Which of
 *   several choices is picked (Segmented, tab bars, scope, chips).
 * - DATA: numbers in the text colour of the theme. Titles, values and totals
 *   are never the accent; links and focus rings may be.
 * - CHIP: the phase chip's anatomy, for every status chip and badge.
 * - DESTRUCTIVE: the one red, for the button that throws something away.
 *
 * Colours only: size, shape and spacing are the caller's. The dark, honeycomb
 * and deep-sea themes are all `isDarkMode` (ThemeContext), and each one sets
 * its own accent behind `team-blue`. Every text colour here is at least 4.5:1
 * on its own background in the light, dark, honeycomb and deep-sea themes:
 * re-check all four before changing a shade.
 */

/**
 * The solid accent: black text on the three dark themes' light accents,
 * white on the light theme's slate. Hovering moves the fill away from its
 * text (darker under white, lighter under black).
 */
const PRIMARY = [
  'border-team-blue bg-team-blue text-white hover:brightness-90',
  'border-team-blue bg-team-blue text-black hover:brightness-110',
] as const;

export const primaryClass = (isDarkMode: boolean): string =>
  PRIMARY[isDarkMode ? 1 : 0];

/**
 * A picked choice: a tint of the accent, an accent border and strong text.
 * The caller gives every state the same border width (`border` with
 * `border-transparent` when not picked) so picking one moves nothing. On a
 * toggle (something pressed on and off by itself, like a robot chip), pair
 * it with a Check icon, so the colour is never the only cue.
 */
const SELECTED = [
  'border-team-blue bg-team-blue/15 text-gray-900',
  'border-team-blue bg-team-blue/15 text-white',
] as const;

export const selectedClass = (isDarkMode: boolean): string =>
  SELECTED[isDarkMode ? 1 : 0];

/** A number shown as data: the text colour, figures of equal width */
export const DATA_CLASS = 'text-foreground tabular-nums';

/**
 * A status chip (phase, PAUSED, EDITING, Best, owner, match type): a tinted
 * pill with an inset ring and bold capitals. Soft on purpose, so a chip
 * never looks like a button. The capitals are CSS: the words stay as typed.
 */
export const CHIP_BASE =
  'inline-flex items-center rounded-full font-bold uppercase tracking-wide leading-none whitespace-nowrap ring-1 ring-inset transition-colors';

export const CHIP_SIZES = {
  sm: 'px-2 py-0.5 text-[0.6875rem]',
  md: 'px-2.5 py-1 text-xs sm:text-sm',
} as const;

export type ChipSize = keyof typeof CHIP_SIZES;

/**
 * Tint, text and ring per meaning, [light theme, dark themes]. Neutral is
 * plain grey, amber is PAUSED's (and EDITING's), success and danger are
 * better / worse (Best, Worst) and nothing else.
 */
const CHIP_TONES = {
  neutral: [
    'bg-gray-100 text-gray-700 ring-gray-300',
    'bg-white/5 text-gray-300 ring-white/15',
  ],
  amber: [
    'bg-amber-100 text-amber-900 ring-amber-300',
    'bg-amber-400/15 text-amber-200 ring-amber-400/35',
  ],
  success: [
    'bg-green-100 text-green-800 ring-green-200',
    'bg-green-400/15 text-green-200 ring-green-400/30',
  ],
  danger: [
    'bg-red-100 text-red-800 ring-red-200',
    'bg-red-400/15 text-red-200 ring-red-400/30',
  ],
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export const chipTone = (tone: ChipTone, isDarkMode: boolean): string =>
  CHIP_TONES[tone][isDarkMode ? 1 : 0];

/**
 * The one red, the same in every theme: white on red-600 is 4.8:1. (White
 * on red-500 is 3.8:1, under AA for button text, so the dark themes keep
 * red-600 too.) The same red as /active's inline questions (ConfirmInline).
 */
export const DESTRUCTIVE_CLASS =
  'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700';
