/**
 * What each BIOBUZZ scoring element is called and the colour it is drawn in.
 *
 * One name and one colour per element on every screen: a label or a chart
 * series takes both from here, never from a string or a hex of its own.
 * Point values live next door in `scoring.ts`.
 */

/**
 * The name of each scoring element, in the Competition Manual's words.
 * "Hive" never stands alone: tips happen at the HIVE, so the pieces left in
 * its upward CELL are always "Left in Hive".
 */
export const ELEMENT_LABELS = {
  tipping: 'Hive Tips',
  garden: 'Garden',
  flower: 'Flower',
  flowerBonus: 'Flower Bonus',
  hive: 'Left in Hive',
  leave: 'Leave',
  /** PARK at the end of AUTO, and at the end of the match */
  parkAuto: 'Park (Auto)',
  parkEnd: 'Park (End)',
  /** Both parks together */
  park: 'Park',
  /** Everything the robots earn by where they are: Leave and both parks */
  robots: 'Leave + Park',
  minor: 'Minor Penalty',
  major: 'Major Penalty',
  /** Points this alliance's fouls gave the opponent; never off its own score */
  penalties: 'Given to opponent',
} as const;

/**
 * Flower and Flower Bonus together, where the scoring page and its running
 * breakdown show the two as one group.
 */
export const FLOWERS_LABEL = 'Flowers';

/**
 * A chart colour: `dark` on the dark cards (default, Honeycomb, Deep Sea),
 * `light` where the same hue has to hold 3:1 against a white one.
 */
export interface Tone {
  dark: string;
  light: string;
}

export const toneOf = (tone: Tone, isDarkMode: boolean): string =>
  isDarkMode ? tone.dark : tone.light;

/**
 * The colour of each scoring element, the same on every chart. Each is at
 * least 3:1 against the card it is drawn on in all four themes, and stays
 * apart from the others for colour-blind readers. Leave + Park is slate:
 * green is Garden's.
 */
export const ELEMENT_COLORS = {
  tipping: { dark: '#f59e0b', light: '#d97706' }, // amber
  garden: { dark: '#10b981', light: '#059669' }, // emerald
  flower: { dark: '#a855f7', light: '#7e22ce' }, // purple
  flowerBonus: { dark: '#d8b4fe', light: '#b56cf8' }, // lighter purple
  hive: { dark: '#0ea5e9', light: '#0284c7' }, // sky
  robots: { dark: '#64748b', light: '#475569' }, // slate
  minor: { dark: '#fda4af', light: '#f43f5e' }, // rose
  major: { dark: '#dc2626', light: '#991b1b' }, // red
  penalties: { dark: '#dc2626', light: '#991b1b' }, // red, as Major
} satisfies Record<string, Tone>;

/**
 * The theme's text colour: near-white on the dark themes, near-black on
 * light. Never the accent, which is gold in Honeycomb (beside the Hive Tips
 * amber) and cyan in Deep Sea (beside the Left in Hive sky).
 */
const FOREGROUND = 'hsl(var(--foreground))';

/** Slate, for the marks that are a reference rather than a result. */
const NEUTRAL = { dark: '#94a3b8', light: '#64748b' };

/**
 * Colours of the chart marks that are not one scoring element. Green and red
 * mean better and worse and nothing else; a neutral mark is slate.
 */
export const CHART_COLORS = {
  /** A match or session score: the text colour, and the heaviest mark drawn */
  total: { dark: FOREGROUND, light: FOREGROUND },
  /** A reference line, such as the session average */
  average: NEUTRAL,
  /** A running average over the last few sessions: slate, drawn dashed */
  movingAverage: NEUTRAL,
  /** Time between Hive Tips */
  cycle: NEUTRAL,
  /** The better and the worse of a pair, such as fastest and slowest */
  better: { dark: '#10b981', light: '#059669' },
  worse: { dark: '#ef4444', light: '#dc2626' },
} satisfies Record<string, Tone>;

/**
 * The ranking points a match earns from its own scoring. SWARM is earned by
 * Leave and Park, so it is their slate; both POLLINATORs are earned by Hive
 * Tips, so they are two shades of its amber (each at least 3:1 on its card).
 */
export const RANKING_POINT_COLORS = {
  swarm: ELEMENT_COLORS.robots,
  pollinator1: { dark: '#fcd34d', light: '#d97706' }, // amber-300 / amber-600
  pollinator2: { dark: '#d97706', light: '#92400e' }, // amber-600 / amber-800
} satisfies Record<string, Tone>;

/**
 * Colours for series that are picked rather than fixed (the sessions or
 * matches being compared), in the order they are taken: blue, orange, teal,
 * violet, pink. No green or red: beside a comparison those mean best and
 * worst. Teal sits third because next to pink the two are hard to tell
 * apart for colour-blind readers.
 */
export const SERIES_COLORS = {
  dark: ['#3b82f6', '#ea580c', '#0d9488', '#8b5cf6', '#ec4899'],
  light: ['#2563eb', '#ea580c', '#0d9488', '#7c3aed', '#db2777'],
} as const;
