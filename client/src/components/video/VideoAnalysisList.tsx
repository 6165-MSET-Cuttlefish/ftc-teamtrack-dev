import { useTheme } from '@/contexts';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatTime } from '@/lib';
import type { VideoAnalysis } from '@/types';
import { Trash2, Clock, PlayCircle } from 'lucide-react';

interface VideoAnalysisListProps {
  analyses: VideoAnalysis[];
  selectedId: string | null;
  onSelect: (analysis: VideoAnalysis) => void;
  onDelete: (analysisId: string) => void;
}

export const VideoAnalysisList = ({
  analyses,
  selectedId,
  onSelect,
  onDelete,
}: VideoAnalysisListProps) => {
  const { isDarkMode } = useTheme();

  if (analyses.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
        Past analyses
      </h2>
      {analyses.map((analysis) => (
        <Card
          key={analysis.id}
          onClick={() => onSelect(analysis)}
          className={`cursor-pointer transition-colors ${
            selectedId === analysis.id
              ? 'border-team-blue'
              : isDarkMode
                ? 'border-team-blue-40 bg-team-dark hover:border-team-blue/60'
                : 'border-gray-200 bg-white hover:border-team-blue/60'
          }`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <PlayCircle className="h-5 w-5 flex-shrink-0 text-team-blue" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {analysis.status === 'error'
                  ? 'Analysis failed'
                  : analysis.report.summary || 'Robot video analysis'}
              </p>
              <div className={`flex items-center gap-2 text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span>{formatDate(analysis.createdAt)}</span>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>{formatTime(analysis.durationSec)}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(analysis.id);
              }}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                isDarkMode ? 'text-team-white-60 hover:bg-red-500/20 hover:text-red-500' : 'text-gray-400 hover:bg-red-500/20 hover:text-red-500'
              }`}
              title="Delete analysis"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
