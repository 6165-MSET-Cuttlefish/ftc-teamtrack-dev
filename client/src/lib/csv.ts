/**
 * CSV export of sessions.
 *
 * Nothing stored is trusted to be the type it should be: a session can come
 * from Firestore, where another client may have written strings into number
 * fields. Every cell therefore goes through `esc` (text) or `num` (numbers),
 * so no stored value can start a formula or break out of its cell.
 */

import type { Session } from '@/types';
import {
  calculateScore,
  cycleTimesOf,
  includesAuto,
  includesTeleop,
  rankingPoints,
  sessionMatchType,
} from './scoring';
import { ELEMENT_LABELS as L } from './scoringLabels';
import { toDate } from './utils';
import { htmlToText } from './htmlText';

/**
 * A text cell: quoted, with quotes doubled and line breaks flattened so each
 * match stays on one line. Text a spreadsheet would run as a formula (a
 * leading `=`, `+`, `-`, `@`, tab or carriage return) is prefixed with an
 * apostrophe, which makes it plain text.
 */
export const esc = (value: unknown): string => {
  let safe = (value === null || value === undefined ? '' : String(value))
    .replace(/"/g, '""')
    .replace(/\r\n|\r|\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  return `"${safe}"`;
};

/**
 * A number cell: the value as a finite number, or `0` for anything that
 * isn't one. Never passes a stored string through as it is.
 */
export const num = (value: unknown): string => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? String(n) : '0';
};

/**
 * A date cell: ISO 8601, in the time zone of whoever exports
 * (`2026-09-30T16:10:00-07:00`). A spreadsheet can sort and chart it, and it
 * still reads as the hour the session was run at. Blank when the session has
 * no usable date.
 */
export const isoDate = (timestamp: unknown): string => {
  if (!timestamp) return '';
  const date = toDate(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  /** Minutes this time zone is ahead of UTC on that date */
  const offset = -date.getTimezoneOffset();
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const local = new Date(date.getTime() + offset * 60000)
    .toISOString()
    .slice(0, 19);
  return `${local}${offset < 0 ? '-' : '+'}${pad(offset / 60)}:${pad(offset % 60)}`;
};

/**
 * A session's duration as h:mm:ss (`0:48:12`). The app stores minutes and
 * seconds (`48:12`, `65:33`), which a spreadsheet reads as hours and minutes
 * (48 hours); with the hours written out it reads as the time it is. A value
 * that isn't a duration is written as it is.
 */
const durationCell = (value: unknown): string => {
  if (typeof value !== 'string' || !/^\d+(:\d+){1,2}$/.test(value.trim())) {
    return value === null || value === undefined ? '' : String(value);
  }
  const parts = value.trim().split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  const total = h * 3600 + m * 60 + s;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

/** Columns that describe the session and lead every row. */
const SESSION_HEADERS = [
  'Session Name',
  'Session Date',
  'Session Type',
  'Session Duration',
  'Match Type',
] as const;

/**
 * Columns that describe one match. Blank for a session with no matches.
 * Scoring columns carry the names the app shows (`ELEMENT_LABELS`) and
 * follow `ELEMENT_ORDER`, the order the scoring page asks for them: Hive
 * Tips, the robots' Leave and Park, then Flower, Flower Bonus, Left in Hive
 * and Garden. The row cells in `buildSessionsCsv` are in the same order.
 */
const MATCH_HEADERS = [
  'Match Number',
  'Final Score',
  L.tipping,
  `${L.tipping} Points`,
  `Robot 1 ${L.leave}`,
  `Robot 1 ${L.parkAuto}`,
  `Robot 1 ${L.parkEnd}`,
  `Robot 2 ${L.leave}`,
  `Robot 2 ${L.parkAuto}`,
  `Robot 2 ${L.parkEnd}`,
  L.flower,
  `${L.flower} Points`,
  L.flowerBonus,
  `${L.flowerBonus} Points`,
  L.hive,
  `${L.hive} Points`,
  L.garden,
  `${L.garden} Points`,
  'Minor Fouls',
  'Major Fouls',
  'Points Given to Opponent',
  'Time Between Hive Tips (s)',
  'SWARM RP',
  'POLLINATOR RPs',
  'Ranking Points',
] as const;

/** Session columns that close every row. Notes are written once per session. */
const TRAILING_HEADERS = ['Notes', 'User Email'] as const;

const BLANK = '""';

/**
 * One row per match (one row for a session with none), under a header row.
 * The session's columns repeat on each of its rows, except its notes, which
 * are on its first row only.
 *
 * Final Score is recomputed from the match's fields and is what the alliance
 * earned: fouls are never taken off it. They are listed in their own columns
 * as points given to the opponent, and only for Scrim sessions — a Practice
 * session has no opponent, so those cells are blank. A robot flag is blank
 * when the match type did not run that period. Ranking points are the ones a
 * match earns from its own scoring (SWARM, POLLINATOR); the opponent's score
 * is not recorded, so a win or tie is not counted.
 */
export const buildSessionsCsv = (sessions: Session[]): string => {
  const rows: string[][] = [];

  for (const session of sessions) {
    const matches = Array.isArray(session.matches) ? session.matches : [];
    const isScrim = session.sessionType === 'Scrim';
    const leading = [
      esc(session.sessionName || 'Untitled Session'),
      esc(isoDate(session.createdAt)),
      esc(session.sessionType || 'Practice'),
      esc(durationCell(session.sessionDuration)),
    ];
    const notes = esc(
      htmlToText(typeof session.notes === 'string' ? session.notes : '')
    );
    const email = esc(session.userEmail || '');

    if (matches.length === 0) {
      rows.push([
        ...leading,
        esc(sessionMatchType(matches, session.matchType)),
        ...Array<string>(MATCH_HEADERS.length).fill(BLANK),
        notes,
        email,
      ]);
      continue;
    }

    matches.forEach((match, index) => {
      const matchType = match.matchType || session.matchType || 'Full Game';
      const b = calculateScore({ ...match, matchType });
      const rp = rankingPoints({ ...match, matchType });
      const flag = (ran: boolean, value: unknown) =>
        ran ? esc(value ? 'yes' : 'no') : BLANK;
      const auto = includesAuto(matchType);
      const teleop = includesTeleop(matchType);
      const foul = (value: unknown) => (isScrim ? num(value) : BLANK);

      rows.push([
        ...leading,
        esc(matchType),
        num(match.matchNumber),
        num(b.total),
        // In MATCH_HEADERS' order (ELEMENT_ORDER)
        num(match.tipping),
        num(b.tipping),
        flag(auto, match.robot1Leave),
        flag(auto, match.robot1ParkAuto),
        flag(teleop, match.robot1ParkTeleop),
        flag(auto, match.robot2Leave),
        flag(auto, match.robot2ParkAuto),
        flag(teleop, match.robot2ParkTeleop),
        num(match.flower),
        num(b.flower),
        num(match.flowerBonus),
        num(b.flowerBonus),
        num(match.ballsInHive),
        num(b.hive),
        num(match.garden),
        num(b.garden),
        foul(match.minorPenalties),
        foul(match.majorPenalties),
        foul(b.penalties),
        esc(cycleTimesOf(match).join('; ')),
        esc(rp.swarm ? 'yes' : 'no'),
        num(rp.pollinator),
        num(rp.total),
        index === 0 ? notes : BLANK,
        email,
      ]);
    });
  }

  const headers = [...SESSION_HEADERS, ...MATCH_HEADERS, ...TRAILING_HEADERS];
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

/**
 * Match columns of a session recorded in last season's game (DECODE), in the
 * order that season's app exported them. Its matches carry none of this
 * season's fields, so they get these instead of `MATCH_HEADERS`.
 */
const LEGACY_MATCH_HEADERS = [
  'Match Number',
  'Final Score',
  'Autonomous Score',
  'Teleop Score',
  'Endgame Score',
  'Auton Classified Artifact',
  'Auton Overflow Artifact',
  'Auton Motif',
  'Auton Leave',
  'Auton Balls Missed',
  'Tele Classified Artifact',
  'Tele Overflow Artifact',
  'Tele Motif',
  'Tele Balls Missed',
  'Robot 1 Park',
  'Robot 2 Park',
  'Cycle Times',
  'Auton Shots (Made/Shot)',
  'Teleop Shots (Made/Shot)',
] as const;

/** `made/shot` for each stored shot record, `; `-separated. */
const shotsCell = (value: unknown): string =>
  esc(
    (Array.isArray(value) ? value : [])
      .filter(
        (shot): shot is Record<string, unknown> =>
          typeof shot === 'object' && shot !== null
      )
      .map(shot => `${num(shot.ballsMade)}/${num(shot.ballsShot)}`)
      .join('; ')
  );

/**
 * Sessions from an earlier season (DECODE), in the columns that season's app
 * exported: one row per match (one for a session with none), the scores and
 * counts as they were saved. Nothing is recomputed - this season's scoring
 * means nothing to them. Dates, notes and safety as in `buildSessionsCsv`.
 */
export const buildLegacySessionsCsv = (sessions: Session[]): string => {
  const rows: string[][] = [];

  for (const session of sessions) {
    const matches = Array.isArray(session.matches) ? session.matches : [];
    const leading = [
      esc(session.sessionName || 'Untitled Session'),
      esc(isoDate(session.createdAt)),
      esc((session.season || 'decode').toUpperCase()),
      esc(durationCell(session.sessionDuration)),
    ];
    const notes = esc(
      htmlToText(typeof session.notes === 'string' ? session.notes : '')
    );
    const email = esc(session.userEmail || '');

    if (matches.length === 0) {
      rows.push([
        ...leading,
        esc(session.matchType || 'Full Game'),
        ...Array<string>(LEGACY_MATCH_HEADERS.length).fill(BLANK),
        notes,
        email,
      ]);
      continue;
    }

    matches.forEach((match, index) => {
      // Last season's fields aren't part of this season's `Match` type.
      const m = match as unknown as Record<string, unknown>;
      const park = (value: unknown) =>
        esc(typeof value === 'string' && value ? value : 'none');
      const cycleTimes = (Array.isArray(m.cycleTimes) ? m.cycleTimes : [])
        .map(num)
        .join('; ');

      rows.push([
        ...leading,
        esc(match.matchType || session.matchType || 'Full Game'),
        num(match.matchNumber),
        num(match.finalScore),
        num(m.autonomousScore),
        num(m.teleopScore),
        num(m.endGameScore),
        num(m.autonClassifiedArtifact),
        num(m.autonOverflowArtifact),
        num(m.autonMotif),
        num(m.autonLeave),
        num(m.autonBallsMissed),
        num(m.teleClassifiedArtifact),
        num(m.teleOverflowArtifact),
        num(m.teleMotif),
        num(m.teleBallsMissed),
        park(m.robot1Park),
        park(m.robot2Park),
        esc(cycleTimes),
        shotsCell(m.autonShots),
        shotsCell(m.teleopShots),
        index === 0 ? notes : BLANK,
        email,
      ]);
    });
  }

  const headers = [
    'Session Name',
    'Session Date',
    'Season',
    'Session Duration',
    'Match Type',
    ...LEGACY_MATCH_HEADERS,
    ...TRAILING_HEADERS,
  ];
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

/**
 * A download name for an export: `base` reduced to characters every OS takes
 * in a file name, followed by today's date where the export is made (an
 * evening practice in California is still that day, not tomorrow in UTC). A
 * session's name is whatever its author typed, so it is never used as a file
 * name as it is.
 */
export const csvFileName = (base: string): string => {
  const safe =
    (base || '')
      .replace(/[^a-z0-9\-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'session';
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return `${safe}-${date}.csv`;
};

/**
 * Hand `csv` to the browser as a file download. The file starts with a
 * UTF-8 byte order mark, without which Excel reads it in the system's legacy
 * code page and garbles curly apostrophes and accents in names and notes.
 */
export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
