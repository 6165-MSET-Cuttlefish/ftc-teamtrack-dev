import { Session } from '../types/session';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/**
 * Formats a timestamp to a readable date string
 */
export const formatDateForCSV = (timestamp: unknown): string => {
  if (!timestamp) return 'Unknown date';

  if (typeof timestamp === 'string') {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as FirebaseTimestamp;
    if ('seconds' in ts && 'nanoseconds' in ts) {
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  return 'Unknown date';
};

/**
 * Escapes a value for CSV by wrapping it in quotes and escaping any quotes within
 */
const escapeCSVValue = (value: unknown): string => {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
};

/**
 * Formats cycle times array to a readable string
 */
const formatCycleTimes = (cycleTimes?: number[]): string => {
  if (!cycleTimes || cycleTimes.length === 0) return 'N/A';
  
  const formatted = cycleTimes.map(time => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }).join('; ');
  
  return formatted;
};

/**
 * Calculates average cycle time
 */
const getAverageCycleTime = (cycleTimes?: number[]): string => {
  if (!cycleTimes || cycleTimes.length === 0) return 'N/A';
  
  const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
  const mins = Math.floor(avg / 60);
  const secs = Math.round(avg % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Exports sessions to CSV format with basic information
 */
export const exportSessionsToCSV = (sessions: Session[], filename?: string): void => {
  if (sessions.length === 0) {
    throw new Error('No sessions to export');
  }

  const headers = [
    'Session Name',
    'Driver Name',
    'Match Type',
    'Final Score',
    'Autonomous Score',
    'TeleOp Score',
    'End Game Score',
    'Session Duration',
    'Date Created',
  ];

  const rows = sessions.map(session => [
    escapeCSVValue(session.sessionName || 'Untitled Session'),
    escapeCSVValue(session.driverName || 'Unknown'),
    escapeCSVValue(session.matchType || 'Practice'),
    session.finalScore || 0,
    session.autonomousScore || 0,
    session.teleOpScore || 0,
    session.endGameScore || 0,
    escapeCSVValue(session.sessionDuration || 'N/A'),
    escapeCSVValue(formatDateForCSV(session.createdAt)),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  downloadCSV(csv, filename || `sessions-export-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Exports sessions to CSV format with detailed scoring breakdown
 */
export const exportSessionsDetailedToCSV = (sessions: Session[], filename?: string): void => {
  if (sessions.length === 0) {
    throw new Error('No sessions to export');
  }

  const headers = [
    'Session Name',
    'Driver Name',
    'Match Type',
    'Final Score',
    'Autonomous Score',
    'TeleOp Score',
    'End Game Score',
    'Session Duration',
    'Auton Classified Artifact',
    'Auton Overflow Artifact',
    'Auton Motif',
    'Auton Leave',
    'Tele Classified Artifact',
    'Tele Overflow Artifact',
    'Tele Motif',
    'Endgame Hang',
    'Selected Feature',
    'Average Cycle Time',
    'Cycle Times',
    'Date Created',
  ];

  const rows = sessions.map(session => [
    escapeCSVValue(session.sessionName || 'Untitled Session'),
    escapeCSVValue(session.driverName || 'Unknown'),
    escapeCSVValue(session.matchType || 'Practice'),
    session.finalScore || 0,
    session.autonomousScore || 0,
    session.teleOpScore || 0,
    session.endGameScore || 0,
    escapeCSVValue(session.sessionDuration || 'N/A'),
    session.autonClassifiedArtifact || 0,
    session.autonOverflowArtifact || 0,
    session.autonMotif || 0,
    session.autonLeave || 0,
    session.teleClassifiedArtifact || 0,
    session.teleOverflowArtifact || 0,
    session.teleMotif || 0,
    session.endgameHang || 0,
    escapeCSVValue(session.selectedFeature || 'N/A'),
    escapeCSVValue(getAverageCycleTime(session.cycleTimes)),
    escapeCSVValue(formatCycleTimes(session.cycleTimes)),
    escapeCSVValue(formatDateForCSV(session.createdAt)),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  downloadCSV(csv, filename || `sessions-detailed-export-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Exports a single session analysis to CSV
 */
export const exportSessionAnalysisToCSV = (
  session: Session,
  metrics: {
    consistency: number;
    accuracy: number;
    insights?: Array<{ metric: string; value: string; isPositive: boolean }>;
  },
  filename?: string
): void => {
  const headers = ['Metric', 'Value'];
  
  const rows = [
    ['Session Name', escapeCSVValue(session.sessionName || 'Untitled Session')],
    ['Driver Name', escapeCSVValue(session.driverName || 'Unknown')],
    ['Match Type', escapeCSVValue(session.matchType || 'Practice')],
    ['Session Duration', escapeCSVValue(session.sessionDuration || 'N/A')],
    ['Date Created', escapeCSVValue(formatDateForCSV(session.createdAt))],
    ['', ''], // Empty row for spacing
    ['SCORES', ''],
    ['Final Score', String(session.finalScore || 0)],
    ['Autonomous Score', String(session.autonomousScore || 0)],
    ['TeleOp Score', String(session.teleOpScore || 0)],
    ['End Game Score', String(session.endGameScore || 0)],
    ['', ''], // Empty row for spacing
    ['PERFORMANCE METRICS', ''],
    ['Consistency', `${metrics.consistency}%`],
    ['Accuracy', `${metrics.accuracy}%`],
    ['', ''], // Empty row for spacing
    ['AUTONOMOUS BREAKDOWN', ''],
    ['Classified Artifact', String(session.autonClassifiedArtifact || 0)],
    ['Overflow Artifact', String(session.autonOverflowArtifact || 0)],
    ['Motif', String(session.autonMotif || 0)],
    ['Leave', String(session.autonLeave || 0)],
    ['', ''], // Empty row for spacing
    ['TELEOP BREAKDOWN', ''],
    ['Classified Artifact', String(session.teleClassifiedArtifact || 0)],
    ['Overflow Artifact', String(session.teleOverflowArtifact || 0)],
    ['Motif', String(session.teleMotif || 0)],
    ['', ''], // Empty row for spacing
    ['ENDGAME', ''],
    ['Hang Points', String(session.endgameHang || 0)],
  ];

  // Add cycle times if available
  if (session.cycleTimes && session.cycleTimes.length > 0) {
    rows.push(['', '']);
    rows.push(['CYCLE TIMES', '']);
    rows.push(['Average Cycle Time', escapeCSVValue(getAverageCycleTime(session.cycleTimes))]);
    rows.push(['Total Cycles', String(session.cycleTimes.length)]);
    rows.push(['All Cycle Times', escapeCSVValue(formatCycleTimes(session.cycleTimes))]);
  }

  // Add insights if available
  if (metrics.insights && metrics.insights.length > 0) {
    rows.push(['', '']);
    rows.push(['PERFORMANCE INSIGHTS', '']);
    metrics.insights.forEach(insight => {
      rows.push([escapeCSVValue(insight.metric), escapeCSVValue(insight.value)]);
    });
  }

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  downloadCSV(
    csv,
    filename || `session-analysis-${session.sessionName?.replace(/\s+/g, '-') || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
  );
};

/**
 * Helper function to trigger CSV download
 */
const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
};
