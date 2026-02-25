import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useTeam, useTheme } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { ROUTES, APP_CONFIG, STORAGE_KEYS } from '@/constants';
import { Users, Check, AlertCircle, Upload, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Session } from '@/types';
import { logger } from '@/lib';

const JoinTeam = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { joinTeam } = useTeam();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const hasAttemptedLookup = useRef(false);
  const hasAttemptedLookupId = useRef<string | null>(null);

  const [status, setStatus] = useState<'loading' | 'preview' | 'joining' | 'success' | 'error'>('loading');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importableSessions, setImportableSessions] = useState<Session[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [resolvedCode, setResolvedCode] = useState<string>('');

  useEffect(() => {
    document.title = `Join Team - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (inviteCode) {
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_CODE, inviteCode);
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY, String(Date.now() + 60 * 60 * 1000));
      }
      navigate(ROUTES.LOGIN);
      return;
    }

    const pendingCode = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_CODE);
    const pendingExpiry = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
    if (pendingCode && pendingExpiry && Date.now() > Number(pendingExpiry)) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_CODE);
      localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_EXPIRY);
    }
    const codeToUse = inviteCode || (pendingExpiry && Date.now() <= Number(pendingExpiry) ? pendingCode : null);

    if (!codeToUse) {
      setStatus('error');
      setErrorMessage('No invite code provided');
      return;
    }

    if (hasAttemptedLookup.current && hasAttemptedLookupId.current === codeToUse) return;
    hasAttemptedLookup.current = true;
    hasAttemptedLookupId.current = codeToUse;
    setResolvedCode(codeToUse);

    const doLookup = async () => {
      setStatus('loading');
      try {
        const team = await teamService.getTeamByInviteCode(codeToUse);
        if (team) {
          setTeamName(team.name);
          setMemberCount(team.members?.length ?? 0);
          setStatus('preview');
        } else {
          setStatus('error');
          setErrorMessage('Invalid invite code. Please check the link and try again.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Failed to look up team. The invite code may be invalid or expired.');
      }
    };

    doLookup();
  }, [user, authLoading, inviteCode, navigate]);

  const handleJoin = async () => {
    if (!resolvedCode) return;
    setStatus('joining');
    try {
      const team = await joinTeam(resolvedCode);
      if (team) {
        setTeamName(team.name);
        setTeamId(team.id);
        setStatus('success');
        localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE_CODE);

        if (user?.uid) {
          try {
            const allSessions = await firebaseService.getUserSessions(user.uid);
            const importable = allSessions.filter(s => s.teamId !== team.id);
            setImportableSessions(importable as Session[]);
            setSelectedSessionIds(new Set(importable.map(s => s.id)));
          } catch (err) {
            logger.warn('Could not fetch sessions for import', err instanceof Error ? { message: err.message } : undefined);
          }
        }
      } else {
        setStatus('error');
        setErrorMessage('Invalid invite code. Please check the link and try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Failed to join team. The invite code may be invalid or expired.');
    }
  };

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
              {status === 'joining' ? 'Joining Team...' : 'Looking up team...'}
            </h2>
            <p className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}>
              {status === 'joining' ? 'Please wait while we add you to the team.' : 'Verifying invite code...'}
            </p>
          </>
        )}

        {status === 'preview' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-team-blue/15 flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-team-blue" />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Join {teamName}?
            </h2>
            <p className={`mb-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              You've been invited to join this team.
            </p>
            {memberCount > 0 && (
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}>
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </p>
            )}
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
                Cancel
              </Button>
              <Button
                onClick={handleJoin}
                className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Users className="h-4 w-4 mr-2" />
                Join Team
              </Button>
            </div>
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
              You've successfully joined the team.
            </p>

            {importableSessions.length > 0 && (
              <div
                className={`rounded-xl border p-4 mb-6 ${
                  isDarkMode
                    ? 'bg-team-dark border-team-blue-40'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p
                  className={`text-sm mb-3 ${
                    isDarkMode ? 'text-team-white-60' : 'text-gray-600'
                  }`}
                >
                  You have <strong>{importableSessions.length}</strong> session
                  {importableSessions.length !== 1 ? 's' : ''} that can be imported
                  into <strong>{teamName}</strong>.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedSessionIds.size === importableSessions.length) {
                      setSelectedSessionIds(new Set());
                    } else {
                      setSelectedSessionIds(new Set(importableSessions.map(s => s.id)));
                    }
                  }}
                  className={`flex items-center gap-2 text-xs font-medium mb-2 ${
                    isDarkMode ? 'text-team-blue-60 hover:text-team-blue' : 'text-team-blue hover:text-team-blue/80'
                  }`}
                >
                  {selectedSessionIds.size === importableSessions.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedSessionIds.size === importableSessions.length ? 'Deselect All' : 'Select All'}
                </button>

                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {importableSessions.map(session => {
                    const isSelected = selectedSessionIds.has(session.id);
                    const matchCount = session.matches?.length ?? 0;
                    const dateStr = session.createdAt
                      ? new Date(
                          typeof session.createdAt === 'object' && 'seconds' in session.createdAt
                            ? session.createdAt.seconds * 1000
                            : session.createdAt as string | number
                        ).toLocaleDateString()
                      : '';
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          setSelectedSessionIds(prev => {
                            const next = new Set(prev);
                            if (next.has(session.id)) {
                              next.delete(session.id);
                            } else {
                              next.add(session.id);
                            }
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isDarkMode
                            ? isSelected
                              ? 'bg-team-blue/15 text-white'
                              : 'text-team-white-60 hover:bg-team-dark-20'
                            : isSelected
                              ? 'bg-team-blue/10 text-gray-900'
                              : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-team-blue" />
                        ) : (
                          <Square className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`} />
                        )}
                        <span className="truncate font-medium">{session.sessionName}</span>
                        <span
                          className={`ml-auto shrink-0 text-xs ${
                            isDarkMode ? 'text-team-white-40' : 'text-gray-400'
                          }`}
                        >
                          {matchCount} match{matchCount !== 1 ? 'es' : ''}{dateStr ? ` · ${dateStr}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={async () => {
                    if (!user?.uid || selectedSessionIds.size === 0) return;
                    setImporting(true);
                    try {
                      const ids = Array.from(selectedSessionIds);
                      const count = await firebaseService.importSessionsToTeam(ids, teamId);
                      toast.success(`Imported ${count} session${count !== 1 ? 's' : ''} to ${teamName}`);
                      setImportableSessions(prev => prev.filter(s => !selectedSessionIds.has(s.id)));
                      setSelectedSessionIds(new Set());
                    } catch {
                      toast.error('Failed to import sessions. You can try again from the sessions page.');
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={importing || selectedSessionIds.size === 0}
                  className={`w-full bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing
                    ? 'Importing...'
                    : `Import ${selectedSessionIds.size} Session${selectedSessionIds.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            )}

            <Button
              onClick={() => navigate(ROUTES.SESSIONS)}
              className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
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
