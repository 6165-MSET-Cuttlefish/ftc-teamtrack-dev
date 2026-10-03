import type { SessionType } from '@/types';

/** Name every new session carried before names said what kind and when */
const LEGACY_DEFAULT_NAME = 'Default Session';

/** A default name: the session type, a middle dot, and a short date */
const DEFAULT_NAME = /^(Practice|Scrim) · ([A-Z][a-z]{2} \d{1,2})$/;

/**
 * The name a new session starts out with, e.g. "Practice · Oct 1": enough
 * to tell one session from the next in a list when nobody stops to name it.
 */
export const defaultSessionName = (
  type: SessionType,
  date: Date = new Date()
): string =>
  `${type} · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

/** True for a name the app gave the session, whatever its type or date. */
export const isDefaultSessionName = (
  name: string | null | undefined
): boolean =>
  typeof name === 'string' &&
  (name === LEGACY_DEFAULT_NAME || DEFAULT_NAME.test(name));

/**
 * The default name for a session whose type has just changed: the same
 * date, the new type. Null when the name is one the user typed, which is
 * theirs to keep.
 */
export const retypeDefaultSessionName = (
  name: string | null | undefined,
  type: SessionType
): string | null => {
  if (!isDefaultSessionName(name)) return null;
  const date = DEFAULT_NAME.exec(name ?? '')?.[2];
  return date ? `${type} · ${date}` : defaultSessionName(type);
};
