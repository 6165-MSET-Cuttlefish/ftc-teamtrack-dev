import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { firebaseService } from '@/services';
import { formatDate, isAbortError } from '@/lib/utils';
import { ROUTES } from '@/constants';
import type { Session, Match } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Trophy,
  Clock,
  Target,
  Zap,
  X,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface ComparisonMetric {
  label: string;
  values: (number | string)[];
  sessionIds: string[];
  icon: React.ReactNode;
}

interface CompareMatch extends Match {
  sessionId: string;
  sessionName: string;
  sessionIndex: number;
}

const Compare = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedSessionsData, setSelectedSessionsData] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(false);
  
  // Match comparison state
  const [comparisonMode, setComparisonMode] = useState<'sessions' | 'matches'>('sessions');
  const [allMatches, setAllMatches] = useState<CompareMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<CompareMatch[]>([]);

  // Load user sessions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      try {
        const userSessions = await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);

        // Pre-select sessions from URL params if available
        const session1Id = searchParams.get('session1');
        const session2Id = searchParams.get('session2');

        if (session1Id) {
          setSelectedSessionIds([session1Id]);
          if (session2Id) {
            setSelectedSessionIds([session1Id, session2Id]);
          }
        }
      } catch (error) {
        if (isAbortError(error)) return;
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sessions', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user?.uid, searchParams]);

  
  // Load selected sessions data with improved error handling
  useEffect(() => {
    let isMounted = true;
    
    const loadSessionsData = async () => {
      try {
        // Load all sessions in parallel for better performance
        const sessionsData = await Promise.all(
          selectedSessionIds.map(id => firebaseService.getSession(id))
        );
        
        if (!isMounted) return;
        
        setSelectedSessionsData(sessionsData.filter(s => s !== null) as Session[]);
        
        // Load all matches from selected sessions
        const matches: CompareMatch[] = [];
        sessionsData.forEach((session, sessionIndex) => {
          if (session) {
            session.matches.forEach((match) => {
              matches.push({
                ...match,
                sessionId: session.id,
                sessionName: session.sessionName,
                sessionIndex,
              });
            });
          }
        });
        setAllMatches(matches);
      } catch (error) {
        if (!isMounted || isAbortError(error)) return;
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sessions', error);
        toast.error('Failed to load some sessions');
      }
    };

    if (selectedSessionIds.length > 0) {
      loadSessionsData();
    } else {
      setSelectedSessionsData([]);
      setAllMatches([]);
    }
    
    return () => { isMounted = false; };
  }, [selectedSessionIds]);
  const addSession = (sessionId: string) => {
    if (!selectedSessionIds.includes(sessionId)) {
      setSelectedSessionIds([...selectedSessionIds, sessionId]);
    } else {
      toast.error('Session already selected');
    }
  };

  const removeSession = (sessionId: string) => {
    setSelectedSessionIds(selectedSessionIds.filter(id => id !== sessionId));
  };

  const getMetrics = (): ComparisonMetric[] => {
    const avg = (s: Session, key: keyof Match) => {
      const matches = s.matches || [];
      if (matches.length === 0) return 0;
      const total = matches.reduce((sum, m) => sum + (Number(m[key]) || 0), 0);
      return Math.round(total / matches.length);
    };

    return [
      {
        label: 'Avg Final Score',
        values: selectedSessionsData.map(s => avg(s, 'finalScore')),
        sessionIds: selectedSessionIds,
        icon: <Trophy className="w-5 h-5" />,
      },
      {
        label: 'Avg Autonomous Score',
        values: selectedSessionsData.map(s => avg(s, 'autonomousScore')),
        sessionIds: selectedSessionIds,
        icon: <Target className="w-5 h-5" />,
      },
      {
        label: 'Avg TeleOp Score',
        values: selectedSessionsData.map(s => avg(s, 'teleOpScore')),
        sessionIds: selectedSessionIds,
        icon: <Zap className="w-5 h-5" />,
      },
      {
        label: 'Avg End Game Score',
        values: selectedSessionsData.map(s => avg(s, 'endGameScore')),
        sessionIds: selectedSessionIds,
        icon: <Clock className="w-5 h-5" />,
      },
    ];
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
      >
        <div className="text-team-blue text-2xl">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.SESSIONS)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sessions
          </Button>
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-2">
            Comparison
          </h1>
          <p
            className={`text-base mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Compare sessions and matches side-by-side
          </p>
          
          {/* Comparison Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setComparisonMode('sessions')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                comparisonMode === 'sessions'
                  ? `${isDarkMode ? 'bg-team-blue-40 text-black' : 'bg-team-blue text-[#FEFEFE]'}`
                  : `${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40 text-team-white-60 hover:text-white' : 'bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900'}`
              }`}
            >
              Compare Sessions
            </button>
            <button
              onClick={() => setComparisonMode('matches')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                comparisonMode === 'matches'
                  ? `${isDarkMode ? 'bg-team-blue-40 text-black' : 'bg-team-blue text-[#FEFEFE]'}`
                  : `${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40 text-team-white-60 hover:text-white' : 'bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900'}`
              }`}
              disabled={selectedSessionIds.length === 0}
            >
              Compare Matches ({allMatches.length})
            </button>
          </div>
        </div>

        {/* Session Selector */}
        <Card
          className={`mb-8 ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
        >
          <CardHeader>
            <CardTitle
              className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Select Sessions to Compare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select onValueChange={addSession}>
                <SelectTrigger
                  className={`w-full ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
                >
                  <SelectValue placeholder="Add session..." />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}`}
                >
                  {sessions
                    .filter(s => !selectedSessionIds.includes(s.id))
                    .map(session => (
                      <SelectItem
                        key={session.id}
                        value={session.id}
                        className={`${isDarkMode ? 'text-white focus:bg-team-blue-40' : ''}`}
                      >
                        {session.sessionName || 'Unnamed Session'} -{' '}
                        {formatDate(session.createdAt)} -{' '}
                        {session.driverName || 'Unknown'} - Score:{' '}
                        {session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {selectedSessionIds.length > 0 && (
                <div className="space-y-2">
                  <p
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Selected Sessions ({selectedSessionIds.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSessionsData.map(session => (
                      <div
                        key={session.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDarkMode ? 'bg-team-blue/20 border border-team-blue-40' : 'bg-blue-100 border border-team-blue'}`}
                      >
                        <span
                          className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                        >
                          {session.sessionName || 'Unnamed'} - {formatDate(session.createdAt)}
                        </span>
                        <button
                          onClick={() => removeSession(session.id)}
                          className={`p-1 rounded-full hover:bg-red-500/20 transition-colors ${isDarkMode ? 'text-team-white-60 hover:text-red-500' : 'text-gray-600 hover:text-red-500'}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {comparisonMode === 'sessions' ? (
          selectedSessionsData.length > 0 ? (
            <div className="space-y-6">
              {/* Score Metrics Table */}
              <Card
                className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Score Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                        >
                          <th
                            className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            Score Type
                          </th>
                          {selectedSessionsData.map(session => (
                            <th
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              {session.sessionName || 'Unnamed'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            <Trophy className="w-4 h-4 text-team-blue" />
                            Final Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 font-bold text-2xl text-team-blue`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            <Target className="w-4 h-4 text-team-blue" />
                            Autonomous Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            <Zap className="w-4 h-4 text-team-blue" />
                            TeleOp Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            <Clock className="w-4 h-4 text-team-blue" />
                            End Game Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Table */}
              <Card
                className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <CardHeader
                  onClick={() => setIsDetailedBreakdownOpen(!isDetailedBreakdownOpen)}
                  className="cursor-pointer hover:bg-opacity-80 transition-all"
                >
                  <CardTitle
                    className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    <span>Detailed Breakdown</span>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${isDetailedBreakdownOpen ? 'rotate-180' : ''}`}
                    />
                  </CardTitle>
                </CardHeader>
                {isDetailedBreakdownOpen && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                        >
                          <th
                            className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            Metric
                          </th>
                          {selectedSessionsData.map(session => (
                            <th
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              {session.sessionName || 'Unnamed'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            Final Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 font-medium text-team-blue`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            Autonomous Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Classified Artifact
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.autonClassifiedArtifact || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Overflow Artifact
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.autonOverflowArtifact || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Motif
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.autonMotif || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Leave
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.autonLeave || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            TeleOp Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Classified Artifact
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.teleClassifiedArtifact || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Overflow Artifact
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.teleOverflowArtifact || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Motif
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {String(session.teleMotif || 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            End Game Score
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Hang Time
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / Math.max(session.matches.length, 1)}
                            </td>
                          ))}
                        </tr>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            Driver
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.driverName || 'N/A'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td
                            className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            Match Type
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {session.matchType || 'N/A'}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                )}
              </Card>
            </div>
          ) : (
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-team-blue text-5xl mb-4">📊</div>
                  <h3
                    className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Select Sessions to Compare
                  </h3>
                  <p
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Choose sessions from the dropdown above to see detailed
                    comparison
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          // Matches comparison mode
          allMatches.length > 0 ? (
            <div className="space-y-6">
              <Card
                className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Select Matches to Compare
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {allMatches.map((match) => (
                      <label
                        key={match.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                          selectedMatches.some(m => m.id === match.id)
                            ? `${isDarkMode ? 'bg-team-blue/20 border-team-blue-40' : 'bg-blue-50 border-team-blue'}`
                            : `${isDarkMode ? 'bg-team-dark border-team-blue-40 hover:border-team-blue' : 'bg-white border-gray-200 hover:border-team-blue'}`
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMatches.some(m => m.id === match.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMatches([...selectedMatches, match]);
                            } else {
                              setSelectedMatches(selectedMatches.filter(m => m.id !== match.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className={`flex-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {match.sessionName} - Match {match.matchNumber} (Score: {match.finalScore || 0})
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedMatches.length > 0 && (
                <>
                  {/* Match Metrics Comparison */}
                  <Card
                    className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
                  >
                    <CardHeader>
                      <CardTitle
                        className={`text-lg flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        <Trophy className="w-5 h-5 text-team-blue" />
                        Score Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {selectedMatches.map((match) => (
                          <div
                            key={match.id}
                            className={`p-4 rounded-lg ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}
                          >
                            <div
                              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              {match.sessionName} - Match {match.matchNumber}
                            </div>
                            <div className="text-3xl font-bold text-team-blue mt-2">
                              {match.finalScore || 0}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detailed Match Breakdown */}
                  <Card
                    className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
                  >
                    <CardHeader>
                      <CardTitle
                        className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        Detailed Match Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                            >
                              <th
                                className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                Metric
                              </th>
                              {selectedMatches.map(match => (
                                <th
                                  key={match.id}
                                  className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                                >
                                  {match.sessionName} - Match {match.matchNumber}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              <td
                                className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                Final Score
                              </td>
                              {selectedMatches.map(match => (
                                <td
                                  key={match.id}
                                  className={`text-right py-3 px-4 font-medium text-team-blue`}
                                >
                                  {match.finalScore || 0}
                                </td>
                              ))}
                            </tr>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              <td
                                className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                Autonomous
                              </td>
                              {selectedMatches.map(match => (
                                <td
                                  key={match.id}
                                  className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {match.autonomousScore || 0}
                                </td>
                              ))}
                            </tr>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              <td
                                className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                TeleOp
                              </td>
                              {selectedMatches.map(match => (
                                <td
                                  key={match.id}
                                  className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {match.teleOpScore || 0}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td
                                className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                End Game
                              </td>
                              {selectedMatches.map(match => (
                                <td
                                  key={match.id}
                                  className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {match.endGameScore || 0}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          ) : (
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-team-blue text-5xl mb-4">🎮</div>
                  <h3
                    className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    No Matches Found
                  </h3>
                  <p
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    The selected sessions don't have any matches recorded yet
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
};

export default Compare;
