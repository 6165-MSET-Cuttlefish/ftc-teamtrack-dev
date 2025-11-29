import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { firebaseService, SessionData } from '../services/firebaseService';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

const toDate = (timestamp: unknown): Date => {
  if (!timestamp) return new Date();

  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }

  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as FirebaseTimestamp;
    if ('seconds' in ts && 'nanoseconds' in ts) {
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    }
  }

  return new Date();
};

interface SessionCardProps {
  session: SessionData;
  onView: () => void;
  onNameChange: (newName: string) => void;
  onDelete: () => void;
}

const SessionCard = ({
  session,
  onView,
  onNameChange,
  onDelete,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'Unknown date';

    const date = toDate(timestamp);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSaveName = () => {
    if (!editedName.trim()) {
      toast.error('Session name cannot be empty');
      setEditedName(session.sessionName || '');
      setIsEditing(false);
      return;
    }
    onNameChange(editedName.trim());
    setIsEditing(false);
    toast.success('Session name updated');
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

  return (
    <Card
      className={`transition-all duration-200 cursor-pointer ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark hover:border-team-blue hover:shadow-lg'
          : 'border-team-blue/40 bg-white hover:border-team-blue hover:shadow-lg'
      }`}
      onClick={onView}
    >
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
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
              <div className="flex items-center gap-2">
                <CardTitle
                  className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                >
                  {session.sessionName || 'Untitled Session'}
                </CardTitle>
                <button
                  onClick={handleEditClick}
                  className={`p-1.5 rounded hover:bg-team-blue/20 transition-colors ${
                    isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                  } hover:text-team-blue`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1 w-16">
                  <button
                    onClick={handleDeleteClick}
                    className={`p-1.5 rounded flex-1 transition-colors ${
                      deleteConfirm
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : `${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} hover:bg-team-blue/20 hover:text-team-blue`
                    }`}
                    title={
                      deleteConfirm
                        ? 'Click again to confirm delete'
                        : 'Delete session'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {deleteConfirm && (
                    <button
                      onClick={handleDeleteCancel}
                      className={`p-1.5 rounded flex-1 hover:bg-team-blue/20 transition-colors ${
                        isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                      }`}
                      title="Cancel delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-team-blue/10 px-3 py-1.5 rounded-lg">
            <Trophy className="h-5 w-5 text-team-blue" />
            <span className="text-lg font-semibold text-team-blue">
              {session.finalScore || 0}
            </span>
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
                Score
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.finalScore || 0} pts
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
  const { resetSession, sessionData } = useSession();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Check if there's an active session
  const hasActiveSession = sessionData && !sessionData.isSessionCompleted;

  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const userSessions = await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);
        setFilteredSessions(userSessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user?.uid]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessions);
      return;
    }

    const filtered = sessions.filter(
      session =>
        session.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.matchType?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredSessions(filtered);
  }, [searchTerm, sessions]);

  const handleViewSession = (sessionId: string) => {
    navigate(`/analysis?sessionId=${sessionId}`);
  };

  const handleUpdateSessionName = (sessionId: string, newName: string) => {
    // Update local state only (frontend only - no database save)
    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId
          ? { ...session, sessionName: newName }
          : session
      )
    );

    setFilteredSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId
          ? { ...session, sessionName: newName }
          : session
      )
    );
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await firebaseService.deleteSession(sessionId);
      setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
      setFilteredSessions(prevSessions =>
        prevSessions.filter(s => s.id !== sessionId)
      );
      toast.success('Session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                My Sessions
              </h1>
            </div>
            <Button
              onClick={() => {
                if (hasActiveSession) {
                  // If there's an active session, go to it
                  navigate('/original');
                } else {
                  // If no active session, reset and create new
                  resetSession();
                  navigate('/original');
                }
              }}
              className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
            >
              {!hasActiveSession && <Plus className="h-4 w-4 mr-2" />}
              {hasActiveSession ? 'Current Session' : 'New Session'}
            </Button>
          </div>
        </div>

        {!loading && sessions.length > 0 && (
          <div
            className={`mb-6 p-6 rounded-lg border ${
              isDarkMode
                ? 'bg-team-dark-20 border-team-blue-40'
                : 'bg-white border-team-blue/40'
            }`}
          >
            <h3
              className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {sessions.length}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Total Sessions
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {Math.round(
                    sessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
                      sessions.length
                  ) || 0}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Avg Score
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {Math.max(...sessions.map(s => s.finalScore || 0)) || 0}
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Best Score
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {
                    sessions.filter(s => s.matchType?.toLowerCase() === 'match')
                      .length
                  }
                </div>
                <div
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Matches
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
            />
            <Input
              placeholder="Search sessions by name, driver, or type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`pl-10 ${
                isDarkMode
                  ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                  : 'bg-white border-team-blue/60 text-team-blue placeholder-team-blue-40'
              }`}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <div
              className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
                isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'
              }`}
            >
              <BarChart3
                className={`h-12 w-12 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
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
                onClick={() => navigate('/original')}
                className="bg-team-blue hover:bg-team-blue/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Session
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onView={() => handleViewSession(session.id)}
                onNameChange={newName =>
                  handleUpdateSessionName(session.id, newName)
                }
                onDelete={() => handleDeleteSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
