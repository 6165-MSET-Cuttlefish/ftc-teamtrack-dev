/**
 * The names of teams this browser has shown the user, by id. A session
 * stays filed under its team after its author leaves, and a team you have
 * left can't be read any more: this is how its name can still be shown
 * ("Filed under Hornets 23456").
 */

const KEY = 'teamtrack-team-names';
/** Enough for every team anyone is likely to pass through on one browser */
const MAX_TEAMS = 20;

const read = (): Array<[string, string]> => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) &&
            typeof entry[0] === 'string' &&
            typeof entry[1] === 'string'
        )
      : [];
  } catch {
    return [];
  }
};

/** Remember what team `id` is called (latest name, latest last). */
export const rememberTeamName = (id: string, name: string): void => {
  const others = read().filter(([known]) => known !== id);
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([...others, [id, name]].slice(-MAX_TEAMS))
    );
  } catch {
    /* storage unavailable: the team is called "a team" instead */
  }
};

/** What team `id` was called when last seen here, if it ever was. */
export const knownTeamName = (id: string): string | undefined =>
  read().find(([known]) => known === id)?.[1];
