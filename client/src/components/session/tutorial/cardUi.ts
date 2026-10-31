import { primaryClass } from '@/components/ui/tokens';

/*
 * The look the tutorial's cards share: the welcome card and the step card.
 */

/** Text colours on the card, as CSS variables its classes read */
export const cardVars = (isDarkMode: boolean): React.CSSProperties =>
  ({
    '--tt-text': isDarkMode ? '#ffffff' : '#111111',
    '--tt-sub': isDarkMode ? 'rgba(255,255,255,0.74)' : 'rgba(0,0,0,0.72)',
    // Secondary text. Solid enough to stay over 4.5:1 on the card in every
    // theme, which stacked opacity was not.
    '--tt-muted': isDarkMode ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.58)',
    '--tt-hover': isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    color: 'var(--tt-text)',
  }) as React.CSSProperties;

/**
 * The theme's own popover surface (navy in Deep Sea, near-black in
 * Honeycomb, white in light), with the theme's border.
 */
export const CARD_SURFACE = 'bg-popover border border-border';

export const cardShadow = (isDarkMode: boolean): string =>
  isDarkMode
    ? '0 24px 48px -12px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.35)'
    : '0 24px 48px -12px rgba(15,23,42,0.28), 0 2px 8px rgba(15,23,42,0.08)';

const BUTTON =
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm h-9 [@media(pointer:coarse)]:min-h-11 transition-colors';

/** The card's one filled button: Next, Done, Take the tour */
export const primaryButton = (isDarkMode: boolean): string =>
  `${BUTTON} border px-4 font-semibold ${primaryClass(isDarkMode)}`;

/** Back */
export const secondaryButton = `${BUTTON} border border-border px-4 font-medium hover:bg-[color:var(--tt-hover)]`;

/** Skip: a quiet way out */
export const quietButton = `${BUTTON} -ml-2 px-2 font-medium text-[color:var(--tt-muted)] hover:text-[color:var(--tt-text)]`;

/**
 * Skip beside the title, on a card too narrow for it beside Back and Next:
 * no taller than its line of text, so the title's row does not grow, with
 * an invisible tap area round it that is 44px tall for a finger.
 */
export const quietTextButton =
  "relative min-h-0 min-w-0 text-sm font-medium text-[color:var(--tt-muted)] hover:text-[color:var(--tt-text)] transition-colors after:absolute after:-inset-x-3 after:-inset-y-1 after:content-[''] [@media(pointer:coarse)]:after:inset-y-[calc((100%_-_2.75rem)/2)]";

/** Body text and secondary text */
export const BODY_TEXT = 'text-sm leading-relaxed text-[color:var(--tt-sub)]';
export const MUTED_TEXT = 'text-xs text-[color:var(--tt-muted)]';
