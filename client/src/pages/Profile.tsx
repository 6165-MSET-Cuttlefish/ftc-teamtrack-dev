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
        <Card className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}>
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
            <CardDescription className={isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}>
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
                  className={`h-5 w-5 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                  >
                    Display Name
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                  >
                    {user.displayName || 'Not set'}
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'} />

              <div className="flex items-center space-x-3">
                <Mail
                  className={`h-5 w-5 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                  >
                    Email Address
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                  >
                    {user.email}
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'} />

              <div className="flex items-center space-x-3">
                <Calendar
                  className={`h-5 w-5 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                  >
                    Member Since
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                  >
                    Unknown
                  </p>
                </div>
              </div>

              <Separator className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'} />

              <div className="flex items-center space-x-3">
                <Shield
                  className={`h-5 w-5 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                />
                <div>
                  <Label
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                  >
                    Email Verified
                  </Label>
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                  >
                    <span className={isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}>Unknown</span>
                  </p>
                </div>
              </div>
            </div>

            <Separator className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'} />

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className={`flex-1 ${isDarkMode ? 'border-team-blue-40 text-team-blue hover:bg-team-blue/10' : 'border-team-blue text-team-blue hover:bg-team-blue/10'}`}
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