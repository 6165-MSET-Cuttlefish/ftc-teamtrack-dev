import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useApi } from '../hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Calendar, Clock, User, Trophy } from 'lucide-react';

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
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}>
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
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            My Sessions
          </h1>
          <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            View and manage your training sessions
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            <h3 className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              No sessions yet
            </h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Get started by creating your first training session.
            </p>
            <div className="mt-6">
              <Button 
                className="bg-team-blue hover:bg-team-blue/90"
                onClick={() => window.location.href = '/'}
              >
                Start New Session
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Card 
                key={session.id} 
                className={`hover:shadow-lg transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : ''}`}>
                      {session.sessionName}
                    </CardTitle>
                    <Badge className={getMatchTypeColor(session.matchType)}>
                      {session.matchType}
                    </Badge>
                  </div>
                  <CardDescription className={isDarkMode ? 'text-gray-400' : ''}>
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
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        {session.driverName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        {session.sessionDuration}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Final Score:
                      </span>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {session.finalScore}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                          Auto Basket:
                        </span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {session.autonBasket}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                          Auto Specimen:
                        </span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {session.autonSpeci}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                          Tele Basket:
                        </span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {session.teleBasket}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                          Endgame:
                        </span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
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
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSessions;
