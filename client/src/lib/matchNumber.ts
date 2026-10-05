/**
 * The number the next match of a session is saved under: one past the
 * highest so far. A match keeps its number when an earlier one is deleted
 * (gaps are fine), so this is not the count of saved matches plus one.
 */
export const nextMatchNumber = (
  matches: ReadonlyArray<{ matchNumber?: number }> | undefined
): number =>
  (matches ?? []).reduce(
    (highest, match) =>
      typeof match.matchNumber === 'number' &&
      Number.isFinite(match.matchNumber)
        ? Math.max(highest, match.matchNumber)
        : highest,
    0
  ) + 1;
