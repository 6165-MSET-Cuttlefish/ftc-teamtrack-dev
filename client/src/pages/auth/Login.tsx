import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { mapAuthError, type AuthErrorInfo } from '@/lib/authErrors';
import {
  getPendingInviteDestination,
  hasPendingInvite,
} from '@/lib/pendingInvite';
import { APP_CONFIG, ROUTES } from '@/constants';
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
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert';
import { PendingInviteBanner } from '@/components/auth/PendingInviteBanner';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Came from a team invite while signed out. Nearly everyone sent one is
   * new, so the card leads with creating an account, and signing in comes
   * second.
   */
  const [invited] = useState(hasPendingInvite);

  const { login, loginWithGoogle, continueAsGuest, user, loading: authLoading } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = `Sign in - ${APP_CONFIG.name}`;
  }, []);

  // With its query: an /analysis link is nothing without its sessionId
  const from = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search ?? ''}`
    : '/sessions';

  // An invite opened while signed out comes first, then wherever they were
  // headed.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getPendingInviteDestination(from), { replace: true });
    }
  }, [authLoading, user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError({
        message: email ? 'Enter your password.' : 'Enter your email.',
        code: null,
      });
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await login(email, password);
      navigate(getPendingInviteDestination(from), { replace: true });
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      await loginWithGoogle();
      navigate(getPendingInviteDestination(from), { replace: true });
    } catch (err: unknown) {
      // Closing the Google window is not an error: nothing is shown for it.
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    // flex-1 under the header (main is a flex column), not a second screen
    // height; on a phone the card starts at the top instead of mid-screen.
    <div
      className={`flex-1 flex items-start sm:items-center justify-center py-6 sm:py-8 px-3 sm:px-4 md:px-6 lg:px-8 ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <Card
        className={`w-full max-w-md shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
      >
        <CardHeader className="space-y-3 pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
          <CardTitle as="h1" className={`${PAGE_TITLE_CLASS} text-center`}>
            {invited ? `Join your team on ${APP_CONFIG.name}` : 'Sign in'}
          </CardTitle>
          {invited && (
            <CardDescription
              className={`text-center text-sm sm:text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              Create an account to accept the invite, or sign in if you have
              one.
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
          {/* The title says why they are here; the way in comes first */}
          {invited ? (
            <>
              <Button
                asChild
                variant="primary"
                size="xl"
                data-page-primary
                className="w-full font-semibold"
              >
                <Link to={ROUTES.SIGNUP} state={location.state}>
                  Create an account
                </Link>
              </Button>
              <div className="flex items-center gap-4">
                <div
                  className={`flex-1 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-300'}`}
                />
                <span
                  className={`text-xs uppercase whitespace-nowrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  Or sign in
                </span>
                <div
                  className={`flex-1 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-300'}`}
                />
              </div>
            </>
          ) : (
            <PendingInviteBanner />
          )}

          <AuthErrorAlert
            error={error}
            actions={['forgot-password', 'sign-up']}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={isDarkMode ? 'text-team-white' : 'text-gray-700'}
              >
                Email
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
                  autoComplete="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError(null);
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
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`h-12 pl-12 pr-12 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-team-blue'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center transition-all ${isDarkMode ? 'text-team-white-40 hover:text-team-blue hover:scale-110' : 'text-gray-400 hover:text-gray-600 hover:scale-110'}`}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Eye aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Second to Create an account when invited: an outline then */}
            <Button
              type="submit"
              variant={invited ? 'outline' : 'default'}
              className={
                invited
                  ? `w-full h-12 text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`
                  : `w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`
              }
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-4">
            <div className={`flex-1 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-300'}`} />
            <span
              className={`text-xs uppercase whitespace-nowrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              or
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

        {/* Same side padding as the content, so Continue as guest is as wide
            as the buttons above it */}
        <CardFooter className="flex flex-col space-y-3 px-4 sm:px-6">
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
            {/* A guest can't be in a team: said before, not found out after */}
            {invited
              ? 'Continue as guest, without the team'
              : 'Continue as guest'}
          </Button>
          <div className="text-sm text-center">
            <Link
              to="/forgot-password"
              className="inline-flex items-center text-team-blue hover:underline [@media(pointer:coarse)]:min-h-11"
            >
              Forgot your password?
            </Link>
          </div>
          {/* Invited, Create an account already leads the card */}
          {!invited && (
            <div
              className={`text-sm text-center ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              Don't have an account?{' '}
              {/* Carries where they were headed, so signing up lands there too */}
              <Link
                to={ROUTES.SIGNUP}
                state={location.state}
                className="inline-flex items-center text-team-blue hover:underline font-medium [@media(pointer:coarse)]:min-h-11"
              >
                Sign up
              </Link>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
