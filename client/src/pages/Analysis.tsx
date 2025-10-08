import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSession, SessionProvider } from '../contexts/SessionContext';
import { useTheme, ThemeProvider } from '../contexts/ThemeContext';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

const DataCard = ({ value, label }: { value: string; label: string }) => {
  return (
    <div className="flex flex-col items-center gap-4 px-9 py-6 rounded-lg border border-team-blue-40 bg-team-dark-20">
      <div className="text-team-blue text-3xl font-medium leading-6">
        {value}
      </div>
      <div className="text-team-white-60 text-base leading-6">{label}</div>
    </div>
  );
};

const SensorOverviewCard = ({
  sessionName,
  driverName,
  matchType,
  sessionDuration,
  finalScore,
  totalTime,
}: {
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
  totalTime: string;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-4">
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Sensor Overview
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div className="text-team-white-60 text-xs leading-6">
              Session Name
            </div>
            <div className="text-team-white-60 text-xs leading-6">Driver</div>
            <div className="text-team-white-60 text-xs leading-6">
              Match Type
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {driverName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {matchType || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div className="text-team-white-60 text-xs leading-6">Duration</div>
            <div className="text-team-white-60 text-xs leading-6">
              Final Score
            </div>
            <div className="text-team-white-60 text-xs leading-6">
              Total Finished Time
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionDuration || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">{finalScore}</div>
            <div className="text-team-blue text-xs leading-6">{totalTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder component for future graph functionality
// const _GraphModal = ({
//   isOpen,
//   onClose,
//   metric,
// }: {
//   isOpen: boolean;
//   onClose: () => void;
//   metric: string;
// }) => {
//   const { isDarkMode } = useTheme();
//   if (!isOpen) return null;
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       {/* Modal content would go here */}
//     </div>
//   );
// };

const PerformanceInsightCard = ({
  metric,
  value,
  isPositive,
  onToggle,
  onShowGraph,
}: {
  metric: string;
  value: string;
  isPositive: boolean;
  onToggle: () => void;
  onShowGraph: () => void;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-lg border border-team-blue-40">
      <div className="flex items-center gap-4">
        <span
          className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          {metric || 'Metric Name'}
        </span>
        <span className="text-team-blue text-base font-medium">
          {value || 'Value'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onShowGraph}
          className={`p-2 rounded transition-colors hover:bg-team-blue-10 ${isDarkMode ? 'text-white' : 'text-black'}`}
          title="Show Graph"
        >
          <BarChart3 className="w-5 h-5" />
        </button>
        <button
          onClick={onToggle}
          className={`p-2 rounded transition-colors ${
            isPositive
              ? 'text-green-500 hover:bg-green-500/10'
              : 'text-red-500 hover:bg-red-500/10'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

const AnalysisContent = () => {
  const { sessionData } = useSession();
  const { isDarkMode } = useTheme();
  const [timer, setTimer] = useState(0);
  const [_graphModal, _setGraphModal] = useState<{
    isOpen: boolean;
    metric: string;
  }>({
    isOpen: false,
    metric: '',
  });

  // Performance insights state
  const [insights, setInsights] = useState([
    { id: 1, metric: 'Consistency', value: '87%', isPositive: true },
    { id: 2, metric: '', value: '', isPositive: true },
    { id: 3, metric: '', value: '', isPositive: false },
    { id: 4, metric: '', value: '', isPositive: true },
    { id: 5, metric: '', value: '', isPositive: false },
    { id: 6, metric: '', value: '', isPositive: true },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleInsight = (id: number) => {
    setInsights(prev =>
      prev.map(insight =>
        insight.id === id
          ? { ...insight, isPositive: !insight.isPositive }
          : insight
      )
    );
  };

  // Placeholder functions for future graph functionality
  // const _showGraph = (_metric: string) => {
  //   _setGraphModal({ isOpen: true, metric: _metric });
  // };

  // const _closeGraph = () => {
  //   _setGraphModal({ isOpen: false, metric: "" });
  // };

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <Header />

      <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-8 lg:py-16">
        <div className="space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-[48px]">
              {sessionData.sessionName || 'Session'} Analysis
            </h1>
            <p
              className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Detailed performance analysis
            </p>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
              {formatTime(timer)}
            </div>
          </div>

          {/* Data Cards */}
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 justify-center">
            <DataCard
              value={sessionData.finalScore.toString()}
              label="Final Score"
            />
            <DataCard value="87%" label="Consistency" />
            <DataCard value="92%" label="Accuracy" />
          </div>

          {/* Sensor Overview */}
          <SensorOverviewCard
            sessionName={sessionData.sessionName}
            driverName={sessionData.driverName}
            matchType={sessionData.matchType}
            sessionDuration={sessionData.sessionDuration}
            finalScore={sessionData.finalScore}
            totalTime={formatTime(timer)}
          />

          {/* Performance Insights */}
          <div className="space-y-6">
            <h2 className="text-team-blue text-2xl font-semibold leading-6">
              Performance Insights
            </h2>
            <div className="space-y-4">
              {insights.map(insight => (
                <PerformanceInsightCard
                  key={insight.id}
                  metric={insight.metric}
                  value={insight.value}
                  isPositive={insight.isPositive}
                  onToggle={() => toggleInsight(insight.id)}
                  onShowGraph={() => {
                    // Placeholder for graph functionality
                    // _showGraph(insight.metric || `Metric ${insight.id}`)
                  }}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/original"
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue text-team-blue text-base leading-6 font-normal text-center hover:bg-team-blue hover:text-team-dark transition-colors"
            >
              Back to Session
            </Link>
            <button className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue text-team-dark text-base leading-6 font-normal">
              Export Analysis Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Analysis() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AnalysisContent />
      </SessionProvider>
    </ThemeProvider>
  );
}
