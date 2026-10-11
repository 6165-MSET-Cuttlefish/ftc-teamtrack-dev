import { calculateTotal, formatDate } from '@/lib';
import type { Session } from '@/types';

/** The date and time a session was recorded: 'Sep 20, 2026, 3:00 PM' */
const RECORDED: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * The facts that tell a session apart from others with the same name in the
 * share-with-team lists: when it was recorded (with the time: two sessions
 * from the same day are common), how many matches it has, and its average
 * score. Shown as separate pieces, each kept whole on a line, so a wrapped
 * summary breaks only between them, never between 'avg' and '30 pts'.
 */
export const sessionSummary = (session: Session): string[] => {
  const matches = (
    Array.isArray(session.matches) ? session.matches : []
  ).filter(match => match && typeof match === 'object');
  const parts = [
    formatDate(session.createdAt, RECORDED),
    `${matches.length} match${matches.length !== 1 ? 'es' : ''}`,
  ];
  if (matches.length > 0) {
    const total = matches.reduce(
      (sum, match) => sum + calculateTotal(match),
      0
    );
    parts.push(`avg ${Math.round(total / matches.length)} pts`);
  }
  return parts;
};
