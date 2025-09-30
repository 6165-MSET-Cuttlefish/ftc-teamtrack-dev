import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { User, Mail, Calendar, Shield } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
    } catch {
      // Handle logout error silently - could show user notification here instead
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  if (!user) {
    return null;
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-2xl mx-auto">
        <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                />
                <AvatarFallback className="bg-team-blue text-white text-xl">
                  {getInitials(user.displayName || user.email || 'User')}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle
              className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              {user.displayName || 'User Profile'}
            </CardTitle>
            <CardDescription className={isDarkMode ? 'text-gray-300' : ''}>
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User
                  className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Display Name
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {user.displayName || 'Not set'}
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-gray-700' : ''} />

              <div className="flex items-center space-x-3">
                <Mail
                  className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Email Address
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {user.email}
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-gray-700' : ''} />

              <div className="flex items-center space-x-3">
                <Calendar
                  className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Member Since
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {user.metadata.creationTime
                      ? new Date(
                          user.metadata.creationTime
                        ).toLocaleDateString()
                      : 'Unknown'}
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-gray-700' : ''} />

              <div className="flex items-center space-x-3">
                <Shield
                  className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Email Verified
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {user.emailVerified ? (
                      <span className="text-green-600">✓ Verified</span>
                    ) : (
                      <span className="text-red-600">✗ Not verified</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Separator className={isDarkMode ? 'bg-gray-700' : ''} />

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className={`flex-1 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
                onClick={() => setMessage('Profile editing coming soon!')}
              >
                Edit Profile
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleLogout}
                disabled={loading}
              >
                {loading ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
