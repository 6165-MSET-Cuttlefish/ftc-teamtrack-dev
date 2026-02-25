import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSession, useTheme, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import { TeamManager } from '@/components';
import { formatDate, isAbortError, generateShareableLink, copyToClipboard, logger } from '@/lib';
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
  Trophy,
  Clock,
  BarChart3,
  Pencil,
  Trash2,
  Download,
  TrendingUp,
  Hash,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SessionCardProps {
  session: Session;
  onView: () => void;
  onNameChange: (newName: string) => void;
  onDelete: () => void;
  onShare: () => void;
  isDeleting?: boolean;
  ownerName?: string;
}

const SessionCard = ({
  session,
  onView,
  onNameChange,
  onDelete,
  onShare,
  isDeleting = false,
  ownerName,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (titleRef.current && !isEditing) {
      const isTruncated = titleRef.current.scrollHeight > titleRef.current.clientHeight;
      setIsTitleTruncated(isTruncated);
    } else {
      setIsTitleTruncated(false);
    }
  }, [session.sessionName, isEditing]);

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

  const getSessionScores = () => {
    const matches = session.matches || [];
    const scores = matches
      .map(match => match.finalScore || 0);
    
    if (scores.length === 0) {
      return { highestScore: 0, averageScore: 0, totalScore: 0, matchCount: matches.length };
    }

    const totalScore = scores.reduce((a, b) => a + b, 0);
    const highestScore = Math.max(...scores);
    const averageScore = Math.round(totalScore / scores.length);
    
    return { highestScore, averageScore, totalScore, matchCount: matches.length };
  };

  const { highestScore, averageScore, totalScore, matchCount } = getSessionScores();

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
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare();
                      }}
                      className={`p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
                        isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                      } hover:text-team-blue`}
                      title="Share session"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleEditClick}
                      className={`p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
                        isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                      } hover:text-team-blue`}
                      title="Edit session name"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className={`p-1.5 rounded-lg transition-all transform hover:scale-110 ${
                          isDeleting
                            ? 'opacity-50 cursor-not-allowed'
                            : deleteConfirm
                              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                              : `${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} hover:bg-red-500/20 hover:text-red-500`
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
                          className={`p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
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
          className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
        >
          <Calendar className="h-4 w-4" />
          <span>{formatDate(session.createdAt)}</span>
          {ownerName && (
            <>
              <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>·</span>
              <span>{ownerName}</span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-6 px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="flex items-center gap-3">
            <TrendingUp
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Total Score
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {totalScore} pts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Trophy
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
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

          <div className="flex items-center gap-3">
            <Hash
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Matches
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {matchCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
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
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { resetSession, hasActiveSession } = useSession();
  const { team } = useTeam();
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

  const loadPersonalSessions = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    if (!user?.uid) return;

    setLoading(true);
    try {
      const fetchedSessions = await firebaseService.getUserSessions(user.uid);
      setSessions(fetchedSessions);
      setFilteredSessions(fetchedSessions);
    } catch (error) {
      if (isAbortError(error)) return;
      const { logger } = await import('@/lib/logger');
      logger.error('Error loading sessions', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isGuest]);

  const loadSessions = useCallback(async () => {
    if (!user?.uid) return;
    if (!team) {
      await loadPersonalSessions();
    }
  }, [user?.uid, team, loadPersonalSessions]);

  useEffect(() => {
    if (!team) return;

    setLoading(true);
    let unsubscribe: (() => void) | undefined;
    let subscribed = false;

    firebaseService
      .subscribeTeamSessions(
        team.id,
        (teamSessions) => {
          subscribed = true;
          setSessions(teamSessions);
          setFilteredSessions(teamSessions);
          setLoading(false);
        },
        async (error) => {
          logger.error('Team sessions listener error:', { error: String(error) });
          const errorMessage = error?.message || 'Unknown error';
          if (errorMessage.includes('index')) {
            toast.error('Firestore needs a composite index for team sessions. Check the browser console for the creation link.', { duration: 10000 });
          } else {
            toast.error(`Team sync error: ${errorMessage}`);
          }
          if (!subscribed) {
            try {
              const fetched = await firebaseService.getTeamSessions(team.id);
              setSessions(fetched);
              setFilteredSessions(fetched);
            } catch { /* fallback fetch already attempted */ }
          }
          setLoading(false);
        }
      )
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => {
      unsubscribe?.();
    };
  }, [team]);

  useEffect(() => {
    if (!team) {
      loadPersonalSessions();
    }
  }, [team, loadPersonalSessions]);

  useEffect(() => {
    let filtered = sessions;

    if (searchTerm.trim()) {
      filtered = filtered.filter(
        session =>
          session.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          session.matchType?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

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
    const originalName = sessions.find(s => s.id === sessionId)?.sessionName;
    
    try {
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, sessionName: newName }
            : session
        )
      );
      
      const success = await firebaseService.updateSession(sessionId, { sessionName: newName });
      
      if (!success) {
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

  const handleShareSession = async (session: Session) => {
    try {
      const shareLink = await generateShareableLink(session);
      await copyToClipboard(shareLink);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error sharing session', error);
      toast.error('Failed to generate share link');
    }
  };

  /** Helper: get display name for a session's owner from team members */
  const getSessionOwnerName = (session: Session): string | undefined => {
    if (!team) return undefined;
    const member = team.members.find(m => m.userId === session.userId);
    return member?.displayName || member?.email || session.userEmail || undefined;
  };

  const handleExportCSV = () => {
    if (sessions.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    const esc = (val: string) => {
      let safe = val.replace(/"/g, '""').replace(/\n/g, ' ');
      if (/^[=+\-@\t\r]/.test(safe)) {
        safe = `'${safe}`;
      }
      return `"${safe}"`;
    };
    const headers = [
      'Session Name',
      'Session Date',
      'Session Duration',
      'Match Type',
      'Match Number',
      'Final Score',
      'Autonomous Score',
      'Teleop Score',
      'Endgame Score',
      'Auton Classified Artifact',
      'Auton Overflow Artifact',
      'Auton Motif',
      'Auton Leave',
      'Auton Balls Missed',
      'Tele Classified Artifact',
      'Tele Overflow Artifact',
      'Tele Motif',
      'Tele Balls Missed',
      'Robot 1 Park',
      'Robot 2 Park',
      'Cycle Times',
      'Auton Shots (Made/Shot)',
      'Teleop Shots (Made/Shot)',
      'Notes',
      'User Email',
    ];

    const rows: string[][] = [];

    for (const session of sessions) {
      const sessionDate = esc(formatDate(session.createdAt));
      const sessionName = esc(session.sessionName || 'Untitled Session');
      const sessionDuration = esc(session.sessionDuration || '');
      const matchType = esc(session.matchType || 'Full Game');
      const notes = esc(session.notes || '');
      const email = esc(session.userEmail || '');

      if (!session.matches || session.matches.length === 0) {
        rows.push([
          sessionName, sessionDate, sessionDuration, matchType,
          '0', '0', '0', '0', '0',
          '0', '0', '0', '0', '0',
          '0', '0', '0', '0',
          '"none"', '"none"',
          '""', '""', '""',
          notes, email,
        ]);
      } else {
        for (const match of session.matches) {
          const cycleTimes = (match.cycleTimes || []).join('; ');
          const autonShots = (match.autonShots || []).map(s => `${s.ballsMade}/${s.ballsShot}`).join('; ');
          const teleopShots = (match.teleopShots || []).map(s => `${s.ballsMade}/${s.ballsShot}`).join('; ');

          rows.push([
            sessionName,
            sessionDate,
            sessionDuration,
            esc(match.matchType || session.matchType || 'Full Game'),
            String(match.matchNumber || 0),
            String(match.finalScore || 0),
            String(match.autonomousScore || 0),
            String(match.teleopScore || 0),
            String(match.endGameScore || 0),
            String(match.autonClassifiedArtifact || 0),
            String(match.autonOverflowArtifact || 0),
            String(match.autonMotif || 0),
            String(match.autonLeave || 0),
            String(match.autonBallsMissed || 0),
            String(match.teleClassifiedArtifact || 0),
            String(match.teleOverflowArtifact || 0),
            String(match.teleMotif || 0),
            String(match.teleBallsMissed || 0),
            esc(match.robot1Park || 'none'),
            esc(match.robot2Park || 'none'),
            esc(cycleTimes),
            esc(autonShots),
            esc(teleopShots),
            notes,
            email,
          ]);
        }
      }
    }

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

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
    URL.revokeObjectURL(url);

    toast.success('Sessions exported to CSV');
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex flex-col gap-3">
              <h1
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {team ? team.name : 'My Sessions'}
              </h1>
              {!isGuest && <TeamManager onTeamChange={() => loadSessions()} />}
            </div>
            <div className="flex gap-1 sm:gap-2 md:gap-3 flex-wrap">
              {sessions.length > 0 && (
                <Button
                  onClick={() => navigate(ROUTES.CHARTS)}
                  className={`bg-team-blue hover:bg-team-blue/90 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 md:px-4 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode ? '!text-black' : '!text-white'
                  }`}
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
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
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
                    );
                    return allScores.length > 0 
                      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) 
                      : 0;
                  })()}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
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
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
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
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Total Matches
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search
                className={`absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
              />
              <Input
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`pl-10 md:pl-12 h-10 md:h-11 text-sm md:text-base rounded-xl shadow-sm transition-all duration-200 focus:shadow-md ${
                  isDarkMode
                    ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-team-blue'
                }`}
              />
            </div>
            <Select
              value={selectedMatchType}
              onValueChange={setSelectedMatchType}
            >
              <SelectTrigger
                className={`w-full sm:w-[180px] h-10 md:h-11 text-sm md:text-base rounded-xl shadow-sm border ${
                  isDarkMode
                    ? 'bg-team-dark border-team-blue-40 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <SelectValue placeholder="All Match Types" />
              </SelectTrigger>
              <SelectContent
                className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <SelectItem value="all">All Match Types</SelectItem>
                <SelectItem value="full game">Full Game</SelectItem>
                <SelectItem value="autonomous">Autonomous</SelectItem>
                <SelectItem value="teleop">Teleop</SelectItem>
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
                : isGuest
                  ? 'Create an account to save your practice sessions'
                  : 'Start tracking your practice sessions to see them here'}
            </p>
            {!searchTerm && !isGuest && (
              <Button
                onClick={() => {
                  resetSession();
                  navigate(ROUTES.ACTIVE);
                }}
                disabled={hasActiveSession}
                title={hasActiveSession ? 'Complete or cancel the active session first' : undefined}
                className={`bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Session
              </Button>
            )}
            {!searchTerm && isGuest && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button
                  onClick={() => navigate('/signup')}
                  className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  Sign Up to Save Sessions
                </Button>
                <Button
                  onClick={() => navigate('/active')}
                  variant="outline"
                  className={
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                      : 'border-gray-300'
                  }
                >
                  Start Practice Session
                </Button>
              </div>
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
                onShare={() => handleShareSession(session)}
                onDelete={() => handleDeleteSession(session.id)}
                isDeleting={deletingSessionId === session.id}
                ownerName={getSessionOwnerName(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
