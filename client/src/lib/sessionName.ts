import type { SessionType } from '@/types';
import { readGuestSessions } from './guestSessions';

/** Name every new session carried before names said what kind it is */
const LEGACY_DEFAULT_NAME = 'Default Session';

/** A default name: the session type and its number, "Practice 3" */
const NUMBERED_NAME = /^(Practice|Scrim) (\d{1,6})$/;

/**
 * The default names that carried the date instead ("Practice · Oct 1", and
 * "Practice - Oct 1"). Sessions saved or left open with them keep them;
 * they are still the app's names, not the user's.
 */
const DATED_NAME = /^(Practice|Scrim) (?:·|-) [A-Z][a-z]{2} \d{1,2}$/;

/**
 * The names of the signed-in user's own saved sessions, as last read from
 * the server, kept in this browser so a new session is numbered right
 * offline too: `{ owner: uid, names }`.
 */
const NAMES_KEY = 'teamtrack-session-names';

/** Fired in this tab when the names a new session is numbered past change */
export const SESSION_NAMES_CHANGED_EVENT = 'teamtrack-session-names-changed';

interface RememberedNames {
  owner: string;
  names: string[];
}

const readRemembered = (): RememberedNames | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '');
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as RememberedNames).owner === 'string' &&
      Array.isArray((value as RememberedNames).names)
    ) {
      return value as RememberedNames;
    }
  } catch {
    /* nothing remembered, or unreadable */
  }
  return null;
};

/**
 * Whose sessions a new one is numbered among: the signed-in user's id, or
 * null for a guest (this browser's sessions). Until the account is known on
 * a page load, the last account this browser remembered names for.
 */
let owner: string | null = readRemembered()?.owner ?? null;

/** Say whose sessions count, once the account is known. */
export const setSessionNamesOwner = (uid: string | null): void => {
  owner = uid;
};

/**
 * Remember the names of `uid`'s saved sessions: the whole list as read from
 * the server (`replace`), or one more just saved from here.
 */
export const rememberSessionNames = (
  uid: string,
  names: string[],
  { replace = true }: { replace?: boolean } = {}
): void => {
  const remembered = readRemembered();
  const kept = !replace && remembered?.owner === uid ? remembered.names : [];
  try {
    localStorage.setItem(
      NAMES_KEY,
      JSON.stringify({ owner: uid, names: [...new Set([...kept, ...names])] })
    );
  } catch {
    /* storage full or blocked: numbered from what is known in this tab */
  }
  window.dispatchEvent(new Event(SESSION_NAMES_CHANGED_EVENT));
};

/** Forget the remembered names, for when the account signs out. */
export const forgetSessionNames = (): void => {
  try {
    localStorage.removeItem(NAMES_KEY);
  } catch {
    /* storage unavailable */
  }
};

/** The owner's saved session names, as far as this browser knows them. */
export const takenSessionNames = (): string[] => {
  if (owner === null) {
    return readGuestSessions().map(session => session.sessionName ?? '');
  }
  const remembered = readRemembered();
  return remembered?.owner === owner ? remembered.names : [];
};

/** One past the highest "<type> N" in `names`: 1 when there is none. */
const nextSessionNumber = (type: SessionType, names: readonly string[]) =>
  names.reduce((highest, name) => {
    const match = NUMBERED_NAME.exec(name.trim());
    return match && match[1] === type
      ? Math.max(highest, Number(match[2]))
      : highest;
  }, 0) + 1;

/**
 * The name a new session starts out with: its type and the next number
 * among the owner's sessions of that type, "Practice 1", "Practice 2", ...
 * (the date is saved with the session and shown beside it). A number is
 * never given again while a session with it exists.
 */
export const defaultSessionName = (
  type: SessionType,
  names: readonly string[] = takenSessionNames()
): string => `${type} ${nextSessionNumber(type, names)}`;

/** True for a name the app gave the session, in any of its forms. */
export const isDefaultSessionName = (
  name: string | null | undefined
): boolean =>
  typeof name === 'string' &&
  (name === LEGACY_DEFAULT_NAME ||
    NUMBERED_NAME.test(name) ||
    DATED_NAME.test(name));

/**
 * A session of `type`, not started yet, whose name the app gave it but is
 * no longer the one it would give: an older form, or a number of its type
 * the saved sessions have reached since (it was named before they were
 * known, or one was saved under it meanwhile). Such a name is given afresh.
 * A higher number is left alone: only someone typing it gets there.
 */
export const isStaleDefaultName = (
  name: string | null | undefined,
  type: SessionType,
  names: readonly string[] = takenSessionNames()
): boolean => {
  if (!isDefaultSessionName(name)) return false;
  const numbered = NUMBERED_NAME.exec(name ?? '');
  return (
    !numbered ||
    (numbered[1] === type &&
      Number(numbered[2]) < nextSessionNumber(type, names))
  );
};

/**
 * The default name for a session whose type has just changed: the next
 * number of the new type. Null when the name is one the user typed, which
 * is theirs to keep.
 */
export const retypeDefaultSessionName = (
  name: string | null | undefined,
  type: SessionType,
  names: readonly string[] = takenSessionNames()
): string | null =>
  isDefaultSessionName(name) ? defaultSessionName(type, names) : null;
