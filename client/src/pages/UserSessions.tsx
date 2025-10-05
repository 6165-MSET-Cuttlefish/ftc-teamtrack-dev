import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useApi } from '../hooks/useApi';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import {
  Calendar,
  Clock,
  User,
  Trophy,
  Target,
  Zap,
  Award,
  TrendingUp,
  BarChart3,
  Filter,
  Search,
} from 'lucide-react';

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

const UserSessions: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { getSessions, loading } = useApi();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSession(null);
  };

  const getSessionStats = () => {
    if (sessions.length === 0) return null;

    const totalSessions = sessions.length;
    const averageScore =
      sessions.reduce((sum, s) => sum + s.finalScore, 0) / totalSessions;
    const highestScore = Math.max(...sessions.map(s => s.finalScore));
    const totalPlayTime = sessions.reduce((total, session) => {
      const [minutes, seconds] = session.sessionDuration.split(':').map(Number);
      return total + minutes * 60 + seconds;
    }, 0);

    const matchTypeBreakdown = sessions.reduce(
      (acc, session) => {
        acc[session.matchType] = (acc[session.matchType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalSessions,
      averageScore: Math.round(averageScore),
      highestScore,
      totalPlayTime: Math.round(totalPlayTime / 60),
      matchTypeBreakdown,
    };
  };

  const stats = getSessionStats();

  useEffect(() => {
    const fetchUserSessions = async () => {
      if (user?.uid) {
        try {
          const result = await getSessions(user.uid);
          setSessions((result as Session[]) || []);
        } catch (error) {
          console.error('Failed to fetch sessions:', error);
        }
      }
    };

    fetchUserSessions();
  }, [user?.uid, getSessions]);

  useEffect(() => {
    let filtered = [...sessions];

    if (searchTerm) {
      filtered = filtered.filter(
        session =>
          session.sessionName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          session.driverName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (matchTypeFilter !== 'all') {
      filtered = filtered.filter(
        session =>
          session.matchType.toLowerCase() === matchTypeFilter.toLowerCase()
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'highest-score':
          return b.finalScore - a.finalScore;
        case 'lowest-score':
          return a.finalScore - b.finalScore;
        case 'duration':
          return b.sessionDuration.localeCompare(a.sessionDuration);
        default:
          return 0;
      }
    });

    setFilteredSessions(filtered);
  }, [sessions, searchTerm, matchTypeFilter, sortBy]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType.toLowerCase()) {
      case 'autonomous':
        return 'bg-blue-100 text-blue-800';
      case 'teleop':
        return 'bg-green-100 text-green-800';
      case 'practice':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} py-12 px-4 sm:px-6 lg:px-8`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            My Sessions
          </h1>
          <p
            className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
          >
            View and manage your training sessions
          </p>
        </div>

        {stats && (
          <div
            className={`p-6 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#FEFEFE] border-gray-200'}`}
          >
            <h2
              className={`text-xl font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              <TrendingUp className="h-5 w-5 text-team-blue" />
              Performance Overview
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div
                className={`text-center p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <div className={`text-2xl font-bold text-team-blue`}>
                  {stats.totalSessions}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Total Sessions
                </div>
              </div>

              <div
                className={`text-center p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <div className={`text-2xl font-bold text-green-600`}>
                  {stats.averageScore}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Avg Score
                </div>
              </div>

              <div
                className={`text-center p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <div className={`text-2xl font-bold text-purple-600`}>
                  {stats.highestScore}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Best Score
                </div>
              </div>

              <div
                className={`text-center p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <div className={`text-2xl font-bold text-orange-600`}>
                  {stats.totalPlayTime}m
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Total Practice
                </div>
              </div>
            </div>

            <div>
              <h3
                className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Session Types
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats.matchTypeBreakdown).map(
                  ([type, count]) => (
                    <div
                      key={type}
                      className={`flex items-center justify-between p-2 rounded ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}
                    >
                      <span
                        className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        {type}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#FEFEFE] border-gray-200'}`}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span
                className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Filters:
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sessions or drivers..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`pl-10 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                />
              </div>

              <Select
                value={matchTypeFilter}
                onValueChange={setMatchTypeFilter}
              >
                <SelectTrigger
                  className={`w-40 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                >
                  <SelectValue placeholder="Match Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="autonomous">Autonomous</SelectItem>
                  <SelectItem value="teleop">Teleop</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="full game">Full Game</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger
                  className={`w-44 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="highest-score">Highest Score</SelectItem>
                  <SelectItem value="lowest-score">Lowest Score</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className={`mt-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Showing {filteredSessions.length} of {sessions.length} sessions
          </div>
        </div>

        <div
          className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-h-[48rem]`}
        >
          {loading ? (
            // Keep skeletons rendered with fixed height to avoid layout shifts
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-64">
                <Skeleton className="h-64" />
              </div>
            ))
          ) : filteredSessions.length > 0 ? (
            filteredSessions.map(session => (
              <Card
                key={session.id}
                className={`hover:shadow-lg transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={`text-lg ${isDarkMode ? 'text-white' : ''}`}
                    >
                      {session.sessionName}
                    </CardTitle>
                    <Badge className={getMatchTypeColor(session.matchType)}>
                      {session.matchType}
                    </Badge>
                  </div>
                  <CardDescription
                    className={isDarkMode ? 'text-gray-400' : ''}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(session.createdAt)}
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span
                        className={
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }
                      >
                        {session.driverName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span
                        className={
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }
                      >
                        {session.sessionDuration}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span
                        className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        Final Score:
                      </span>
                      <span
                        className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        {session.finalScore}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Auto Basket:
                        </span>
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          {session.autonBasket}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Auto Specimen:
                        </span>
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          {session.autonSpeci}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Tele Basket:
                        </span>
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          {session.teleBasket}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Endgame:
                        </span>
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          {session.endgameHang}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
                      onClick={() => handleSessionClick(session)}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : sessions.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Trophy
                className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}
              />
              <h3
                className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
              >
                No sessions yet
              </h3>
              <p
                className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Get started by creating your first training session.
              </p>
              <div className="mt-6">
                <Button
                  className="bg-team-blue hover:bg-team-blue/90"
                  onClick={() => (window.location.href = '/')}
                >
                  Start New Session
                </Button>
              </div>
            </div>
          ) : (
            <div className="col-span-full text-center py-12">
              <Trophy
                className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}
              />
              <h3
                className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
              >
                No sessions match your filters
              </h3>
              <p
                className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className={`max-w-4xl max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
        >
          <DialogHeader>
            <DialogTitle
              className={`text-2xl ${isDarkMode ? 'text-white' : ''}`}
            >
              {selectedSession?.sessionName || 'Session Details'}
            </DialogTitle>
            <DialogDescription className={isDarkMode ? 'text-gray-400' : ''}>
              Detailed performance analysis and statistics
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-6">
              <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {selectedSession.finalScore}
                  </div>
                  <div
                    className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Final Score
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {selectedSession.driverName}
                  </div>
                  <div
                    className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Driver
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {selectedSession.sessionDuration}
                  </div>
                  <div
                    className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Duration
                  </div>
                </div>
                <div className="text-center">
                  <Badge
                    className={getMatchTypeColor(selectedSession.matchType)}
                  >
                    {selectedSession.matchType}
                  </Badge>
                  <div
                    className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Match Type
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3
                  className={`text-lg font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <BarChart3 className="h-5 w-5" />
                  Performance Breakdown
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-[#FEFEFE] border-gray-200'}`}
                  >
                    <h4
                      className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      <Zap className="h-4 w-4 text-blue-500" />
                      Autonomous Phase
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Basket Scores
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(selectedSession.autonBasket / 10) * 100}
                            className="w-20 h-2"
                          />
                          <span
                            className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {selectedSession.autonBasket}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Specimen Scores
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(selectedSession.autonSpeci / 10) * 100}
                            className="w-20 h-2"
                          />
                          <span
                            className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {selectedSession.autonSpeci}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-[#FEFEFE] border-gray-200'}`}
                  >
                    <h4
                      className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      <Target className="h-4 w-4 text-green-500" />
                      Teleop Phase
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Basket Scores
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(selectedSession.teleBasket / 20) * 100}
                            className="w-20 h-2"
                          />
                          <span
                            className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {selectedSession.teleBasket}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }
                        >
                          Specimen Scores
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(selectedSession.teleSpeci / 20) * 100}
                            className="w-20 h-2"
                          />
                          <span
                            className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {selectedSession.teleSpeci}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-[#FEFEFE] border-gray-200'}`}
                >
                  <h4
                    className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    <Award className="h-4 w-4 text-purple-500" />
                    Endgame Performance
                  </h4>
                  <div className="flex justify-between items-center">
                    <span
                      className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}
                    >
                      Hanging Points
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(selectedSession.endgameHang / 30) * 100}
                        className="w-20 h-2"
                      />
                      <span
                        className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        {selectedSession.endgameHang}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div
                className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-[#FEFEFE]'}`}
              >
                <h4
                  className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Session Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}
                    >
                      Created:
                    </span>
                    <span
                      className={isDarkMode ? 'text-gray-300' : 'text-gray-800'}
                    >
                      {formatDate(selectedSession.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}
                    >
                      Session ID:
                    </span>
                    <span
                      className={`font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}
                    >
                      {selectedSession.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSessions;
