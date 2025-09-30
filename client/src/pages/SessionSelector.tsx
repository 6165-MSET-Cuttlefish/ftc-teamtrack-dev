import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSessions } from '../hooks/useSessions';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  Calendar,
  Clock,
  User,
  Trophy,
  Filter,
  Search,
  CheckSquare,
  ArrowLeft,
  BarChart3,
  Eye,
  GitCompare,
} from 'lucide-react';
import SessionExport from '../components/SessionExport';

const SessionSelector: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const {
    sessions: filteredSessions,
    loading,
    hasMore,
    filters,
    updateFilters,
    loadMore,
    rawSessions: sessions,
  } = useSessions();

  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    new Set()
  );
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple'>(
    'multiple'
  );

  const handleSessionToggle = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);

    if (selectionMode === 'single') {
      newSelected.clear();
      if (!selectedSessions.has(sessionId)) {
        newSelected.add(sessionId);
      }
    } else {
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
    }

    setSelectedSessions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSessions.size === filteredSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedSessions(new Set());
  };

  const getSelectedSessionsData = () => {
    return filteredSessions.filter(session => selectedSessions.has(session.id));
  };

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
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'teleop':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'practice':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'full game':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading && filteredSessions.length === 0) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
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
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/sessions')}
              className={isDarkMode ? 'text-gray-300 hover:text-white' : ''}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Button>
            <div>
              <h1
                className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Select Sessions
              </h1>
              <p
                className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Choose sessions for comparison, analysis, or other actions
              </p>
            </div>
          </div>
        </div>

        {/* Selection Controls */}
        <div
          className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-team-blue" />
                <span
                  className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {selectedSessions.size} selected
                </span>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-2">
                <label
                  className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Mode:
                </label>
                <Select
                  value={selectionMode}
                  onValueChange={(value: 'single' | 'multiple') => {
                    setSelectionMode(value);
                    if (value === 'single' && selectedSessions.size > 1) {
                      setSelectedSessions(
                        new Set([Array.from(selectedSessions)[0]])
                      );
                    }
                  }}
                >
                  <SelectTrigger
                    className={`w-32 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="multiple">Multiple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectionMode === 'multiple' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className={
                      isDarkMode
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : ''
                    }
                  >
                    {selectedSessions.size === filteredSessions.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    disabled={selectedSessions.size === 0}
                    className={
                      isDarkMode
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : ''
                    }
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Selection */}
        {selectedSessions.size > 0 && (
          <div
            className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          >
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                What would you like to do with the selected sessions?
              </span>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/sessions/compare?ids=${Array.from(selectedSessions).join(',')}`
                    )
                  }
                  disabled={selectedSessions.size < 2}
                  className={
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : ''
                  }
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare ({selectedSessions.size})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate('/analysis', {
                      state: { selectedSessions: getSelectedSessionsData() },
                    })
                  }
                  className={
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : ''
                  }
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analyze
                </Button>

                <SessionExport
                  sessions={getSelectedSessionsData()}
                  userId={user?.uid}
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate('/sessions', {
                      state: { selectedSessions: getSelectedSessionsData() },
                    })
                  }
                  className={
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : ''
                  }
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div
          className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
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
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sessions or drivers..."
                  value={filters.searchTerm}
                  onChange={e => updateFilters({ searchTerm: e.target.value })}
                  className={`pl-10 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                />
              </div>

              {/* Match Type Filter */}
              <Select
                value={filters.matchType}
                onValueChange={value => updateFilters({ matchType: value })}
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

              {/* Sort By */}
              <Select
                value={filters.sortBy}
                onValueChange={value => updateFilters({ sortBy: value })}
              >
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

            {/* Date Range Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <span
                className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Date Range:
              </span>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => updateFilters({ dateFrom: e.target.value })}
                  className={`w-40 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  placeholder="From"
                />
                <span
                  className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}
                >
                  to
                </span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => updateFilters({ dateTo: e.target.value })}
                  className={`w-40 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  placeholder="To"
                />
                {(filters.dateFrom || filters.dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateFilters({ dateFrom: '', dateTo: '' })}
                    className={
                      isDarkMode ? 'text-gray-400 hover:text-white' : ''
                    }
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Results count */}
          <div
            className={`mt-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Showing {filteredSessions.length} of {sessions.length} sessions
          </div>
        </div>

        {/* Sessions Grid */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <Trophy
              className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}
            />
            <h3
              className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
            >
              No sessions found
            </h3>
            <p
              className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map(session => (
              <Card
                key={session.id}
                className={`relative cursor-pointer transition-all duration-200 ${
                  selectedSessions.has(session.id)
                    ? 'ring-2 ring-team-blue border-team-blue'
                    : 'hover:shadow-lg'
                } ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'hover:border-gray-300'}`}
                onClick={() => handleSessionToggle(session.id)}
              >
                {/* Selection Indicator */}
                <div className="absolute top-3 left-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedSessions.has(session.id)
                        ? 'bg-team-blue border-team-blue'
                        : `border-gray-300 ${isDarkMode ? 'border-gray-600' : ''}`
                    }`}
                  >
                    {selectedSessions.has(session.id) && (
                      <CheckSquare className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>

                <CardHeader className="pb-3 pl-12">
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
                  {/* Driver and Duration */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-gray-400" />
                      <span
                        className={
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }
                      >
                        {session.driverName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
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

                  {/* Score */}
                  <div className="text-center">
                    <div
                      className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      {session.finalScore}
                    </div>
                    <div
                      className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      Final Score
                    </div>
                  </div>

                  {/* Performance Summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      className={`text-center p-2 rounded ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
                    >
                      <div className="font-semibold text-blue-600">
                        {session.autonBasket + session.autonSpeci}
                      </div>
                      <div
                        className={
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }
                      >
                        Auton
                      </div>
                    </div>
                    <div
                      className={`text-center p-2 rounded ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
                    >
                      <div className="font-semibold text-green-600">
                        {session.teleBasket + session.teleSpeci}
                      </div>
                      <div
                        className={
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }
                      >
                        Teleop
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && filteredSessions.length > 0 && (
          <div className="flex justify-center mt-8">
            <Button
              onClick={loadMore}
              disabled={loading}
              variant="outline"
              className={`${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
            >
              {loading ? 'Loading...' : 'Load More Sessions'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionSelector;
