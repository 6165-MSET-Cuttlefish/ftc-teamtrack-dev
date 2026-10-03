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

/** The theme's accent, which every theme sets to hold on its own cards. */
const ACCENT = 'rgb(var(--team-blue))';

/** Colours of the chart marks that are not one scoring element. */
export const CHART_COLORS = {
  /** A match or session score: the accent, and the heaviest mark drawn */
  total: { dark: ACCENT, light: ACCENT },
  /** A reference line, such as the session average */
  average: { dark: '#94a3b8', light: '#64748b' },
  movingAverage: { dark: '#10b981', light: '#059669' },
  /** Time between Hive Tips */
  cycle: { dark: '#8b5cf6', light: '#7c3aed' },
  /** The better and the worse of a pair, such as fastest and slowest */
  better: { dark: '#10b981', light: '#059669' },
  worse: { dark: '#ef4444', light: '#dc2626' },
} satisfies Record<string, Tone>;

/** The ranking points a match earns from its own scoring. */
export const RANKING_POINT_COLORS = {
  swarm: { dark: '#10b981', light: '#059669' },
  pollinator1: { dark: '#f59e0b', light: '#d97706' },
  pollinator2: { dark: '#8b5cf6', light: '#7c3aed' },
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
