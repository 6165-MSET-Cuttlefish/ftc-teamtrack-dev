/**
 * Drivers: who drove a match, and the names offered when picking one.
 *
 * A driver is a name saved on each match. The names offered are those seen
 * on matches this device has shown (the user's and their team's sessions)
 * and those typed on it, so a team's drivers come up for every member once
 * a session of theirs has been opened.
 */

import { STORAGE_KEYS } from '@/constants';
import type { Match, Session } from '@/types';

/** Long enough for any real name, short enough for a chip */
export const MAX_DRIVER_LENGTH = 40;

/** The driver of a match, or '' when none was given */
export const driverOf = (match: Pick<Match, 'driver'>): string =>
  match.driver?.trim() ?? '';

/** Every driver named in these matches, A to Z */
export const driversIn = (
  matches: Iterable<Pick<Match, 'driver'>>
): string[] => {
  const names = new Set<string>();
  for (const match of matches) {
    const name = driverOf(match);
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
};

/** Every driver named in these sessions' matches, A to Z */
export const driversInSessions = (sessions: readonly Session[]): string[] =>
  driversIn(sessions.flatMap(session => session.matches ?? []));

/**
 * The sessions cut down to one driver's matches, leaving out any with none
 * of theirs. With no driver picked ('') they are returned as they are.
 */
export const sessionsForDriver = (
  sessions: Session[],
  driver: string
): Session[] =>
  driver
    ? sessions
        .map(session => ({
          ...session,
          matches: session.matches.filter(m => driverOf(m) === driver),
        }))
        .filter(session => session.matches.length > 0)
    : sessions;

/** The names offered by the driver picker on this device */
export const rememberedDrivers = (): string[] => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.KNOWN_DRIVERS) ?? '[]'
    );
    return Array.isArray(stored)
      ? stored.filter((name): name is string => typeof name === 'string')
      : [];
  } catch {
    return [];
  }
};

/** Adds these names to the ones the picker offers on this device */
export const rememberDrivers = (names: readonly string[]): void => {
  const known = rememberedDrivers();
  const added = names
    .map(name => name.trim().slice(0, MAX_DRIVER_LENGTH))
    .filter(name => name && !known.includes(name));
  if (added.length === 0) return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.KNOWN_DRIVERS,
      JSON.stringify([...known, ...added].sort((a, b) => a.localeCompare(b)))
    );
  } catch {
    /* storage unavailable: the names still show where they were seen */
  }
};
