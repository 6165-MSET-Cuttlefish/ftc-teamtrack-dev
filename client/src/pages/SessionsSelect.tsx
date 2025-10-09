import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { firebaseService, SessionData } from '../services/firebaseService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Search, 
  Calendar, 
  User, 
  Trophy, 
  Clock, 
  Filter,
  BarChart3,
  ArrowUpDown,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

// Type for Firebase timestamp
interface FirebaseTimestamp {
  toDate(): Date;
}

// Helper function to convert timestamp to Date
const toDate = (timestamp: unknown): Date => {
  if (!timestamp) return new Date();
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    return (timestamp as FirebaseTimestamp).toDate();
  }
  
  if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  return new Date();
};

interface SessionSelectCardProps {
  session: SessionData;
  isSelected: boolean;
  onToggleSelect: (sessionId: string) => void;
  onView?: () => void;
}

const SessionSelectCard = ({ session, isSelected, onToggleSelect, onView }: SessionSelectCardProps) => {
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
      className={`transition-all duration-200 ${
        isSelected 
          ? isDarkMode 
            ? 'border-team-blue bg-team-blue/10' 
            : 'border-team-blue bg-team-blue/5'
          : isDarkMode 
            ? 'border-team-white-20 hover:border-team-blue-40' 
            : 'border-muted hover:border-team-blue/40'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(session.id)}
              className="mt-1"
            />
            <div>
              <CardTitle className="text-lg font-semibold">
                {session.sessionName || 'Untitled Session'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(session.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4 text-team-blue" />
              <span className="text-sm font-medium text-team-blue">
                {session.finalScore || 0}
              </span>
            </div>
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
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
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 bg-muted rounded animate-pulse mt-1"></div>
            <div className="space-y-2">
              <div className="h-5 bg-muted rounded animate-pulse w-32"></div>
              <div className="h-3 bg-muted rounded animate-pulse w-24"></div>
            </div>
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

const SessionsSelect = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
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
    const filtered = sessions.filter(session => 
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

  const handleToggleSelect = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedSessions.size === filteredSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleViewSession = (session: SessionData) => {
    navigate('/analysis', { state: { sessionData: session } });
  };

  const handleExportSelected = () => {
    if (selectedSessions.size === 0) {
      toast.error('Please select sessions to export');
      return;
    }

    const selectedSessionData = sessions.filter(s => selectedSessions.has(s.id));
    
    // Create CSV content
    const csvHeaders = [
      'Session Name',
      'Driver Name', 
      'Match Type',
      'Duration',
      'Final Score',
      'Auton Basket',
      'Auton Specimen',
      'Tele Basket',
      'Tele Specimen',
      'Endgame Hang',
      'Created At'
    ];
    
    const csvRows = selectedSessionData.map(session => [
      session.sessionName || '',
      session.driverName || '',
      session.matchType || '',
      session.sessionDuration || '',
      session.finalScore || 0,
      session.autonBasket || 0,
      session.autonSpeci || 0,
      session.teleBasket || 0,
      session.teleSpeci || 0,
      session.endgameHang || 0,
      toDate(session.createdAt).toISOString()
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${selectedSessions.size} sessions`);
  };

  const handleDeleteSelected = () => {
    if (selectedSessions.size === 0) {
      toast.error('Please select sessions to delete');
      return;
    }

    // For now, just show a toast since delete functionality isn't implemented in the service
    toast.error('Delete functionality not yet implemented');
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const isAllSelected = filteredSessions.length > 0 && selectedSessions.size === filteredSessions.length;
  const isSomeSelected = selectedSessions.size > 0 && selectedSessions.size < filteredSessions.length;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} transition-colors`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Select Sessions
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Select sessions for bulk operations like export or analysis
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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

            {/* Sort Controls */}
            <div className="flex items-center gap-3">
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
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el: HTMLInputElement | null) => {
                    if (el) {
                      el.indeterminate = isSomeSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">
                  {selectedSessions.size === 0 
                    ? 'Select All' 
                    : `${selectedSessions.size} selected`
                  }
                </span>
              </div>
            </div>

            {selectedSessions.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSelected}
                  className="flex items-center gap-2"
                >
                  <Download className="h-3 w-3" />
                  Export ({selectedSessions.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete ({selectedSessions.size})
                </Button>
              </div>
            )}
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
                <Button onClick={() => navigate('/original')} className="flex items-center gap-2 mx-auto">
                  Create Your First Session
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <SessionSelectCard
                key={session.id}
                session={session}
                isSelected={selectedSessions.has(session.id)}
                onToggleSelect={handleToggleSelect}
                onView={() => handleViewSession(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsSelect;