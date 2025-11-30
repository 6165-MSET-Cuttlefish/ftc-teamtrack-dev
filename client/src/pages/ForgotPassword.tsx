import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { resetPassword } = useAuth();
  const { isDarkMode } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for further instructions');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <Card
        className={`w-full max-w-md ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-team-blue/60'}`}
      >
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-team-blue">
            Reset Password
          </CardTitle>
          <CardDescription
            className={`text-center ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
          >
            Enter your email address and we'll send you a link to reset your
            password
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert
              className={
                isDarkMode
                  ? 'bg-green-900/20 border-green-500/50 text-green-400'
                  : 'bg-green-50 border-green-200 text-green-800'
              }
            >
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={isDarkMode ? 'text-team-white' : 'text-black'}
              >
                Email
              </Label>
              <div
                className={`relative rounded-md ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Mail
                  className={`absolute left-3 top-3 h-4 w-4 ${isDarkMode ? 'text-team-white-40' : 'text-team-blue-40'}`}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`pl-10 ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-team-white placeholder-team-white-40' : 'bg-gray-50 border-team-blue/60 text-black placeholder-team-blue-40'}`}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-team-blue hover:bg-team-blue/90 text-white"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            to="/login"
            className="flex items-center text-sm text-team-blue hover:underline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword;
