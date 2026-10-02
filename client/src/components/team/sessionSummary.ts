import { calculateTotal, formatDate } from '@/lib';
import type { Session } from '@/types';

/**
 * One line that tells a session apart from others with the same name in the
 * import lists: when it was recorded (with the time — two sessions from the
 * same day are common), how many matches it has, and its average score.
 */
export const sessionSummary = (session: Session): string => {
  const matches = (
    Array.isArray(session.matches) ? session.matches : []
  ).filter(match => match && typeof match === 'object');
  const parts = [
    formatDate(session.createdAt),
    `${matches.length} match${matches.length !== 1 ? 'es' : ''}`,
  ];
  if (matches.length > 0) {
    const total = matches.reduce(
      (sum, match) => sum + calculateTotal(match),
      0
    );
    parts.push(`avg ${Math.round(total / matches.length)} pts`);
  }
  return parts.join(' · ');
};
