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
