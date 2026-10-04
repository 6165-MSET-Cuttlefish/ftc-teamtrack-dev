import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme, useTeam } from '@/contexts';
import { getInitials } from '@/lib';
import { mapAuthError, isWrongPasswordError } from '@/lib/authErrors';
import { flushPendingDeletes } from '@/lib/pendingSessionDeletes';
import { describeSignOutLoss } from '@/lib/signOutLoss';
import { useArmedAfterOpen } from '@/hooks/useArmedAfterOpen';
import { teamService } from '@/services';
import { APP_CONFIG, ROUTES } from '@/constants';
import type { Team, TeamMember } from '@/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User,
  Mail,
  Shield,
  Lock,
  BadgeCheck,
  AlertCircle,
  Trash2,
  LogOut,
  Eye,
  EyeOff,
  ArrowLeft,
  Link2,
  Users,
} from 'lucide-react';
import { TeamManager } from '@/components/team/TeamManager';
import { ShareLinks } from './ShareLinks';

const PROVIDER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  'github.com': 'GitHub',
  'facebook.com': 'Facebook',
  'twitter.com': 'Twitter',
  'apple.com': 'Apple',
  password: 'Email & Password',
};

const Section = ({
  icon: Icon,
  title,
  description,
  children,
  isDarkMode,
  variant = 'default',
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  isDarkMode: boolean;
  variant?: 'default' | 'danger';
}) => {
  const borderColor =
    variant === 'danger'
      ? 'border-red-500/30'
      : isDarkMode
        ? 'border-team-blue-40'
        : 'border-gray-200';

  return (
    <Card
      className={`shadow-md border transition-all duration-200 ${borderColor} ${
        isDarkMode
          ? 'bg-team-dark'
          : 'bg-white'
      }`}
    >
      <CardHeader className="pb-4 px-5 sm:px-6 pt-5 sm:pt-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center h-9 w-9 shrink-0 rounded-lg ${
              variant === 'danger'
                ? 'bg-red-500/10'
                : isDarkMode
                  ? 'bg-team-blue/10'
                  : 'bg-team-blue/5'
            }`}
          >
            <Icon
              size={18}
              className={
                variant === 'danger'
                  ? 'text-red-500'
                  : 'text-team-blue'
              }
            />
          </div>
          <div>
            <CardTitle
              className={`text-base font-semibold ${
                variant === 'danger'
                  ? // red-500 is under 4.5:1 on the light background
                    isDarkMode
                    ? 'text-red-400'
                    : 'text-red-700'
                  : isDarkMode
                    ? 'text-white'
                    : 'text-gray-900'
              }`}
            >
              {title}
            </CardTitle>
            {description && (
              <CardDescription
                className={`text-xs mt-0.5 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                }`}
              >
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
        {children}
      </CardContent>
    </Card>
  );
};

const Field = ({
  label,
  children,
  isDarkMode,
}: {
  label: string;
  children: React.ReactNode;
  isDarkMode: boolean;
}) => (
  <div className="space-y-1.5">
    <Label
      className={`text-xs font-medium uppercase tracking-wider ${
        isDarkMode ? 'text-team-white-60' : 'text-gray-500'
      }`}
    >
      {label}
    </Label>
    {children}
  </div>
);

const MIN_PASSWORD_LENGTH = 6;

/** The inputs that can carry an error of their own */
type FieldErrorKey =
  | 'email'
  | 'emailPassword'
  | 'currentPassword'
  | 'newPassword'
  | 'deletePassword';

/** An error written under the field that caused it; stays until the field is edited. */
const FieldError = ({
  id,
  children,
  isDarkMode,
}: {
  id: string;
  children: React.ReactNode;
  isDarkMode: boolean;
}) => (
  <p
    id={id}
    role="alert"
    className={`text-xs font-medium ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}
  >
    {children}
  </p>
);

/**
 * What deleting the account does to the user's team: once the user's data
 * is gone, deleting leaves the team, so this is the rule in
 * `teamService.leaveTeam`, in words.
 */
const describeTeamAfterDelete = (team: Team, uid: string): string => {
  if (teamService.ownerOf(team) !== uid) {
    return `You will be removed from ${team.name}.`;
  }
  const others = team.members.filter(member => member.userId !== uid);
  if (others.length === 0) {
    return `${team.name} and its invite link are deleted.`;
  }
  const joinedSeconds = (member: TeamMember) =>
    member.joinedAt &&
    typeof member.joinedAt === 'object' &&
    'seconds' in member.joinedAt
      ? (member.joinedAt as { seconds: number }).seconds
      : 0;
  const next = [...others].sort(
    (a, b) => joinedSeconds(a) - joinedSeconds(b)
  )[0];
  return `${next.displayName || next.email} becomes the owner of ${team.name}.`;
};

const Profile = () => {
  const {
    user,
    isGuest,
    logout,
    updateDisplayName,
    updateUserEmail,
    sendVerificationEmail,
    updateUserPassword,
    deleteAccount,
  } = useAuth();
  const { isDarkMode } = useTheme();
  const { team, updateMemberDisplayName } = useTeam();
  const { sessionData, matchActive } = useSessionCore();

  useEffect(() => {
    document.title = `Profile - ${APP_CONFIG.name}`;
  }, []);

  // The account menu sends someone without a team to the Team card. Every
  // navigation has its own key, so asking again from here (scrolled away
  // from the card since) goes back to it too.
  const { hash, key: locationKey } = useLocation();
  useEffect(() => {
    if (hash !== '#team') return;
    document.getElementById('team')?.scrollIntoView({ block: 'start' });
  }, [hash, locationKey]);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldErrorKey, string>>
  >({});

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailPasswordValue, setEmailPasswordValue] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [verificationLoading, setVerificationLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // The tap that opens the dialog must not land on Sign Out Anyway.
  const signOutArmed = useArmedAfterOpen(showLogoutConfirm);
  /** Set while the user is signing out or deleting their account on purpose */
  const leavingRef = useRef(false);

  // Matches only reach the server when the session is completed; signing out
  // clears the one in progress, a match that is still being scored included.
  const signOutLoss = describeSignOutLoss(sessionData, matchActive);

  const isPasswordProvider =
    user?.providerId === 'password' || !user?.providerId;

  /** Both new-password fields are filled in and disagree (shown as it is typed) */
  const passwordsDiffer =
    !!newPassword && !!confirmPassword && newPassword !== confirmPassword;

  // A toast is in view wherever the page is scrolled to; the banner this
  // replaces sat at the top of the page, above the fold from Security down.
  const showMessage = (text: string, type: 'success' | 'error') => {
    if (type === 'error') toast.error(text);
    else toast.success(text);
  };

  const setFieldError = (field: FieldErrorKey, text: string) =>
    setFieldErrors(prev => ({ ...prev, [field]: text }));

  const clearFieldError = (...fields: FieldErrorKey[]) =>
    setFieldErrors(prev => {
      if (!fields.some(field => prev[field])) return prev;
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });

  /**
   * Report a failed account change. An error one field caused (the wrong
   * current password, an email already taken, a weak new password) is also
   * written under that field, where it stays until the field is edited or
   * the form is sent again.
   */
  const showAuthError = (
    err: unknown,
    fields: {
      password?: FieldErrorKey;
      email?: FieldErrorKey;
      newPassword?: FieldErrorKey;
    } = {}
  ) => {
    const info = mapAuthError(err, 'reauth');
    // Nothing to say: they closed the Google window themselves.
    if (!info) return;
    const field = isWrongPasswordError(err)
      ? fields.password
      : info.code === 'auth/email-already-in-use' ||
          info.code === 'auth/invalid-email'
        ? fields.email
        : info.code === 'auth/weak-password'
          ? fields.newPassword
          : undefined;
    if (field) setFieldError(field, info.message);
    showMessage(info.message, 'error');
  };

  const signOut = async () => {
    setShowLogoutConfirm(false);
    try {
      setLoading(true);
      leavingRef.current = true;
      // Session deletes still inside their undo window can only go through
      // while signed in.
      try {
        await flushPendingDeletes();
      } catch {
        /* sign out regardless */
      }
      await logout();
      toast.success('Signed out');
    } catch {
      leavingRef.current = false;
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (signOutLoss) {
      setShowLogoutConfirm(true);
      return;
    }
    signOut();
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    try {
      setNameLoading(true);
      await updateDisplayName(nameValue.trim());
      await updateMemberDisplayName(nameValue.trim());
      setEditingName(false);
      showMessage('Display name updated', 'success');
    } catch (err) {
      showAuthError(err);
    } finally {
      setNameLoading(false);
    }
  };

  const saveEmail = async () => {
    if (!emailValue.trim() || !emailPasswordValue) return;
    clearFieldError('email', 'emailPassword');
    try {
      setEmailLoading(true);
      await updateUserEmail(emailValue.trim(), emailPasswordValue);
      setEditingEmail(false);
      showMessage('Email updated', 'success');
    } catch (err) {
      showAuthError(err, { password: 'emailPassword', email: 'email' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      setVerificationLoading(true);
      await sendVerificationEmail();
      showMessage(
        'Verification email sent. Check your inbox, then refresh this page.',
        'success'
      );
    } catch (err) {
      showAuthError(err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    clearFieldError('currentPassword', 'newPassword');
    if (newPassword !== confirmPassword) {
      // Already said under Confirm new password, as it is typed.
      showMessage('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      const text = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      setFieldError('newPassword', text);
      showMessage(text, 'error');
      return;
    }
    try {
      setPasswordLoading(true);
      await updateUserPassword(currentPassword, newPassword);
      setEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showMessage('Password updated', 'success');
    } catch (err) {
      showAuthError(err, {
        password: 'currentPassword',
        newPassword: 'newPassword',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    clearFieldError('deletePassword');
    try {
      setDeleteLoading(true);
      leavingRef.current = true;
      await deleteAccount(isPasswordProvider ? deletePassword : undefined);
      toast.success('Your account and data were deleted');
    } catch (err) {
      leavingRef.current = false;
      showAuthError(err, { password: 'deletePassword' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const guestRedirectToastShown = useRef(false);
  if (isGuest || !user) {
    // Signed out or deleted from this page: that isn't "please sign in".
    if (leavingRef.current) return <Navigate to={ROUTES.LOGIN} replace />;
    if (!guestRedirectToastShown.current) {
      guestRedirectToastShown.current = true;
      setTimeout(() => toast.error('Please sign in to view your profile'), 0);
    }
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  const providerLabel =
    PROVIDER_LABELS[user.providerId || 'password'] ||
    user.providerId ||
    'Email & Password';

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-8 sm:py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to={ROUTES.SESSIONS}
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
            isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sessions
        </Link>

        <Card
          className={`shadow-lg border-2 transition-all duration-300 overflow-hidden ${
            isDarkMode
              ? 'bg-team-dark border-team-blue-40'
              : 'bg-white border-gray-200'
          }`}
        >
          <CardContent className="pt-8 pb-6 px-5 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <Avatar className="h-20 w-20 ring-2 ring-team-blue/20 ring-offset-2 ring-offset-transparent shadow-lg">
                <AvatarImage
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                />
                <AvatarFallback
                  className={`bg-team-blue text-lg font-semibold ${isDarkMode ? '!text-black' : '!text-white'}`}
                >
                  {getInitials(user.displayName || user.email || 'User')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <h1
                  className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {user.displayName || 'User'}
                </h1>
                <p
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  {user.email}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      isDarkMode
                        ? 'bg-team-blue/10 text-team-blue'
                        : 'bg-team-blue/5 text-team-blue'
                    }`}
                  >
                    <Shield size={11} />
                    {providerLabel}
                  </span>
                  {user.emailVerified ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}
                    >
                      <BadgeCheck size={11} />
                      Verified
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
                    >
                      <AlertCircle size={11} />
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loading}
                className={`shrink-0 ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:text-white'
                    : ''
                }`}
              >
                <LogOut size={14} />
                {loading ? 'Signing Out…' : 'Sign Out'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Section
          icon={User}
          title="Profile Information"
          isDarkMode={isDarkMode}
        >
          <Field label="Display Name" isDarkMode={isDarkMode}>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') {
                      setEditingName(false);
                      setNameValue('');
                    }
                  }}
                  autoFocus
                  placeholder="Enter display name"
                  aria-label="Display name"
                  autoComplete="name"
                  className="h-10"
                />
                <Button
                  size="sm"
                  disabled={nameLoading || !nameValue.trim()}
                  onClick={saveName}
                  className={isDarkMode ? 'text-black' : 'text-white'}
                >
                  {nameLoading ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingName(false);
                    setNameValue('');
                  }}
                  className={
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white-60'
                      : ''
                  }
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`text-sm font-medium truncate min-w-0 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {user.displayName || (
                    <span className="italic opacity-50">Not set</span>
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setNameValue(user?.displayName || '');
                    setEditingName(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            )}
          </Field>

          <Field label="Email Address" isDarkMode={isDarkMode}>
            {editingEmail ? (
              <div className="space-y-3">
                <Input
                  type="email"
                  value={emailValue}
                  onChange={e => {
                    setEmailValue(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="New email address"
                  aria-label="New email address"
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email || undefined}
                  aria-describedby={
                    fieldErrors.email ? 'profile-email-error' : undefined
                  }
                  autoFocus
                  className="h-10"
                />
                {fieldErrors.email && (
                  <FieldError id="profile-email-error" isDarkMode={isDarkMode}>
                    {fieldErrors.email}
                  </FieldError>
                )}
                <div className="relative">
                  <Input
                    type="password"
                    value={emailPasswordValue}
                    onChange={e => {
                      setEmailPasswordValue(e.target.value);
                      clearFieldError('emailPassword');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEmail();
                      if (e.key === 'Escape') {
                        setEditingEmail(false);
                        setEmailValue('');
                        setEmailPasswordValue('');
                      }
                    }}
                    placeholder="Current password to confirm"
                    aria-label="Current password"
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.emailPassword || undefined}
                    aria-describedby={
                      fieldErrors.emailPassword
                        ? 'profile-email-password-error'
                        : undefined
                    }
                    className="h-10"
                  />
                </div>
                {fieldErrors.emailPassword && (
                  <FieldError
                    id="profile-email-password-error"
                    isDarkMode={isDarkMode}
                  >
                    {fieldErrors.emailPassword}
                  </FieldError>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={
                      emailLoading ||
                      !emailValue.trim() ||
                      !emailPasswordValue
                    }
                    onClick={saveEmail}
                    className={isDarkMode ? 'text-black' : 'text-white'}
                  >
                    {emailLoading ? 'Saving…' : 'Save Email'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingEmail(false);
                      setEmailValue('');
                      setEmailPasswordValue('');
                    }}
                    className={
                      isDarkMode
                        ? 'border-team-blue-40 text-team-white-60'
                        : ''
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail
                      size={14}
                      className={
                        isDarkMode ? 'text-team-white-40' : 'text-gray-400'
                      }
                    />
                    <p
                      className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      {user.email}
                    </p>
                  </div>
                  {isPasswordProvider && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailValue(user?.email || '');
                        setEmailPasswordValue('');
                        setEditingEmail(true);
                        clearFieldError('email', 'emailPassword');
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {user.emailVerified ? (
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck
                      size={13}
                      className={
                        isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                      }
                    />
                    <span
                      className={`text-xs font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}
                    >
                      Email verified
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle
                        size={13}
                        className={
                          isDarkMode ? 'text-amber-400' : 'text-amber-700'
                        }
                      />
                      <span
                        className={`text-xs font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
                      >
                        Not verified
                      </span>
                    </div>
                    <button
                      onClick={handleSendVerification}
                      disabled={verificationLoading}
                      className="text-xs text-team-blue hover:underline disabled:opacity-40 font-medium"
                    >
                      {verificationLoading
                        ? 'Sending…'
                        : 'Send verification email'}
                    </button>
                  </div>
                )}

                {!isPasswordProvider && (
                  <p
                    className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Email is managed by {providerLabel} and cannot be changed
                    here.
                  </p>
                )}
              </div>
            )}
          </Field>
        </Section>

        <div id="team" className="scroll-mt-24">
          <Section
            icon={Users}
            title="Team"
            description={
              team
                ? `${
                    teamService.ownerOf(team) === user.uid
                      ? "You're the owner"
                      : "You're a member"
                  } · ${team.members.length} member${team.members.length === 1 ? '' : 's'}`
                : 'Share sessions with teammates. You can be in one team at a time.'
            }
            isDarkMode={isDarkMode}
          >
            <TeamManager />
          </Section>
        </div>

        <Section
          icon={Lock}
          title="Security"
          isDarkMode={isDarkMode}
        >
          {isPasswordProvider ? (
            <Field label="Password" isDarkMode={isDarkMode}>
              {editingPassword ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => {
                        setCurrentPassword(e.target.value);
                        clearFieldError('currentPassword');
                      }}
                      placeholder="Current password"
                      aria-label="Current password"
                      autoComplete="current-password"
                      aria-invalid={!!fieldErrors.currentPassword || undefined}
                      aria-describedby={
                        fieldErrors.currentPassword
                          ? 'profile-current-password-error'
                          : undefined
                      }
                      autoFocus
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      aria-label={
                        showCurrentPassword ? 'Hide password' : 'Show password'
                      }
                      className={`absolute inset-y-0 right-0 w-10 inline-flex items-center justify-center transition-colors ${isDarkMode ? 'text-team-white-40 hover:text-team-blue' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {showCurrentPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {fieldErrors.currentPassword && (
                    <FieldError
                      id="profile-current-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.currentPassword}
                    </FieldError>
                  )}
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value);
                        clearFieldError('newPassword');
                      }}
                      placeholder={`New password (min. ${MIN_PASSWORD_LENGTH} characters)`}
                      aria-label="New password"
                      autoComplete="new-password"
                      aria-invalid={!!fieldErrors.newPassword || undefined}
                      aria-describedby={
                        fieldErrors.newPassword
                          ? 'profile-new-password-error'
                          : undefined
                      }
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={
                        showNewPassword ? 'Hide password' : 'Show password'
                      }
                      className={`absolute inset-y-0 right-0 w-10 inline-flex items-center justify-center transition-colors ${isDarkMode ? 'text-team-white-40 hover:text-team-blue' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {fieldErrors.newPassword && (
                    <FieldError
                      id="profile-new-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.newPassword}
                    </FieldError>
                  )}
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') savePassword();
                      if (e.key === 'Escape') {
                        setEditingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    placeholder="Confirm new password"
                    aria-label="Confirm new password"
                    autoComplete="new-password"
                    aria-invalid={passwordsDiffer || undefined}
                    aria-describedby={
                      passwordsDiffer
                        ? 'profile-confirm-password-error'
                        : undefined
                    }
                    className="h-10"
                  />
                  {passwordsDiffer && (
                    <FieldError
                      id="profile-confirm-password-error"
                      isDarkMode={isDarkMode}
                    >
                      New passwords do not match.
                    </FieldError>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        passwordLoading ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword ||
                        passwordsDiffer
                      }
                      onClick={savePassword}
                      className={isDarkMode ? 'text-black' : 'text-white'}
                    >
                      {passwordLoading ? 'Updating…' : 'Update Password'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowCurrentPassword(false);
                        setShowNewPassword(false);
                      }}
                      className={
                        isDarkMode
                          ? 'border-team-blue-40 text-team-white-60'
                          : ''
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p
                    className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    ••••••••••••
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setEditingPassword(true);
                      clearFieldError('currentPassword', 'newPassword');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
            </Field>
          ) : (
            <div
              className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-team-blue/5' : 'bg-gray-50'}`}
            >
              <Shield
                size={16}
                className={isDarkMode ? 'text-team-white-60' : 'text-gray-400'}
              />
              <p
                className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
              >
                Your password is managed by {providerLabel}. Sign in through
                your {providerLabel} account to manage security settings.
              </p>
            </div>
          )}
        </Section>

        <Section
          icon={Link2}
          title="Share Links"
          description="Public pages made from sessions. Anyone with a link can open it until it is removed."
          isDarkMode={isDarkMode}
        >
          <ShareLinks userId={user.uid} isDarkMode={isDarkMode} />
        </Section>

        <Section
          icon={Trash2}
          title="Danger Zone"
          isDarkMode={isDarkMode}
          variant="danger"
        >
          {showDeleteConfirm ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription className="space-y-2">
                  <p>
                    This deletes your account, every session you recorded
                    {team
                      ? ` (including ones shared with ${team.name}, which teammates will no longer see)`
                      : ''}{' '}
                    and your share links.
                  </p>
                  {team && (
                    <p className="font-medium">
                      {describeTeamAfterDelete(team, user.uid)}
                    </p>
                  )}
                  <p>
                    This cannot be undone.{' '}
                    {/* A 44px target on a phone (global.css); the negative
                        margin keeps that from doubling the space under it */}
                    <Link
                      to={ROUTES.SESSIONS}
                      className="inline-flex items-center font-semibold underline underline-offset-2 hover:no-underline [@media(max-width:640px)]:-mb-3"
                    >
                      Export sessions (CSV) first
                    </Link>
                  </p>
                </AlertDescription>
              </Alert>

              {isPasswordProvider && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="delete-password"
                    className={`text-xs font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                  >
                    Confirm your password
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={e => {
                      setDeletePassword(e.target.value);
                      clearFieldError('deletePassword');
                    }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.deletePassword || undefined}
                    aria-describedby={
                      fieldErrors.deletePassword
                        ? 'delete-password-error'
                        : undefined
                    }
                    autoFocus
                    className="h-10"
                  />
                  {fieldErrors.deletePassword && (
                    <FieldError
                      id="delete-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.deletePassword}
                    </FieldError>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="delete-confirm-text"
                  className={`text-xs font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  Type{' '}
                  <span
                    className={`font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}
                  >
                    DELETE
                  </span>{' '}
                  to confirm
                </Label>
                <Input
                  id="delete-confirm-text"
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE"'
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="h-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    deleteLoading ||
                    deleteConfirmText !== 'DELETE' ||
                    (isPasswordProvider && !deletePassword)
                  }
                  onClick={handleDeleteAccount}
                >
                  {deleteLoading ? 'Deleting…' : 'Permanently Delete'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                    setDeleteConfirmText('');
                    clearFieldError('deletePassword');
                  }}
                  className={
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white-60'
                      : ''
                  }
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // The button never shrinks below its label; on the narrowest
            // phones it drops under the text instead of squeezing it.
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-44">
                <p
                  className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Delete your account
                </p>
                <p
                  className={`text-xs mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Permanently remove your account, sessions and share links
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={`shrink-0 whitespace-nowrap border-red-500/40 hover:bg-red-500/10 hover:border-red-500/60 ${
                  isDarkMode
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-red-700 hover:text-red-800'
                }`}
                onClick={() => {
                  setShowDeleteConfirm(true);
                  clearFieldError('deletePassword');
                }}
              >
                Delete Account
              </Button>
            </div>
          )}
        </Section>
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className={`max-w-md ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
        >
          <DialogHeader
            className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}
          >
            <DialogTitle
              id="logout-confirm-title"
              className={isDarkMode ? 'text-white' : 'text-gray-900'}
            >
              Sign out and lose this session?
            </DialogTitle>
            <DialogDescription
              className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}
            >
              {signOutLoss}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutConfirm(false)}
              className={
                isDarkMode ? 'border-team-blue-40 text-team-white-60' : ''
              }
            >
              Stay Signed In
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (signOutArmed()) signOut();
              }}
            >
              Sign Out Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
