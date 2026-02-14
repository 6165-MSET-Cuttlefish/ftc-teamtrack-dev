import { useEffect } from 'react';
import {
  SessionSetup,
  PerformanceMetrics,
  Notes,
  LivePreview,
  LargeTimer,
} from '@/components';
import { useTheme, useSession } from '@/contexts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_CONFIG } from '@/constants';
import { Edit2 } from 'lucide-react';

const ActiveSessionContent = () => {
  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;
  }, []);
  const { isDarkMode } = useTheme();
  const { sessionData, startEditingMatch } = useSession();

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <LargeTimer />
      </div>

      <div className="flex flex-col lg:flex-row items-start max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-10 gap-10">
        {/* Left Column - Session Form */}
        <div
          className={`flex-1 w-full lg:max-w-[900px] py-10 lg:pr-12 lg:border-r ${isDarkMode ? 'border-team-white-20' : 'border-team-blue/60'}`}
        >
          <div className="space-y-6 sm:space-y-8 md:space-y-12 lg:space-y-16">
            {/* Header with Match Counter */}
            <div className="text-center px-1 sm:px-2 md:px-4 lg:px-24 space-y-3 sm:space-y-4 md:space-y-6">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-[46px] text-team-blue font-semibold leading-snug sm:leading-snug md:leading-snug lg:leading-[56px]">
                {sessionData.sessionName || 'Active Practice Session'}
              </h1>
              <p
                className={`text-sm sm:text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                {sessionData.matches && sessionData.matches.length > 0
                  ? `Match ${(sessionData.matches?.length || 0) + 1} - Track your score`
                  : 'Match 1 - Track your score'}
              </p>
              {sessionData.matches && sessionData.matches.length > 0 && (
                <div
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  {sessionData.matches.length} match
                  {sessionData.matches.length !== 1 ? 'es' : ''} recorded
                </div>
              )}
            </div>

            {/* Session Setup */}
            <SessionSetup />

            {/* Performance Metrics */}
            <PerformanceMetrics />

            {/* Notes */}
            <Notes />
          </div>
        </div>

        {/* Right Column - Live Preview & Match History */}
        <div className="w-full lg:w-[480px] py-10 space-y-6">
          {/* Live Preview */}
          <LivePreview />

          {/* Match History */}
          {sessionData.matches && sessionData.matches.length > 0 && (
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Matches in Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {sessionData.matches.map((match, index) => (
                    <div
                      key={match.id}
                      className={`p-3 rounded-lg ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          Match {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditingMatch(match)}
                            aria-label="Edit match"
                            className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-team-white-10 text-team-white-80 hover:text-team-blue' : 'hover:bg-gray-200 text-gray-700 hover:text-team-blue'}`}
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <span className="text-team-blue font-bold">
                            {match.finalScore || 0}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                      >
                        Type: {match.matchType || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionContent;
