/**
 * Tournaments: which session types count fouls, a tournament match's details
 * as stored, its result, and links to FTC Scout for teams and events.
 */

import type {
  AllianceColor,
  Match,
  MatchScoringFields,
  SessionType,
  TournamentMatchInfo,
} from '@/types';

/** Every session type, in the order they are offered */
export const SESSION_TYPES: readonly SessionType[] = [
  'Practice',
  'Scrim',
  'Tournament',
];

export const isSessionType = (value: unknown): value is SessionType =>
  typeof value === 'string' &&
  (SESSION_TYPES as readonly string[]).includes(value);

/**
 * Fouls are counted against an opponent: in a Scrim, and at a Tournament.
 * A Practice has none.
 */
export const countsFouls = (type: string | undefined | null): boolean =>
  type === 'Scrim' || type === 'Tournament';

export const isTournament = (type: string | undefined | null): boolean =>
  type === 'Tournament';

/** Longest match label kept ("SF1-2" and the like are a few characters) */
export const MAX_MATCH_LABEL = 12;
/** FTC team numbers are 1 to 5 digits */
const TEAM_NUMBER = /^\d{1,5}$/;
/** Event codes are letters and digits, a dozen or so */
const EVENT_CODE = /^[A-Za-z0-9]{2,20}$/;
/** A posted score, kept within reason */
const MAX_POSTED_SCORE = 9999;

/** A team number as typed, or '' when it isn't one */
export const cleanTeamNumber = (raw: unknown): string => {
  const s = String(raw ?? '')
    .trim()
    .replace(/^#/, '');
  return TEAM_NUMBER.test(s) ? String(Number(s)) : '';
};

/** An event code as typed, upper-cased, or '' when it isn't one */
export const cleanEventCode = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  return EVENT_CODE.test(s) ? s.toUpperCase() : '';
};

const cleanScore = (raw: unknown): number | undefined => {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0
    ? Math.min(Math.round(n), MAX_POSTED_SCORE)
    : undefined;
};

/**
 * A stored tournament match's details, with anything malformed left out,
 * or undefined when nothing is left. Never carries `undefined` values.
 */
export const toTournamentInfo = (
  raw: unknown
): TournamentMatchInfo | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const info: TournamentMatchInfo = {};
  const label =
    typeof r.label === 'string' ? r.label.trim().slice(0, MAX_MATCH_LABEL) : '';
  if (label) info.label = label;
  if (r.alliance === 'red' || r.alliance === 'blue') info.alliance = r.alliance;
  const partner = cleanTeamNumber(r.partner);
  if (partner) info.partner = partner;
  const opponents = Array.isArray(r.opponents)
    ? r.opponents.map(cleanTeamNumber).filter(Boolean).slice(0, 2)
    : [];
  if (opponents.length) info.opponents = opponents;
  const ours = cleanScore(r.ourScore);
  if (ours !== undefined) info.ourScore = ours;
  const theirs = cleanScore(r.theirScore);
  if (theirs !== undefined) info.theirScore = theirs;
  return Object.keys(info).length ? info : undefined;
};

/** Win, loss or tie, once the opposing alliance's score is known */
export type MatchResult = 'W' | 'L' | 'T';

/**
 * A tournament match's result: its official score where one was posted,
 * otherwise the score scored here, against the opposing alliance's. Null
 * until the opposing score is in.
 */
export const matchResult = (
  info: TournamentMatchInfo | undefined,
  scored: number
): MatchResult | null => {
  if (!info || info.theirScore === undefined) return null;
  const ours = info.ourScore ?? scored;
  return ours > info.theirScore ? 'W' : ours < info.theirScore ? 'L' : 'T';
};

export interface TournamentRecord {
  wins: number;
  losses: number;
  ties: number;
  /** Matches with a result */
  played: number;
}

/** Wins, losses and ties over these matches, given how each scored */
export const tournamentRecord = (
  matches: ReadonlyArray<Pick<Match, 'tournament'>>,
  scoreOf: (index: number) => number
): TournamentRecord => {
  const record: TournamentRecord = { wins: 0, losses: 0, ties: 0, played: 0 };
  matches.forEach((m, i) => {
    const r = matchResult(m.tournament, scoreOf(i));
    if (!r) return;
    record.played += 1;
    if (r === 'W') record.wins += 1;
    else if (r === 'L') record.losses += 1;
    else record.ties += 1;
  });
  return record;
};

/** "3-1-0", wins-losses-ties, the way FTC writes a record */
export const formatRecord = (r: TournamentRecord): string =>
  `${r.wins}-${r.losses}-${r.ties}`;

export const RESULT_NAMES: Record<MatchResult, string> = {
  W: 'Win',
  L: 'Loss',
  T: 'Tie',
};

export const ALLIANCE_NAMES: Record<AllianceColor, string> = {
  red: 'Red',
  blue: 'Blue',
};

/** "Q12 · Red · with 1234 vs 5678, 9012" */
export const describeTournamentMatch = (
  info: TournamentMatchInfo | undefined
): string => {
  if (!info) return '';
  const parts: string[] = [];
  if (info.label) parts.push(info.label);
  if (info.alliance) parts.push(ALLIANCE_NAMES[info.alliance]);
  if (info.partner) parts.push(`with ${info.partner}`);
  if (info.opponents?.length) parts.push(`vs ${info.opponents.join(', ')}`);
  return parts.join(' · ');
};

// ── FTC Scout ─────────────────────────────────────────────────────────

const FTC_SCOUT = 'https://ftcscout.org';

/**
 * The FTC season a session falls in, as FTC Scout numbers them: by the year
 * it starts in September. BIOBUZZ is 2026-27.
 */
export const FTC_SCOUT_SEASON = 2026;

/** A team's FTC Scout page, or null when it isn't a team number */
export const ftcScoutTeamUrl = (team: string | undefined): string | null => {
  const n = cleanTeamNumber(team);
  return n ? `${FTC_SCOUT}/teams/${n}` : null;
};

/** An event's FTC Scout page, or null when it isn't an event code */
export const ftcScoutEventUrl = (
  code: string | undefined,
  season = FTC_SCOUT_SEASON
): string | null => {
  const c = cleanEventCode(code);
  return c ? `${FTC_SCOUT}/events/${season}/${c}` : null;
};

/** Whether a match's fields hold any tournament details */
export const hasTournamentInfo = (
  f: Partial<MatchScoringFields> | undefined
): boolean => !!toTournamentInfo(f?.tournament);
