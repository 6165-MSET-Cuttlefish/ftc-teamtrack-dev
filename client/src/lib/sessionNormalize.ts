/**
 * Stored sessions are not trusted to have the right shape.
 *
 * A session can come from Firestore (where any signed-in user's SDK can write
 * whatever the rules let through), from a guest's localStorage, or from a
 * shared snapshot. Everything that reads one runs it through
 * `normalizeSession`, so a single malformed document can't take a whole page
 * down for everyone who can see it.
 */

import type { Match, ScoreEvent, Session } from '@/types';
import { CURRENT_SEASON } from '@/constants';

/** Season recorded for sessions that predate the season tag. */
export const LEGACY_SEASON = 'decode';

const FALLBACK_SESSION_NAME = 'Untitled Session';

/** Whole-match counts — always finite and never negative. */
const COUNT_FIELDS = [
  'tipping',
  'garden',
  'flower',
  'flowerBonus',
  'ballsInHive',
  'minorPenalties',
  'majorPenalties',
] as const;

const FLAG_FIELDS = [
  'robot1Leave',
  'robot2Leave',
  'robot1ParkAuto',
  'robot1ParkTeleop',
  'robot2ParkAuto',
  'robot2ParkTeleop',
] as const;

/** Fields only a BIOBUZZ match carries. */
const CURRENT_MATCH_KEYS = ['tipping', 'garden'] as const;

/** Fields only a DECODE (2025-2026) match carries. */
const LEGACY_MATCH_KEYS = [
  'autonomousScore',
  'teleopScore',
  'endGameScore',
  'autonClassifiedArtifact',
  'autonOverflowArtifact',
  'autonMotif',
  'autonLeave',
  'autonBallsMissed',
  'teleClassifiedArtifact',
  'teleOverflowArtifact',
  'teleMotif',
  'teleBallsMissed',
  'robot1Park',
  'robot2Park',
  'gateBallCount',
  'motifPattern',
  'cycleTimes',
  'autonShots',
  'teleopShots',
  'gateEnabled',
] as const;

const OPTIONAL_TEXT_FIELDS = [
  'userEmail',
  'teamId',
  'matchType',
  'sessionDuration',
  'selectedFeature',
] as const;

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN;

const toCount = (value: unknown): number => {
  const n = toNumber(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === 'true';

/** Whether a value is something `toDate` can turn into a real date. */
const isTimestamp = (value: unknown): boolean => {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') return !Number.isNaN(Date.parse(value));
  if (!isObject(value)) return false;
  if (typeof value.toDate === 'function') return true;
  return Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds);
};

const toPhaseLog = (value: unknown): ScoreEvent[] => {
  if (!Array.isArray(value)) return [];
  const events: Raw[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    if (typeof entry.field !== 'string' || typeof entry.phase !== 'string') {
      continue;
    }
    const event: Raw = {
      ...entry,
      value: toCount(entry.value),
      timeRemaining: toCount(entry.timeRemaining),
    };
    const cycleTime = toNumber(entry.cycleTime);
    if (Number.isFinite(cycleTime) && cycleTime >= 0) {
      event.cycleTime = cycleTime;
    } else {
      delete event.cycleTime;
    }
    events.push(event);
  }
  return events as unknown as ScoreEvent[];
};

const hasAnyKey = (match: Raw, keys: readonly string[]): boolean =>
  keys.some(key => key in match);

/**
 * Whether a stored session belongs to the current season.
 *
 * The season tag decides. Sessions saved before the tag existed are
 * classified by shape, and only count as current when every match looks like
 * a BIOBUZZ match and none still carries a DECODE field — so editing one
 * match of an old session can't move the whole session into this season.
 */
export const isCurrentSeasonSession = (session: {
  season?: unknown;
  matches?: unknown;
}): boolean => {
  if (typeof session.season === 'string' && session.season) {
    return session.season === CURRENT_SEASON;
  }
  const matches = Array.isArray(session.matches)
    ? session.matches.filter(isObject)
    : [];
  return matches.every(
    match =>
      hasAnyKey(match, CURRENT_MATCH_KEYS) &&
      !hasAnyKey(match, LEGACY_MATCH_KEYS)
  );
};

/** The season a stored session belongs to, tagged or not. */
export const seasonOf = (session: {
  season?: unknown;
  matches?: unknown;
}): string => {
  if (typeof session.season === 'string' && session.season) {
    return session.season;
  }
  return isCurrentSeasonSession(session) ? CURRENT_SEASON : LEGACY_SEASON;
};

/**
 * Coerce one stored match into a `Match`, or `null` if it isn't an object.
 * Fields this file doesn't know about are passed through untouched.
 */
export const normalizeMatch = (raw: unknown, index = 0): Match | null => {
  if (!isObject(raw)) return null;
  const match: Raw = { ...raw };

  for (const key of COUNT_FIELDS) match[key] = toCount(raw[key]);
  for (const key of FLAG_FIELDS) match[key] = toFlag(raw[key]);
  match.phaseLog = toPhaseLog(raw.phaseLog);

  match.id =
    typeof raw.id === 'string' && raw.id
      ? raw.id
      : typeof raw.id === 'number'
        ? String(raw.id)
        : `match_${index + 1}`;
  match.matchNumber = toCount(raw.matchNumber) || index + 1;

  if ('matchType' in raw && typeof raw.matchType !== 'string') {
    delete match.matchType;
  }
  if ('finalScore' in raw) {
    const finalScore = toNumber(raw.finalScore);
    if (Number.isFinite(finalScore)) {
      match.finalScore = Math.max(0, finalScore);
    } else {
      delete match.finalScore;
    }
  }
  if ('createdAt' in raw && !isTimestamp(raw.createdAt)) {
    delete match.createdAt;
  }

  return match as unknown as Match;
};

/**
 * Coerce a stored session into a `Session`. Never throws, whatever it is
 * given. The result always carries a `season`: the stored tag, or the season
 * its stored shape says it belongs to.
 */
export const normalizeSession = (raw: unknown, id: string): Session => {
  const data: Raw = isObject(raw) ? raw : {};
  const session: Raw = { ...data };

  session.id = id;
  session.userId = typeof data.userId === 'string' ? data.userId : '';
  session.sessionName =
    typeof data.sessionName === 'string' && data.sessionName.trim()
      ? data.sessionName
      : typeof data.sessionName === 'number'
        ? String(data.sessionName)
        : FALLBACK_SESSION_NAME;
  session.notes = typeof data.notes === 'string' ? data.notes : '';
  // Decided from the stored shape, before the matches are filled in below.
  session.season = seasonOf(data);
  session.matches = Array.isArray(data.matches)
    ? data.matches
        .filter(isObject)
        .map((match, index) => normalizeMatch(match, index) as Match)
    : [];

  for (const key of OPTIONAL_TEXT_FIELDS) {
    if (key in data && (typeof data[key] !== 'string' || !data[key])) {
      delete session[key];
    }
  }
  if (data.sessionType !== 'Practice' && data.sessionType !== 'Scrim') {
    delete session.sessionType;
  }
  if (!isTimestamp(data.createdAt)) delete session.createdAt;

  return session as unknown as Session;
};
