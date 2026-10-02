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
import { formatDate } from './utils';

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

/** Elements that start and end on a line of their own. */
const BLOCK_ELEMENTS =
  'p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, tr';

/**
 * The text of an HTML fragment (session notes are stored as the editor's
 * HTML): tags removed, one line per paragraph or line break, list items as
 * `- ` bullets. Nothing in the fragment is run or loaded.
 */
export const htmlToText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script, style').forEach(el => el.remove());
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('li').forEach(el => el.prepend('- '));
  doc.querySelectorAll(BLOCK_ELEMENTS).forEach(el => {
    el.prepend('\n');
    el.append('\n');
  });

  return (doc.body.textContent ?? '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

/** Columns that describe the session and lead every row. */
const SESSION_HEADERS = [
  'Session Name',
  'Session Date',
  'Session Type',
  'Session Duration',
  'Match Type',
] as const;

/** Columns that describe one match. Blank for a session with no matches. */
const MATCH_HEADERS = [
  'Match Number',
  'Final Score',
  'Tipping',
  'Tipping Points',
  'Garden',
  'Garden Points',
  'Flower',
  'Flower Points',
  'Flower Bonus',
  'Flower Bonus Points',
  'Left in Hive (up CELL)',
  'Hive Points',
  'Robot 1 Leave',
  'Robot 1 Park Auto',
  'Robot 1 Park (End)',
  'Robot 2 Leave',
  'Robot 2 Park Auto',
  'Robot 2 Park (End)',
  'Minor Penalties',
  'Major Penalties',
  'Points Given to Opponent',
  'Time Between Hive Tips (s)',
  'SWARM RP',
  'POLLINATOR RPs',
  'Ranking Points',
] as const;

/** Session columns that close every row. */
const TRAILING_HEADERS = ['Notes', 'User Email'] as const;

const BLANK = '""';

/**
 * One row per match (one row for a session with none), under a header row.
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
      esc(formatDate(session.createdAt)),
      esc(session.sessionType || 'Practice'),
      esc(session.sessionDuration || ''),
    ];
    const trailing = [
      esc(htmlToText(typeof session.notes === 'string' ? session.notes : '')),
      esc(session.userEmail || ''),
    ];

    if (matches.length === 0) {
      rows.push([
        ...leading,
        esc(sessionMatchType(matches, session.matchType)),
        ...Array<string>(MATCH_HEADERS.length).fill(BLANK),
        ...trailing,
      ]);
      continue;
    }

    for (const match of matches) {
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
        num(match.tipping),
        num(b.tipping),
        num(match.garden),
        num(b.garden),
        num(match.flower),
        num(b.flower),
        num(match.flowerBonus),
        num(b.flowerBonus),
        num(match.ballsInHive),
        num(b.hive),
        flag(auto, match.robot1Leave),
        flag(auto, match.robot1ParkAuto),
        flag(teleop, match.robot1ParkTeleop),
        flag(auto, match.robot2Leave),
        flag(auto, match.robot2ParkAuto),
        flag(teleop, match.robot2ParkTeleop),
        foul(match.minorPenalties),
        foul(match.majorPenalties),
        foul(b.penalties),
        esc(cycleTimesOf(match).join('; ')),
        esc(rp.swarm ? 'yes' : 'no'),
        num(rp.pollinator),
        num(rp.total),
        ...trailing,
      ]);
    }
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
 * Sessions from an earlier season (DECODE), as that season's app exported
 * them: one row per match (one for a session with none), the scores and
 * counts as they were saved. Nothing is recomputed - this season's scoring
 * means nothing to them. Same safety as `buildSessionsCsv`.
 */
export const buildLegacySessionsCsv = (sessions: Session[]): string => {
  const rows: string[][] = [];

  for (const session of sessions) {
    const matches = Array.isArray(session.matches) ? session.matches : [];
    const leading = [
      esc(session.sessionName || 'Untitled Session'),
      esc(formatDate(session.createdAt)),
      esc((session.season || 'decode').toUpperCase()),
      esc(session.sessionDuration || ''),
    ];
    const trailing = [
      esc(htmlToText(typeof session.notes === 'string' ? session.notes : '')),
      esc(session.userEmail || ''),
    ];

    if (matches.length === 0) {
      rows.push([
        ...leading,
        esc(session.matchType || 'Full Game'),
        ...Array<string>(LEGACY_MATCH_HEADERS.length).fill(BLANK),
        ...trailing,
      ]);
      continue;
    }

    for (const match of matches) {
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
        ...trailing,
      ]);
    }
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
 * in a file name, followed by today's date. A session's name is whatever its
 * author typed, so it is never used as a file name as it is.
 */
export const csvFileName = (base: string): string => {
  const safe =
    (base || '')
      .replace(/[^a-z0-9\-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'session';
  return `${safe}-${new Date().toISOString().split('T')[0]}.csv`;
};

/** Hand `csv` to the browser as a file download. */
export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
