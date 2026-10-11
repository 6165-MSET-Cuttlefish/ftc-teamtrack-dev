/**
 * Which of a session's matches its headline figures (the average score, the
 * typical swing, the best and the worst) are taken from.
 *
 * An Autonomous run can't score what a full game does, so a session that
 * mixes match types never averages them together: its headline figures are
 * about one type, the one it has the most matches of. On a tie that is Full
 * Game, then Autonomous, then Teleop, the order Charts and Compare offer
 * them in, so every page picks the same type for the same matches.
 */

/** The match types in the order they are offered, and win a tie */
const TYPE_ORDER = ['Full Game', 'Autonomous', 'Teleop'];

/**
 * The type a match was run as. One saved without its own has its session's
 * (unless that is 'Mixed', which no match ran as): Full Game otherwise.
 */
export const matchTypeOf = (
  match: { matchType?: string },
  fallback?: string
): string =>
  match.matchType ||
  (fallback && TYPE_ORDER.includes(fallback) ? fallback : 'Full Game');

/** Where a type sorts on a tie: the known ones first, in their order */
const typeRank = (type: string): number => {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
};

/** One match type of a session and how many matches it has */
export interface TypeCount {
  type: string;
  count: number;
}

/**
 * The match types a session ran, most matches first (a tie in TYPE_ORDER).
 * Empty for a session with no matches.
 */
export const typesByCount = (
  matches: ReadonlyArray<{ matchType?: string }>,
  fallback?: string
): TypeCount[] => {
  const counts = new Map<string, number>();
  for (const match of matches) {
    const type = matchTypeOf(match, fallback);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || typeRank(a.type) - typeRank(b.type));
};

/** The matches a session's headline figures are about */
export interface Headline<T> {
  /** Their type */
  type: string;
  /** Whether the session mixes types, so the figures leave some matches out */
  mixed: boolean;
  /** The session's matches of that type, in the session's order */
  matches: T[];
  /** The other types the session ran, most matches first */
  others: TypeCount[];
}

/**
 * The matches of the type a session's headline figures are about: all of
 * them when they share one type. `fallback` is the session's own type, for
 * matches saved without one.
 */
export const headlineMatches = <T extends { matchType?: string }>(
  matches: readonly T[],
  fallback?: string
): Headline<T> => {
  const [top, ...others] = typesByCount(matches, fallback);
  const type = top?.type ?? matchTypeOf({}, fallback);
  return {
    type,
    mixed: others.length > 0,
    matches: matches.filter(m => matchTypeOf(m, fallback) === type),
    others,
  };
};
