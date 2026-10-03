/**
 * Text colours for the tinted match controls.
 *
 * The control backgrounds are translucent tints, so one Tailwind shade can't
 * be readable in every theme. Each pair here ([light, dark]) is at least
 * 4.5:1 (WCAG AA) on its control in the light, dark, honeycomb and deep-sea
 * themes — re-check all four before changing a shade.
 */
const TONES = {
  green: ['text-green-800', 'text-green-400'],
  yellow: ['text-yellow-800', 'text-yellow-300'],
  orange: ['text-orange-800', 'text-orange-300'],
  red: ['text-red-700', 'text-red-400'],
  purple: ['text-purple-700', 'text-purple-300'],
  // team-blue itself is 4.2:1 on its own light tint, hence the darker shade
  blue: ['text-[#42606e]', 'text-team-blue'],
} as const;

export type Tone = keyof typeof TONES;

export const toneText = (tone: Tone, isDarkMode: boolean): string =>
  TONES[tone][isDarkMode ? 1 : 0];

/**
 * The three looks a button on /active can have.
 *
 * `primary` is the one filled button of the current state (Start Match,
 * Resume, Save Match): the accent as a solid fill, with black text on the
 * three dark themes' light accents and white on the light theme's slate.
 * At most one is on screen at a time, so the fill always means "this is the
 * next step". Everything else is an outline on the page background:
 * `neutral` for the ordinary choices, `dangerOutline` for the ones that
 * throw something away.
 *
 * The same promise as the tones above holds: text is at least 4.5:1 on its
 * control in the light, dark, honeycomb and deep-sea themes. Hovering moves
 * the fill away from its text (darker under white, lighter under black):
 * fading it would take white on slate under 4:1.
 */
const ACTIONS = {
  primary: [
    'border-team-blue bg-team-blue text-white hover:brightness-90',
    'border-team-blue bg-team-blue text-black hover:brightness-110',
  ],
  neutral: [
    'border-gray-500 bg-transparent text-gray-800 hover:bg-gray-100',
    'border-gray-500 bg-transparent text-gray-100 hover:bg-white/10',
  ],
  dangerOutline: [
    'border-red-600 bg-transparent text-red-700 hover:bg-red-50',
    'border-red-500/70 bg-transparent text-red-400 hover:bg-red-500/10',
  ],
} as const;

export type ActionKind = keyof typeof ACTIONS;

/** Shape shared by every action button; size and width are the caller's */
const ACTION_BASE =
  'border-2 font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';

export const actionClass = (kind: ActionKind, isDarkMode: boolean): string =>
  `${ACTION_BASE} ${ACTIONS[kind][isDarkMode ? 1 : 0]}`;
