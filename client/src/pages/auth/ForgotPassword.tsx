import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { mapAuthError, type AuthErrorInfo } from '@/lib/authErrors';
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
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  /** The address the link went to; set once it has been sent */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Said under Resend link after it has sent another one */
  const [resent, setResent] = useState(false);

  const { resetPassword } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    document.title = `Reset your password - ${APP_CONFIG.name}`;
  }, []);

  const send = async (address: string) => {
    try {
      setError(null);
      setLoading(true);
      await resetPassword(address);
      return true;
    } catch (err: unknown) {
      setError(mapAuthError(err, 'reset'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError({ message: 'Enter your email.', code: null });
      return;
    }

    if (await send(email)) {
      setResent(false);
      setSentTo(email);
    }
  };

  const handleResend = async () => {
    if (!sentTo) return;
    setResent(false);
    if (await send(sentTo)) setResent(true);
  };

  const mutedText = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  /** Quiet text buttons in the sent view, 44px tall on touch */
  const quietButton = `inline-flex items-center rounded-md px-1 text-sm font-medium text-team-blue hover:underline disabled:opacity-50 [@media(pointer:coarse)]:min-h-11`;

  return (
    // flex-1 under the header (main is a flex column), not a second screen
    // height; on a phone the card starts at the top instead of mid-screen.
    <div
      className={`flex-1 flex items-start sm:items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-6 sm:py-8 px-3 sm:px-4 md:px-6 lg:px-8`}
    >
      <Card
        className={`w-full max-w-md shadow-2xl border-2 transition-all duration-300 hover:shadow-3xl ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
      >
        {sentTo ? (
          // Sent: what happened, where it went, and the one way on.
          <>
            <CardHeader className="space-y-3 pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
              <CardTitle as="h1" className={`${PAGE_TITLE_CLASS} text-center`}>
                Check your inbox
              </CardTitle>
              <CardDescription
                className={`text-center text-sm sm:text-base text-balance ${mutedText}`}
              >
                We sent a reset link to{' '}
                <span
                  className={`font-medium break-all ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {sentTo}
                </span>
                .
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-4 sm:px-6 pb-6 sm:pb-8">
              <AuthErrorAlert error={error} actions={['sign-up']} />

              <Button
                asChild
                variant="primary"
                className="w-full h-12 text-base font-semibold"
              >
                <Link to={ROUTES.LOGIN}>Back to sign in</Link>
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-x-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className={quietButton}
                >
                  {loading ? 'Sending…' : 'Resend link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setResent(false);
                    setSentTo(null);
                  }}
                  disabled={loading}
                  className={quietButton}
                >
                  Use another email
                </button>
              </div>
              <p
                role="status"
                className={`text-center text-xs ${mutedText} ${resent ? '' : 'sr-only'}`}
              >
                {resent ? 'Sent again. Check your spam folder too.' : ''}
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-3 pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
              <CardTitle
                as="h1"
                className={`${PAGE_TITLE_CLASS} text-center text-balance`}
              >
                Reset your password
              </CardTitle>
              <CardDescription
                className={`text-center text-sm sm:text-base text-balance ${mutedText}`}
              >
                We'll email you a link to set a new one.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 px-4 sm:px-6">
              <AuthErrorAlert error={error} actions={['sign-up']} />

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
                      className={`absolute left-4 top-3.5 h-5 w-5 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                      aria-hidden="true"
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

                <Button
                  type="submit"
                  className={`w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
                  disabled={loading}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex justify-center pb-6 sm:pb-8 px-4 sm:px-6">
              <Link
                to={ROUTES.LOGIN}
                className="flex items-center text-sm text-team-blue hover:underline font-medium [@media(pointer:coarse)]:min-h-11"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Link>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
