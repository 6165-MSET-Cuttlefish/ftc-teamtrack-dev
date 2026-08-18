import type { Session } from '@/types';
import { formatDate } from './utils';

/**
 * CSV export for sessions.
 *
 * Shared by the Sessions list (export everything) and a single session's
 * Analysis view (export just that one), so the column set can never drift
 * between the two.
 *
 * One row per match, with the parent session's fields repeated on each row —
 * that shape is what spreadsheets want for pivoting. A session with no matches
 * still emits one row so it isn't silently dropped from the export.
 */

/**
 * Quote a value for CSV, and defuse spreadsheet formula injection.
 * A cell starting with = + - @ (or tab/CR) is executed as a formula by Excel and
 * Sheets, so a session named `=cmd|...` would run on open. Prefixing an
 * apostrophe forces it to be read as text.
 */
const esc = (val: string): string => {
  let safe = String(val ?? '')
    .replace(/"/g, '""')
    .replace(/\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  return `"${safe}"`;
};

const HEADERS = [
  'Session Name',
  'Session Date',
  'Session Duration',
  'Match Type',
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
  'Notes',
  'User Email',
] as const;

/** Build the CSV text for the given sessions. Exported for testing. */
export const buildSessionsCsv = (sessions: Session[]): string => {
  const rows: string[][] = [];

  for (const session of sessions) {
    const sessionDate = esc(formatDate(session.createdAt));
    const sessionName = esc(session.sessionName || 'Untitled Session');
    const sessionDuration = esc(session.sessionDuration || '');
    const matchType = esc(session.matchType || 'Full Game');
    const notes = esc(session.notes || '');
    const email = esc(session.userEmail || '');

    if (!session.matches || session.matches.length === 0) {
      rows.push([
        sessionName,
        sessionDate,
        sessionDuration,
        matchType,
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        esc('none'),
        esc('none'),
        esc(''),
        esc(''),
        esc(''),
        notes,
        email,
      ]);
      continue;
    }

    for (const match of session.matches) {
      const cycleTimes = (match.cycleTimes || []).join('; ');
      const autonShots = (match.autonShots || [])
        .map(s => `${s.ballsMade}/${s.ballsShot}`)
        .join('; ');
      const teleopShots = (match.teleopShots || [])
        .map(s => `${s.ballsMade}/${s.ballsShot}`)
        .join('; ');

      rows.push([
        sessionName,
        sessionDate,
        sessionDuration,
        esc(match.matchType || session.matchType || 'Full Game'),
        String(match.matchNumber || 0),
        String(match.finalScore || 0),
        String(match.autonomousScore || 0),
        String(match.teleopScore || 0),
        String(match.endGameScore || 0),
        String(match.autonClassifiedArtifact || 0),
        String(match.autonOverflowArtifact || 0),
        String(match.autonMotif || 0),
        String(match.autonLeave || 0),
        String(match.autonBallsMissed || 0),
        String(match.teleClassifiedArtifact || 0),
        String(match.teleOverflowArtifact || 0),
        String(match.teleMotif || 0),
        String(match.teleBallsMissed || 0),
        esc(match.robot1Park || 'none'),
        esc(match.robot2Park || 'none'),
        esc(cycleTimes),
        esc(autonShots),
        esc(teleopShots),
        notes,
        email,
      ]);
    }
  }

  return [HEADERS.join(','), ...rows.map(row => row.join(','))].join('\n');
};

/** Strip characters that browsers/OSes dislike in a download filename. */
const safeFileName = (name: string): string =>
  (name || 'session')
    .replace(/[^a-z0-9\-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'session';

/** Build the CSV and hand it to the browser as a download. */
export const downloadSessionsCsv = (
  sessions: Session[],
  fileBaseName: string
): void => {
  const csv = buildSessionsCsv(sessions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `${safeFileName(fileBaseName)}-${new Date().toISOString().split('T')[0]}.csv`
  );
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
