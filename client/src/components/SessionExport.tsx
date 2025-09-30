import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Session {
  id: string;
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
  createdAt: string;
  autonBasket: number;
  autonSpeci: number;
  teleBasket: number;
  teleSpeci: number;
  endgameHang: number;
}

interface SessionExportProps {
  sessions: Session[];
  userId?: string;
}

const SessionExport: React.FC<SessionExportProps> = ({ sessions, userId }) => {
  const { isDarkMode } = useTheme();
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'sessionName',
    'driverName',
    'matchType',
    'finalScore',
    'createdAt',
  ]);
  const [isExporting, setIsExporting] = useState(false);

  const availableFields = [
    { id: 'sessionName', label: 'Session Name' },
    { id: 'driverName', label: 'Driver Name' },
    { id: 'matchType', label: 'Match Type' },
    { id: 'sessionDuration', label: 'Duration' },
    { id: 'finalScore', label: 'Final Score' },
    { id: 'createdAt', label: 'Created Date' },
    { id: 'autonBasket', label: 'Auton Basket' },
    { id: 'autonSpeci', label: 'Auton Speci' },
    { id: 'teleBasket', label: 'Teleop Basket' },
    { id: 'teleSpeci', label: 'Teleop Speci' },
    { id: 'endgameHang', label: 'Endgame Hang' },
  ];

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const exportToCSV = (data: Session[]) => {
    if (selectedFields.length === 0) return;

    const headers = selectedFields.map(
      field => availableFields.find(f => f.id === field)?.label || field
    );

    const csvContent = [
      headers.join(','),
      ...data.map(session =>
        selectedFields
          .map(field => {
            const value = session[field as keyof Session];
            // Handle dates and strings with commas
            if (field === 'createdAt' && value) {
              return `"${new Date(value).toLocaleString()}"`;
            }
            return typeof value === 'string' && value.includes(',')
              ? `"${value}"`
              : String(value || '');
          })
          .join(',')
      ),
    ].join('\n');

    downloadFile(
      csvContent,
      `sessions_${userId || 'export'}_${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  };

  const exportToJSON = (data: Session[]) => {
    const filteredData = data.map(session => {
      const filtered: Record<string, unknown> = {};
      selectedFields.forEach(field => {
        filtered[field] = session[field as keyof Session];
      });
      return filtered;
    });

    const jsonContent = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        userId,
        totalSessions: data.length,
        sessions: filteredData,
      },
      null,
      2
    );

    downloadFile(
      jsonContent,
      `sessions_${userId || 'export'}_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
  };

  const downloadFile = (
    content: string,
    filename: string,
    mimeType: string
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (sessions.length === 0 || selectedFields.length === 0) return;

    setIsExporting(true);

    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));

      if (exportFormat === 'csv') {
        exportToCSV(sessions);
      } else {
        exportToJSON(sessions);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
        >
          <Download className="h-4 w-4 mr-2" />
          Export Sessions
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`max-w-md ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
      >
        <DialogHeader>
          <DialogTitle className={isDarkMode ? 'text-white' : ''}>
            Export Sessions
          </DialogTitle>
          <DialogDescription className={isDarkMode ? 'text-gray-400' : ''}>
            Export your session data in CSV or JSON format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format */}
          <div>
            <label
              className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Export Format
            </label>
            <Select
              value={exportFormat}
              onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}
            >
              <SelectTrigger
                className={`mt-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Excel)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    JSON
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Field Selection */}
          <div>
            <label
              className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Select Fields to Export
            </label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {availableFields.map(field => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <label
                    htmlFor={field.id}
                    className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} cursor-pointer`}
                  >
                    {field.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Export Info */}
          <div
            className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
          >
            <div
              className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              <div>
                Sessions to export:{' '}
                <span className="font-medium">{sessions.length}</span>
              </div>
              <div>
                Selected fields:{' '}
                <span className="font-medium">{selectedFields.length}</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={
              isExporting ||
              selectedFields.length === 0 ||
              sessions.length === 0
            }
            className="w-full bg-team-blue hover:bg-team-blue/90"
          >
            {isExporting ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {sessions.length} Sessions
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionExport;
