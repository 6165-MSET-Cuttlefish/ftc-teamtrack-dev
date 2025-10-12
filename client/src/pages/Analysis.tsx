import { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { firebaseService, SessionData } from '../services/firebaseService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Trophy, 
  Clock, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

const toDate = (timestamp: unknown): Date => {
  if (!timestamp) return new Date();

  if (typeof timestamp === 'string') return new Date(timestamp);

  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as FirebaseTimestamp;
    if ('seconds' in ts && 'nanoseconds' in ts) {
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    }
  }

  return new Date();
};

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div className="text-team-blue text-3xl font-medium leading-6">{value}</div>
      <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-base leading-6`}>{label}</div>
    </div>
  );
};

const MetricCard = ({ 
  title, 
  value, 
  icon: Icon,
  trend,
  color = "team-blue" 
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}) => {
  const { isDarkMode } = useTheme();
  
  return (
    <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold text-${color}`}>{value}</span>
              {trend && (
                <div className={`flex items-center ${
                  trend === 'up' ? 'text-green-500' : 
                  trend === 'down' ? 'text-red-500' : 
                  'text-gray-500'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                </div>
              )}
            </div>
          </div>
          <Icon className={`h-8 w-8 text-${color}`} />
        </div>
      </CardContent>
    </Card>
  );
};

const BreakdownCard = ({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: string | number; color?: string }>;
}) => {
  const { isDarkMode } = useTheme();
  
  return (
    <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
      <CardHeader>
        <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-semibold ${
                item.color ? `text-${item.color}` : 'text-team-blue'
              }`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Analysis = () => {
  const { isDarkMode } = useTheme();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = searchParams.get('sessionId');
  const stateData = location.state as { sessionData?: any; isTemporary?: boolean } | null;

  useEffect(() => {
    const loadSession = async () => {
      // Check if session data was passed through state first (for temporary sessions)
      if (stateData?.sessionData) {
        setSession(stateData.sessionData);
        setLoading(false);
        if (stateData.isTemporary) {
          toast.info('Showing analysis for current session (not yet saved)');
        }
        return;
      }

      // Otherwise, try to load by sessionId
      if (!sessionId) {
        toast.error('No session selected');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const sessionData = await firebaseService.getSession(sessionId);
        if (sessionData) {
          setSession(sessionData);
        } else {
          toast.error('Session not found');
        }
      } catch (error) {
        console.error('Error loading session:', error);
        toast.error('Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, stateData]);

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Session Not Found
            </h3>
            <p className="text-muted-foreground mb-6">
              The session you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link to="/sessions">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sessions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'Unknown date';
    const date = toDate(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" asChild>
              <Link to="/sessions">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sessions
              </Link>
            </Button>
          </div>
          
          <div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {session.sessionName || 'Session Analysis'}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(session.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Final Score"
            value={session.finalScore || 0}
            icon={Trophy}
          />
          <MetricCard
            title="Driver"
            value={session.driverName || 'Unknown'}
            icon={User}
          />
          <MetricCard
            title="Duration"
            value={session.sessionDuration || 'N/A'}
            icon={Clock}
          />
          <MetricCard
            title="Match Type"
            value={session.matchType || 'Practice'}
            icon={Target}
          />
        </div>

        {/* Performance Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <BreakdownCard
            title="Autonomous Period"
            items={[
              { label: 'Classified Artifact', value: session.autonClassifiedArtifact || 0, color: 'blue-600' },
              { label: 'Overflow Artifact', value: session.autonOverflowArtifact || 0, color: 'green-600' },
              { label: 'Motif', value: session.autonMotif || 0, color: 'purple-600' },
              { label: 'Leave', value: session.autonLeave || 0, color: 'orange-600' }
            ]}
          />
          <BreakdownCard
            title="Teleop Period"
            items={[
              { label: 'Classified Artifact', value: session.teleClassifiedArtifact || 0, color: 'blue-600' },
              { label: 'Overflow Artifact', value: session.teleOverflowArtifact || 0, color: 'green-600' },
              { label: 'Motif', value: session.teleMotif || 0, color: 'purple-600' }
            ]}
          />
        </div>

        {/* Endgame */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
            <CardHeader>
              <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Endgame Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-team-blue mb-2">
                  {session.endgameHang || 0}
                </div>
                <p className="text-muted-foreground">Hanging Points</p>
              </div>
            </CardContent>
          </Card>

          <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
            <CardHeader>
              <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Total Autonomous
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500 mb-2">
                  {((session.autonClassifiedArtifact || 0) * 3) + 
                   ((session.autonOverflowArtifact || 0) * 1) + 
                   ((session.autonMotif || 0) * 2) + 
                   ((session.autonLeave || 0) * 3)}
                </div>
                <p className="text-muted-foreground">Points</p>
              </div>
            </CardContent>
          </Card>

          <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
            <CardHeader>
              <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Total Teleop
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500 mb-2">
                  {((session.teleClassifiedArtifact || 0) * 3) + 
                   ((session.teleOverflowArtifact || 0) * 1) + 
                   ((session.teleMotif || 0) * 2)}
                </div>
                <p className="text-muted-foreground">Points</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Insights */}
        <Card className={isDarkMode ? 'border-team-white-20 bg-team-dark-20' : 'border-muted'}>
          <CardHeader>
            <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Strengths
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  {((session.autonClassifiedArtifact || 0) + (session.autonOverflowArtifact || 0) + (session.autonMotif || 0)) > 
                   ((session.teleClassifiedArtifact || 0) + (session.teleOverflowArtifact || 0) + (session.teleMotif || 0)) && (
                    <li>• Strong autonomous performance</li>
                  )}
                  {(session.endgameHang || 0) > 0 && (
                    <li>• Successful endgame execution</li>
                  )}
                  {(session.finalScore || 0) > 50 && (
                    <li>• Above-average scoring</li>
                  )}
                  {(session.autonClassifiedArtifact || 0) > 5 && (
                    <li>• Excellent classified artifact scoring</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Areas for Improvement
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  {((session.autonClassifiedArtifact || 0) + (session.autonOverflowArtifact || 0) + (session.autonMotif || 0)) === 0 && (
                    <li>• Focus on autonomous scoring</li>
                  )}
                  {(session.endgameHang || 0) === 0 && (
                    <li>• Practice endgame hanging</li>
                  )}
                  {(session.autonLeave || 0) === 0 && (
                    <li>• Practice leaving the starting area</li>
                  )}
                  {(session.teleMotif || 0) < 2 && (
                    <li>• Improve motif completion in teleop</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analysis;
