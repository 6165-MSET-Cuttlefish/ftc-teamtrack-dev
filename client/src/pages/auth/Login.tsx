import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { getErrorMessage } from '@/lib';
import { APP_CONFIG, ROUTES, STORAGE_KEYS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginWithGoogle, continueAsGuest, user, loading: authLoading } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = `Sign In - ${APP_CONFIG.name}`;
  }, []);

  const from = location.state?.from?.pathname || '/sessions';

  /** Return the best post-login destination, consuming any pending invite. */
  const getPostLoginDestination = useCallback((): string => {
    const pendingCode = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_CODE);
    const pendingExpiry = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
    if (pendingCode && pendingExpiry && Date.now() <= Number(pendingExpiry)) {
      return ROUTES.TEAM_INVITE.replace(':inviteCode', pendingCode);
    }
    return from;
  }, [from]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getPostLoginDestination(), { replace: true });
    }
  }, [authLoading, user, navigate, from, getPostLoginDestination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate(getPostLoginDestination(), { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate(getPostLoginDestination(), { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center py-8 sm:py-12 px-3 sm:px-4 md:px-6 lg:px-8 ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <Card
        className={`w-full max-w-md shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
      >
        <CardHeader className="space-y-3 pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
          <CardTitle
            className={`text-2xl sm:text-3xl font-bold text-center ${isDarkMode ? 'text-team-blue' : 'text-gray-900'}`}
          >
            Welcome Back
          </CardTitle>
          <CardDescription
            className={`text-center text-sm sm:text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Sign in to your TeamTrack account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={isDarkMode ? 'text-team-white' : 'text-gray-700'}
              >
                Email Address
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Mail
                  aria-hidden="true"
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className={`h-12 pl-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className={isDarkMode ? 'text-team-white' : 'text-gray-700'}
              >
                Password
              </Label>
              <div
                className={`relative rounded-lg ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-50'}`}
              >
                <Lock
                  aria-hidden="true"
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className={`h-12 pl-12 pr-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`absolute right-4 top-3.5 h-5 w-5 transition-all ${isDarkMode ? 'text-team-white-40 hover:text-team-blue hover:scale-110' : 'text-gray-400 hover:text-gray-600 hover:scale-110'}`}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={`w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="flex items-center gap-4">
            <div className={`flex-1 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-300'}`} />
            <span
              className={`text-xs uppercase whitespace-nowrap ${isDarkMode ? 'text-team-white-40' : 'text-gray-500'}`}
            >
              Or continue with
            </span>
            <div className={`flex-1 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-300'}`} />
          </div>

          <Button
            type="button"
            variant="outline"
            className={`w-full ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 text-white hover:bg-team-blue-10' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'}`}
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <Button
            variant="outline"
            className={`w-full ${
              isDarkMode
                ? 'border-team-white-20 text-team-white-60 hover:bg-team-white-10'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => {
              continueAsGuest();
              navigate('/sessions', { replace: true });
            }}
          >
            Continue as Guest
          </Button>
          <div className="text-sm text-center">
            <Link
              to="/forgot-password"
              className="text-team-blue hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <div
            className={`text-sm text-center ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-team-blue hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
