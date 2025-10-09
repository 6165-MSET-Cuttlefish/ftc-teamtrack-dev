import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { firebaseService, SessionData } from '../services/firebaseService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  Search, 
  Plus, 
  Calendar, 
  User, 
  Trophy, 
  Clock, 
  Filter,
  BarChart3,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';

// Helper function to convert timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  return new Date(timestamp);
};

interface SessionCardProps {
  session: SessionData;
  onClick?: () => void;
}

const SessionCard = ({ session, onClick }: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  
  const formatDate = (timestamp: any) => {
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
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isDarkMode ? 'hover:border-team-blue-40' : 'hover:border-team-blue'
      }`}
      onClick={onClick}
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
        
        {/* Score breakdown */}
        {(session.autonBasket || session.autonSpeci || session.teleBasket || session.teleSpeci || session.endgameHang) && (
          <div className="mt-3 pt-3 border-t border-muted/20">
            <div className="text-xs text-muted-foreground mb-2">Score Breakdown:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {session.autonBasket !== undefined && (
                <div>Auto Basket: {session.autonBasket}</div>
              )}
              {session.autonSpeci !== undefined && (
                <div>Auto Specimen: {session.autonSpeci}</div>
              )}
              {session.teleBasket !== undefined && (
                <div>Tele Basket: {session.teleBasket}</div>
              )}
              {session.teleSpeci !== undefined && (
                <div>Tele Specimen: {session.teleSpeci}</div>
              )}
              {session.endgameHang !== undefined && (
                <div>Endgame: {session.endgameHang}</div>
              )}
            </div>
          </div>
        )}
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
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    let filtered = sessions.filter(session => 
      session.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.matchType?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort sessions
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'score':
          aValue = a.finalScore || 0;
          bValue = b.finalScore || 0;
          break;
        case 'name':
          aValue = a.sessionName || '';
          bValue = b.sessionName || '';
          break;
        case 'date':
        default:
          aValue = toDate(a.createdAt);
          bValue = toDate(b.createdAt);
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredSessions(filtered);
  }, [sessions, searchTerm, sortBy, sortOrder]);

  const handleSessionClick = (session: SessionData) => {
    // Navigate to analysis page with session data
    navigate('/analysis', { state: { sessionData: session } });
  };

  const handleNewSession = () => {
    navigate('/original');
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} transition-colors`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            My Sessions
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Track and analyze your robot performance sessions
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'name')}
                className={`text-sm border rounded px-2 py-1 ${
                  isDarkMode 
                    ? 'bg-team-dark border-team-white-20 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="date">Date</option>
                <option value="score">Score</option>
                <option value="name">Name</option>
              </select>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSort}
                className="p-1 h-8 w-8"
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </div>

            {/* New Session Button */}
            <Button onClick={handleNewSession} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>

        {/* Sessions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "No sessions match your search criteria." 
                  : "You haven't created any sessions yet."
                }
              </p>
              {!searchTerm && (
                <Button onClick={handleNewSession} className="flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Create Your First Session
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Session Stats */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-team-blue" />
                    <div>
                      <p className="text-2xl font-bold">{filteredSessions.length}</p>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {Math.max(...filteredSessions.map(s => s.finalScore || 0), 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Best Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredSessions.length > 0 
                          ? Math.round(filteredSessions.reduce((acc, s) => acc + (s.finalScore || 0), 0) / filteredSessions.length)
                          : 0
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredSessions.filter(s => {
                          const sessionDate = toDate(s.createdAt);
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return sessionDate > weekAgo;
                        }).length}
                      </p>
                      <p className="text-sm text-muted-foreground">This Week</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => handleSessionClick(session)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Sessions;