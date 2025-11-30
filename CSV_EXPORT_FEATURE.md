# CSV Export Feature

## Overview
The TeamTrack application now includes comprehensive CSV export functionality across multiple pages, allowing users to export their training session data for external analysis, reporting, and record-keeping.

## Features

### 1. **Sessions Page Export** (`/sessions`)
- **Location**: Export button in the header section
- **What it exports**: All sessions with basic information
- **CSV Columns**:
  - Session Name
  - Driver Name
  - Match Type
  - Final Score
  - Autonomous Score
  - TeleOp Score
  - End Game Score
  - Session Duration
  - Date Created

### 2. **User Sessions Page Export** (`/user-sessions`)
- **Location**: Export button in the filters section (next to search and sort controls)
- **What it exports**: Filtered sessions with detailed scoring breakdown
- **CSV Columns**:
  - Session Name
  - Driver Name
  - Match Type
  - Final Score
  - Autonomous Score
  - TeleOp Score
  - End Game Score
  - Session Duration
  - Auton Classified Artifact
  - Auton Overflow Artifact
  - Auton Motif
  - Auton Leave
  - Tele Classified Artifact
  - Tele Overflow Artifact
  - Tele Motif
  - Endgame Hang
  - Selected Feature
  - Average Cycle Time
  - Cycle Times (all individual times)
  - Date Created

**Note**: The export respects active filters - only the currently displayed sessions will be exported.

### 3. **Analysis Page Export** (`/analysis`)
- **Location**: Export button below the page header
- **What it exports**: Detailed analysis of a single session
- **CSV Format**: Two-column format (Metric, Value) with sections for:
  - Session Information
  - Scores (Final, Autonomous, TeleOp, End Game)
  - Performance Metrics (Consistency, Accuracy)
  - Autonomous Breakdown
  - TeleOp Breakdown
  - Endgame Performance
  - Cycle Times (if available)
  - Performance Insights (if available)

## Usage

### Exporting Sessions
1. Navigate to the Sessions or User Sessions page
2. (Optional) Apply filters or search to narrow down the sessions
3. Click the "Export CSV" button
4. The CSV file will be automatically downloaded to your default downloads folder

### Exporting Analysis
1. Navigate to the Analysis page for a specific session
2. Click the "Export Analysis as CSV" button
3. The CSV file will be automatically downloaded with a filename based on the session name

## File Naming Convention
- **Sessions Export**: `sessions-export-YYYY-MM-DD.csv`
- **Detailed Sessions Export**: `sessions-detailed-export-YYYY-MM-DD.csv`
- **Analysis Export**: `session-analysis-{session-name}-YYYY-MM-DD.csv`

## Technical Implementation

### CSV Utility Module
Location: `client/src/lib/csvExport.ts`

#### Functions:
1. **`exportSessionsToCSV(sessions, filename?)`**
   - Exports basic session information
   - Used by Sessions page

2. **`exportSessionsDetailedToCSV(sessions, filename?)`**
   - Exports detailed session information with scoring breakdown
   - Used by User Sessions page

3. **`exportSessionAnalysisToCSV(session, metrics, filename?)`**
   - Exports comprehensive analysis of a single session
   - Used by Analysis page

#### Helper Functions:
- `formatDateForCSV(timestamp)` - Formats timestamps to readable strings
- `escapeCSVValue(value)` - Properly escapes values for CSV format
- `formatCycleTimes(cycleTimes)` - Formats cycle times array
- `getAverageCycleTime(cycleTimes)` - Calculates average cycle time

### Data Handling
- All CSV values are properly escaped to handle special characters (quotes, commas, newlines)
- Timestamps are formatted in a human-readable format (e.g., "Nov 29, 2025, 2:30 PM")
- Missing or undefined values are handled gracefully with defaults or "N/A"
- Cycle times are formatted as "M:SS" (e.g., "1:25" for 1 minute 25 seconds)

## Browser Compatibility
The CSV export feature uses standard Web APIs and should work in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Future Enhancements
Potential improvements for future versions:
- Export to Excel format (.xlsx)
- Custom column selection
- Export multiple sessions as separate sheets in one file
- Schedule automatic exports
- Email export functionality
- Cloud storage integration (Google Drive, Dropbox)

## Troubleshooting

### Export button is disabled
- **Cause**: No sessions available to export
- **Solution**: Create some sessions first

### Downloaded file won't open
- **Cause**: Browser security settings or file association issues
- **Solution**: 
  - Check your downloads folder
  - Try opening with a different spreadsheet application (Excel, Google Sheets, LibreOffice)
  - Ensure your browser allows file downloads

### Missing data in export
- **Cause**: Session data may be incomplete
- **Solution**: Check the original session data in the application

### Special characters appear incorrectly
- **Cause**: Character encoding issue
- **Solution**: Open the CSV file with UTF-8 encoding selected in your spreadsheet application

## Support
For issues or feature requests related to CSV export, please contact the development team or create an issue in the repository.
