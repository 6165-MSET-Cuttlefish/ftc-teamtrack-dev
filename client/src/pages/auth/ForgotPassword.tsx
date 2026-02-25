import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { getErrorMessage } from '@/lib';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { resetPassword } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Reset Password - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    if (!submitted) return;
    const timeout = setTimeout(() => navigate(ROUTES.LOGIN), 15000);
    return () => clearTimeout(timeout);
  }, [submitted, navigate]);

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
      setMessage('Check your inbox for a password reset link. If you don\'t see it, check your spam or junk folder.');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-8 sm:py-12 px-3 sm:px-4 md:px-6 lg:px-8`}
    >
      <Card
        className={`w-full max-w-md shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
      >
        <CardHeader className="space-y-3 pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
          <CardTitle
            className={`text-2xl sm:text-3xl font-bold text-center ${isDarkMode ? 'text-team-blue' : 'text-gray-900'}`}
          >
            Reset Password
          </CardTitle>
          <CardDescription
            className={`text-center text-sm sm:text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Enter your email address and we'll send you a link to reset your
            password
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
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
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
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
                  className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                  aria-hidden="true"
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

            <Button
              type="submit"
              className={`w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
              disabled={loading}
            >
              {loading ? 'Sending...' : submitted ? 'Resend Reset Link' : 'Send Reset Link'}
            </Button>

            {submitted && (
              <p className={`text-xs text-center ${isDarkMode ? 'text-team-white-40' : 'text-gray-500'}`}>
                Redirecting to sign in in a few seconds...
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="ml-1 text-team-blue hover:underline"
                >
                  Go now
                </button>
              </p>
            )}
          </form>
        </CardContent>

        <CardFooter className="flex justify-center pb-6 sm:pb-8">
          <Link
            to={ROUTES.LOGIN}
            className="flex items-center text-sm text-team-blue hover:underline font-medium"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword;
