import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useTeam, useTheme } from '@/contexts';
import { ROUTES } from '@/constants';
import { Users, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const JoinTeam = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { joinTeam } = useTeam();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error'>('loading');
  const [teamName, setTeamName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Save invite code and redirect to login
      if (inviteCode) {
        sessionStorage.setItem('pendingInviteCode', inviteCode);
      }
      navigate(ROUTES.LOGIN);
      return;
    }

    // Also check for pending invite code from login redirect
    const pendingCode = sessionStorage.getItem('pendingInviteCode');
    const codeToUse = inviteCode || pendingCode;

    if (!codeToUse) {
      setStatus('error');
      setErrorMessage('No invite code provided');
      return;
    }

    const doJoin = async () => {
      setStatus('joining');
      try {
        const team = await joinTeam(codeToUse);
        if (team) {
          setTeamName(team.name);
          setStatus('success');
          sessionStorage.removeItem('pendingInviteCode');
          // Auto-redirect after a short delay
          setTimeout(() => navigate(ROUTES.SESSIONS), 2000);
        } else {
          setStatus('error');
          setErrorMessage('Invalid invite code. Please check the link and try again.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Failed to join team. The invite code may be invalid or expired.');
      }
    };

    doJoin();
  }, [user, authLoading, inviteCode, joinTeam, navigate]);

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${
        isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
      }`}
    >
      <div
        className={`max-w-md w-full rounded-2xl border shadow-xl p-8 text-center ${
          isDarkMode
            ? 'bg-team-dark-20 border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        {(status === 'loading' || status === 'joining') && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <div className="h-8 w-8 border-3 border-team-blue border-t-transparent rounded-full animate-spin" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Joining Team...
            </h2>
            <p className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              Please wait while we add you to the team.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-6">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Welcome to {teamName}!
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              You've successfully joined the team. Redirecting to sessions...
            </p>
            <Button
              onClick={() => navigate(ROUTES.SESSIONS)}
              className={`bg-team-blue hover:bg-team-blue/90 ${
                isDarkMode ? 'text-black' : 'text-white'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Go to Sessions
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Unable to Join
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              {errorMessage}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate(ROUTES.SESSIONS)}
                variant="outline"
                className={
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-team-dark'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }
              >
                Go to Sessions
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinTeam;
