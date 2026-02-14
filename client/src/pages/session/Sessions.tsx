import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSession, useTheme } from '@/contexts';
import { firebaseService } from '@/services';
import { formatDate, isAbortError } from '@/lib/utils';
import { UI_TIMING, APP_CONFIG, ROUTES } from '@/constants';
import type { Session } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Calendar,
  User,
  Trophy,
  Clock,
  BarChart3,
  Pencil,
  Trash2,
  Download,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface SessionCardProps {
  session: Session;
  onView: () => void;
  onNameChange: (newName: string) => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

const SessionCard = ({
  session,
  onView,
  onNameChange,
  onDelete,
  isDeleting = false,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Check if title is truncated
  useEffect(() => {
    if (titleRef.current && !isEditing) {
      const isTruncated = titleRef.current.scrollHeight > titleRef.current.clientHeight;
      setIsTitleTruncated(isTruncated);
    } else {
      setIsTitleTruncated(false);
    }
  }, [session.sessionName, isEditing]);

  // Reset delete confirmation after timeout
  useEffect(() => {
    if (deleteConfirm) {
      const timeout = setTimeout(() => setDeleteConfirm(false), UI_TIMING.DELETE_CONFIRM_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [deleteConfirm]);

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('Session name cannot be empty');
      setEditedName(session.sessionName || '');
      setIsEditing(false);
      return;
    }
    setIsSavingName(true);
    await onNameChange(editedName.trim());
    setIsSavingName(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(session.sessionName || '');
    setIsEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm) {
      onDelete();
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
    }
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(false);
  };

  // Calculate session scores from matches
  const getSessionScores = () => {
    const matches = session.matches || [];
    const scores = matches
      .map(match => match.finalScore || 0)
      .filter(score => score > 0);
    
    if (scores.length === 0) {
      return { highestScore: 0, averageScore: 0 };
    }

    const highestScore = Math.max(...scores);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    return { highestScore, averageScore };
  };

  const { highestScore, averageScore } = getSessionScores();

  const cardContent = (
    <Card
      className={`transition-all duration-300 cursor-pointer group ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark hover:border-team-blue'
          : 'border-gray-200 bg-white hover:border-team-blue'
      }`}
      onClick={onView}
    >
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div
                className="flex items-center gap-3"
                onClick={e => e.stopPropagation()}
              >
                <Input
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className={`h-10 text-xl font-semibold ${
                    isDarkMode
                      ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                      : 'bg-gray-50 border-team-blue/60 text-team-blue placeholder-team-blue-40'
                  }`}
                  autoFocus
                  onBlur={handleSaveName}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSaveName();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
              </div>
            ) : (
              <CardTitle
                ref={titleRef}
                className={`text-lg font-semibold line-clamp-3 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.sessionName || 'Untitled Session'}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {!isEditing && (
              <div className="flex items-center gap-2">
                {isSavingName ? (
                  <div className="h-4 w-4 border-2 border-team-blue border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <button
                      onClick={handleEditClick}
                      className={`p-1.5 rounded hover:bg-team-blue/20 transition-colors ${
                        isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                      } hover:text-team-blue`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className={`p-1.5 rounded transition-colors ${
                          isDeleting
                            ? 'opacity-50 cursor-not-allowed'
                            : deleteConfirm
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : `${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} hover:bg-team-blue/20 hover:text-team-blue`
                        }`}
                        title={
                          isDeleting
                            ? 'Deleting...'
                            : deleteConfirm
                              ? 'Click again to confirm delete'
                              : 'Delete session'
                        }
                      >
                        {isDeleting ? (
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                      {deleteConfirm && !isDeleting && (
                        <button
                          onClick={handleDeleteCancel}
                          className={`p-1.5 rounded hover:bg-team-blue/20 transition-colors ${
                            isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                          }`}
                          title="Cancel delete"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 bg-team-blue/15 px-4 py-2 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300">
              <Trophy className="h-5 w-5 text-team-blue group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xl font-bold text-team-blue">
                {highestScore}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
        >
          <Calendar className="h-4 w-4" />
          <span>{formatDate(session.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-6 px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="flex items-center gap-3">
            <User
              className={`h-4 w-4 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
              >
                Driver
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.driverName || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock
              className={`h-4 w-4 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
              >
                Duration
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.sessionDuration || 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BarChart3
              className={`h-4 w-4 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
              >
                Type
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.matchType || 'Practice'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Trophy
              className={`h-4 w-4 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
              >
                Avg Score
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {averageScore} pts
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isTitleTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {session.sessionName || 'Untitled Session'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
};

const LoadingCard = () => {
  const { isDarkMode } = useTheme();

  return (
    <Card
      className={`${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue/40 bg-white'}`}
    >
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-3 flex-1">
            <div className="h-6 bg-muted rounded animate-pulse w-40"></div>
          </div>
          <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
        </div>
        <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
      </CardHeader>

      <CardContent className="pt-0 pb-6 px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Sessions = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { resetSession } = useSession();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('all');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Sessions - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const userSessions = await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);
        setFilteredSessions(userSessions);
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
  }, [user?.uid]);

  useEffect(() => {
    let filtered = sessions;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        session =>
          session.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          session.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          session.matchType?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by match type
    if (selectedMatchType !== 'all') {
      filtered = filtered.filter(
        session => session.matchType?.toLowerCase() === selectedMatchType.toLowerCase()
      );
    }

    setFilteredSessions(filtered);
  }, [searchTerm, sessions, selectedMatchType]);

  const handleViewSession = (sessionId: string) => {
    navigate(`/analysis?sessionId=${sessionId}`);
  };

  const handleUpdateSessionName = async (sessionId: string, newName: string) => {
    // Store original name before optimistic update for potential revert
    const originalName = sessions.find(s => s.id === sessionId)?.sessionName;
    
    try {
      // Update local state optimistically for instant feedback
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, sessionName: newName }
            : session
        )
      );
      
      // Then update Firebase to persist changes
      const success = await firebaseService.updateSession(sessionId, { sessionName: newName });
      
      if (!success) {
        // Revert on failure using stored original name
        setSessions(prevSessions =>
          prevSessions.map(session =>
            session.id === sessionId
              ? { ...session, sessionName: originalName || newName }
              : session
          )
        );
        toast.error('Failed to update session name');
      } else {
        toast.success('Session name updated');
      }
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error updating session name', error);
      // Revert on error using stored original name
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, sessionName: originalName || newName }
            : session
        )
      );
      toast.error('Failed to update session name');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      setDeletingSessionId(sessionId);
      await firebaseService.deleteSession(sessionId);
      setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
      setFilteredSessions(prevSessions =>
        prevSessions.filter(s => s.id !== sessionId)
      );
      toast.success('Session deleted');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error deleting session', error);
      toast.error('Failed to delete session');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleExportCSV = () => {
    if (sessions.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Session Name',
      'Driver Name',
      'Match Type',
      'Final Score',
      'Autonomous Score',
      'TeleOp Score',
      'End Game Score',
      'Auton Classified Artifact',
      'Auton Overflow Artifact',
      'Auton Motif',
      'Auton Leave',
      'Tele Classified Artifact',
      'Tele Overflow Artifact',
      'Tele Motif',
      'Date',
    ];

    // Convert sessions to CSV rows with proper escaping
    const rows = sessions.map(session => {
      const finalScore = session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0);
      const autonomousScore = session.matches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0);
      const teleOpScore = session.matches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0);
      const endGameScore = session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0);
      const autonClassifiedArtifact = session.matches.reduce((sum, m) => sum + (m.autonClassifiedArtifact || 0), 0);
      const autonOverflowArtifact = session.matches.reduce((sum, m) => sum + (m.autonOverflowArtifact || 0), 0);
      const autonMotif = session.matches.reduce((sum, m) => sum + (m.autonMotif || 0), 0);
      const autonLeave = session.matches.reduce((sum, m) => sum + (m.autonLeave || 0), 0);
      const teleClassifiedArtifact = session.matches.reduce((sum, m) => sum + (m.teleClassifiedArtifact || 0), 0);
      const teleOverflowArtifact = session.matches.reduce((sum, m) => sum + (m.teleOverflowArtifact || 0), 0);
      const teleMotif = session.matches.reduce((sum, m) => sum + (m.teleMotif || 0), 0);

      return [
        `"${(session.sessionName || 'Untitled Session').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(session.driverName || 'Unknown').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(session.matchType || 'Practice').replace(/"/g, '""')}"`,
        finalScore,
        autonomousScore,
        teleOpScore,
        endGameScore,
        autonClassifiedArtifact,
        autonOverflowArtifact,
        autonMotif,
        autonLeave,
        teleClassifiedArtifact,
        teleOverflowArtifact,
        teleMotif,
        `"${formatDate(session.createdAt)}"`,
      ];
    });

    // Combine headers and rows
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join(
      '\n'
    );

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `sessions-export-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Sessions exported to CSV');
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1216px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <div>
              <h1
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                My Sessions
              </h1>
            </div>
            <div className="flex gap-1 sm:gap-2 md:gap-3 flex-wrap">
              <Button
                onClick={() => {
                  resetSession();
                  localStorage.setItem('teamtrack_new_session_created', 'true');
                  navigate(ROUTES.ACTIVE);
                }}
                className={`bg-team-blue hover:bg-team-blue/90 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-none min-h-[40px] sm:min-h-[44px] ${isDarkMode ? '!text-[#191919]' : '!text-[#FEFEFE]'}`}
              >
                <Plus className="h-3 sm:h-4 w-3 sm:w-4" />
                <span className="hidden sm:inline">New Session</span>
                <span className="sm:hidden">New</span>
              </Button>
              {sessions.length > 0 && (
                <Button
                  onClick={() => navigate(ROUTES.CHARTS)}
                  className={`border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode
                      ? 'text-team-blue border-team-blue-40'
                      : 'text-team-blue border-team-blue-40'
                  }`}
                  variant="outline"
                >
                  <TrendingUp className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Charts</span>
                  <span className="sm:hidden">Stats</span>
                </Button>
              )}
              {sessions.length > 1 && (
                <Button
                  onClick={() => navigate(ROUTES.COMPARE)}
                  className={`border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode
                      ? 'text-team-blue border-team-blue-40'
                      : 'text-team-blue border-team-blue-40'
                  }`}
                  variant="outline"
                >
                  <BarChart3 className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Compare</span>
                  <span className="sm:hidden">Comp</span>
                </Button>
              )}
              {sessions.length > 0 && (
                <Button
                  onClick={handleExportCSV}
                  className={`border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode
                      ? 'text-team-blue border-team-blue-40'
                      : 'text-team-blue border-team-blue-40'
                  }`}
                  variant="outline"
                >
                  <Download className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Export</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {!loading && sessions.length > 0 && (
          <div
            className={`mb-6 p-4 sm:p-6 lg:p-8 rounded-2xl border shadow-lg ${
              isDarkMode
                ? 'bg-team-dark-20 border-team-blue-40'
                : 'bg-white border-gray-200'
            }`}
          >
            <h3
              className={`text-lg sm:text-xl font-semibold mb-4 sm:mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {sessions.length}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Total Sessions
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {(() => {
                    const allScores = sessions.flatMap(s => 
                      (s.matches || []).map(m => m.finalScore || 0)
                    ).filter(score => score > 0);
                    return allScores.length > 0 
                      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) 
                      : 0;
                  })()}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Avg Score
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {(() => {
                    const allScores = sessions.flatMap(s => 
                      (s.matches || []).map(m => m.finalScore || 0)
                    );
                    return allScores.length > 0 ? Math.max(...allScores) : 0;
                  })()}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Best Score
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {
                    sessions.reduce((total, s) => total + (s.matches?.length || 0), 0)
                  }
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Total Matches
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search
                className={`absolute left-2 sm:left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
              />
              <Input
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`pl-8 sm:pl-10 md:pl-12 h-9 sm:h-10 md:h-12 text-xs sm:text-sm md:text-base rounded-xl shadow-md transition-all duration-300 focus:shadow-lg ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue'
                    : 'bg-white border-gray-200 text-team-blue placeholder-gray-400 focus:border-team-blue'
                }`}
              />
            </div>
            <Select
              value={selectedMatchType}
              onValueChange={setSelectedMatchType}
            >
              <SelectTrigger
                className={`w-full sm:w-auto h-9 sm:h-10 md:h-12 text-xs sm:text-sm md:text-base rounded-xl shadow-md border ${
                  isDarkMode
                    ? 'bg-team-dark border-team-blue-40 text-white'
                    : 'bg-white border-gray-300 text-team-blue'
                }`}
              >
                <SelectValue placeholder="All Match Types" />
              </SelectTrigger>
              <SelectContent
                className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-300'}`}
              >
                <SelectItem value="all">All Match Types</SelectItem>
                <SelectItem value="autonomous">Autonomous</SelectItem>
                <SelectItem value="teleop">TeleOp</SelectItem>
                <SelectItem value="full game">Full Game</SelectItem>
                <SelectItem value="practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div
              className={`mx-auto w-16 sm:w-24 h-16 sm:h-24 rounded-full flex items-center justify-center mb-4 ${
                isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'
              }`}
            >
              <BarChart3
                className={`h-8 sm:h-12 w-8 sm:w-12 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
              />
            </div>
            <h3
              className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              {searchTerm ? 'No sessions found' : 'No sessions yet'}
            </h3>
            <p
              className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            >
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Start tracking your practice sessions to see them here'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => {
                  resetSession();
                  localStorage.setItem('teamtrack_new_session_created', 'true');
                  navigate('/active');
                }}
                className="bg-team-blue hover:bg-team-blue/90"
                style={{ color: isDarkMode ? '#191919' : '#FFFFFF' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Session
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onView={() => handleViewSession(session.id)}
                onNameChange={newName =>
                  handleUpdateSessionName(session.id, newName)
                }
                onDelete={() => handleDeleteSession(session.id)}
                isDeleting={deletingSessionId === session.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
