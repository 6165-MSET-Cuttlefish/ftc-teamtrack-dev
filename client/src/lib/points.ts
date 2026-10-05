/**
 * A score with its unit: "1 pt", "178 pts". The space is non-breaking, so
 * the number and its unit stay on one line wherever they land in a sentence.
 */
export const formatPoints = (points: number): string =>
  `${points}\u00A0${points === 1 ? 'pt' : 'pts'}`;
