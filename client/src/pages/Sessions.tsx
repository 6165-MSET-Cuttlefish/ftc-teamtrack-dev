import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { firebaseService, SessionData } from '../services/firebaseService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Search, Plus, Calendar, User, Trophy, Clock, BarChart3 } from 'lucide-react';
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
}

const SessionCard = ({ session, onView }: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  
  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'Unknown date';
    
    const date = toDate(timestamp);
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card 
      className={`transition-all duration-200 cursor-pointer ${
        isDarkMode 
          ? 'border-team-white-20 hover:border-team-blue-40 hover:shadow-lg' 
          : 'border-muted hover:border-team-blue/40 hover:shadow-lg'
      }`}
      onClick={onView}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              {session.sessionName || 'Untitled Session'}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(session.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-team-blue" />
            <span className="text-sm font-medium text-team-blue">
              {session.finalScore || 0}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Driver:</span>
            <span>{session.driverName || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span>{session.sessionDuration || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Type:</span>
            <span>{session.matchType || 'Practice'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Trophy className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Score:</span>
            <span>{session.finalScore || 0} pts</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingCard = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <Card className={isDarkMode ? 'border-team-white-20' : 'border-muted'}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 bg-muted rounded animate-pulse w-32"></div>
            <div className="h-3 bg-muted rounded animate-pulse w-24"></div>
          </div>
          <div className="h-4 bg-muted rounded animate-pulse w-12"></div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Sessions = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

    const filtered = sessions.filter(session =>
      session.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.matchType?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredSessions(filtered);
  }, [searchTerm, sessions]);

  const handleViewSession = (sessionId: string) => {
    navigate(`/analysis?sessionId=${sessionId}`);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                My Sessions
              </h1>
              <p className="text-muted-foreground mt-1">
                Track and analyze your practice sessions
              </p>
            </div>
            <Button 
              onClick={() => navigate('/original')}
              className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
          </div>
        </div>

        {!loading && sessions.length > 0 && (
          <div className={`mb-8 p-6 rounded-lg ${
            isDarkMode ? 'bg-team-dark-20 border border-team-white-20' : 'bg-white border border-muted'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-team-blue">{sessions.length}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {Math.round(sessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) / sessions.length) || 0}
                </div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {Math.max(...sessions.map(s => s.finalScore || 0)) || 0}
                </div>
                <div className="text-sm text-muted-foreground">Best Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-team-blue">
                  {sessions.filter(s => s.matchType?.toLowerCase() === 'match').length}
                </div>
                <div className="text-sm text-muted-foreground">Matches</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions by name, driver, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 ${
                isDarkMode 
                  ? 'bg-team-dark-20 border-team-white-20 text-white' 
                  : 'bg-white border-muted'
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
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {searchTerm ? 'No sessions found' : 'No sessions yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Start tracking your practice sessions to see them here'
              }
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => navigate('/original')}
                className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Session
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onView={() => handleViewSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;