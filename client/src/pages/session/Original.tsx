import {
  SessionSetup,
  PerformanceMetrics,
  Notes,
  LivePreview,
} from '@/components';
import { useTheme, useSession } from '@/contexts';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

const OriginalContent = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { sessionData, updateSessionData, isTimerRunning, setIsTimerRunning } = useSession();
  const [showMatchSummary, setShowMatchSummary] = useState(false);

  const handleSaveMatch = () => {
    // Create a new match from current session data
    const newMatch = {
      id: `match-${Date.now()}`,
      matchNumber: (sessionData.matches?.length || 0) + 1,
      matchType: sessionData.matchType,
      finalScore: sessionData.finalScore,
      autonomousScore: sessionData.autonomousScore,
      teleOpScore: sessionData.teleOpScore,
      endGameScore: sessionData.endGameScore,
      autonClassifiedArtifact: sessionData.autonClassifiedArtifact,
      autonOverflowArtifact: sessionData.autonOverflowArtifact,
      autonMotif: sessionData.autonMotif,
      autonLeave: sessionData.autonLeave,
      teleClassifiedArtifact: sessionData.teleClassifiedArtifact,
      teleOverflowArtifact: sessionData.teleOverflowArtifact,
      teleMotif: sessionData.teleMotif,
      endgameHang: sessionData.endgameHang,
      cycleTimes: sessionData.cycleTimes,
      createdAt: new Date().toISOString(),
    };

    // Add to matches array
    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
      // Reset scoring for next match
      finalScore: 0,
      autonomousScore: 0,
      teleOpScore: 0,
      endGameScore: 0,
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      autonLeave: 0,
      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,
      endgameHang: 0,
      cycleTimes: [],
    });

    setShowMatchSummary(false);
  };

  const handleFinishSession = () => {
    // Update session with overall scores from all matches if no scores set
    if (
      sessionData.finalScore === 0 &&
      sessionData.matches &&
      sessionData.matches.length > 0
    ) {
      const totalScore = sessionData.matches.reduce(
        (sum, m) => sum + (m.finalScore || 0),
        0
      );
      const avgAuton =
        sessionData.matches.reduce(
          (sum, m) => sum + (m.autonomousScore || 0),
          0
        ) / sessionData.matches.length;
      const avgTele =
        sessionData.matches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) /
        sessionData.matches.length;
      const avgEndgame =
        sessionData.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) /
        sessionData.matches.length;

      updateSessionData({
        isSessionCompleted: true,
        finalScore: totalScore,
        autonomousScore: Math.round(avgAuton),
        teleOpScore: Math.round(avgTele),
        endGameScore: Math.round(avgEndgame),
      });
    } else {
      updateSessionData({ isSessionCompleted: true });
    }

    navigate('/analysis');
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="flex flex-col lg:flex-row items-start max-w-[1216px] mx-auto px-8 pt-12 pb-10 gap-6 lg:gap-10">
        {/* Left Column - Session Form */}
        <div
          className={`flex-1 w-full lg:max-w-[776px] py-8 lg:py-14 lg:pr-12 lg:border-r ${isDarkMode ? 'border-team-white-20' : 'border-team-blue/60'}`}
        >
          <div className="space-y-12 lg:space-y-16">
            {/* Header with Match Counter */}
            <div className="text-center px-4 lg:px-24 space-y-6">
              <h1 className="text-team-blue text-3xl lg:text-[46px] font-semibold leading-[48px] mr-1">
                {sessionData.sessionName || 'Active Practice Session'}
              </h1>
              <p
                className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
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
            <PerformanceMetrics 
              isTimerRunning={isTimerRunning}
              onTimerToggle={setIsTimerRunning}
              hasActiveMatch={!showMatchSummary}
            />

            {/* Notes */}
            <Notes />

            {/* Match Actions */}
            <div className="flex flex-col gap-4 px-4 lg:px-0">
              <Button
                onClick={() => setShowMatchSummary(true)}
                className="w-full bg-team-blue hover:bg-team-blue/90 text-white py-6 text-lg font-semibold rounded-xl"
              >
                Save Match & Start New
              </Button>
              {sessionData.matches && sessionData.matches.length > 0 && (
                <Button
                  onClick={handleFinishSession}
                  variant="outline"
                  className="w-full border-team-blue text-team-blue hover:bg-team-blue/10 py-6 text-lg font-semibold rounded-xl"
                >
                  Finish Session
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Live Preview & Match History */}
        <div className="w-full lg:w-[413px] py-14 px-0 space-y-6">
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
                        <span className="text-team-blue font-bold">
                          {match.finalScore || 0}
                        </span>
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

      {/* Match Summary Modal */}
      {showMatchSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card
            className={`w-full max-w-md ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Match {(sessionData.matches?.length || 0) + 1} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-3 rounded-lg text-center ${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                >
                  <p
                    className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Total Score
                  </p>
                  <p className="text-3xl font-bold text-team-blue">
                    {sessionData.finalScore || 0}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg text-center ${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                >
                  <p
                    className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Match Type
                  </p>
                  <p className="text-lg font-semibold text-team-blue">
                    {sessionData.matchType || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div
                  className={`p-3 rounded-lg text-center ${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                >
                  <p
                    className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Autonomous
                  </p>
                  <p className="text-xl font-bold text-team-blue">
                    {sessionData.autonomousScore || 0}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg text-center ${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                >
                  <p
                    className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    TeleOp
                  </p>
                  <p className="text-xl font-bold text-team-blue">
                    {sessionData.teleOpScore || 0}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg text-center ${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                >
                  <p
                    className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    End Game
                  </p>
                  <p className="text-xl font-bold text-team-blue">
                    {sessionData.endGameScore || 0}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowMatchSummary(false)}
                  variant="outline"
                  className="flex-1 border-team-blue text-team-blue hover:bg-team-blue/10"
                >
                  Keep Editing
                </Button>
                <Button
                  onClick={handleSaveMatch}
                  className="flex-1 bg-team-blue hover:bg-team-blue/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OriginalContent;
