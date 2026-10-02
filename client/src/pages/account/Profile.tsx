import { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme, useTeam } from '@/contexts';
import { getInitials } from '@/lib';
import { flushPendingDeletes } from '@/lib/pendingSessionDeletes';
import { describeSignOutLoss } from '@/lib/signOutLoss';
import { UI_TIMING, APP_CONFIG, ROUTES } from '@/constants';
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
} from 'lucide-react';
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
  const { updateMemberDisplayName } = useTeam();
  const { sessionData, matchActive } = useSessionCore();

  useEffect(() => {
    document.title = `Profile - ${APP_CONFIG.name}`;
  }, []);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

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
  /** Set while the user is signing out or deleting their account on purpose */
  const leavingRef = useRef(false);

  // Matches only reach the server when the session is completed; signing out
  // clears the one in progress, a match that is still being scored included.
  const signOutLoss = describeSignOutLoss(sessionData, matchActive);

  const isPasswordProvider =
    user?.providerId === 'password' || !user?.providerId;

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), UI_TIMING.MESSAGE_DISPLAY_TIMEOUT);
  };

  const friendlyAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : 'An error occurred.';
    if (msg.includes('wrong-password') || msg.includes('invalid-credential'))
      return 'Incorrect password. Please try again.';
    if (msg.includes('email-already-in-use'))
      return 'That email is already in use by another account.';
    if (msg.includes('invalid-email'))
      return 'Please enter a valid email address.';
    if (msg.includes('weak-password'))
      return 'Password is too weak. Use at least 6 characters.';
    if (msg.includes('too-many-requests'))
      return 'Too many attempts. Please try again later.';
    if (msg.includes('requires-recent-login'))
      return 'For security, please sign out and sign back in before making this change.';
    if (msg.includes('network-request-failed'))
      return "Couldn't reach the server. Check your connection and try again.";
    return msg;
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
      toast.success('Logged out successfully');
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
      showMessage('Display name updated.', 'success');
    } catch (err) {
      showMessage(friendlyAuthError(err), 'error');
    } finally {
      setNameLoading(false);
    }
  };

  const saveEmail = async () => {
    if (!emailValue.trim() || !emailPasswordValue) return;
    try {
      setEmailLoading(true);
      await updateUserEmail(emailValue.trim(), emailPasswordValue);
      setEditingEmail(false);
      showMessage('Email updated successfully.', 'success');
    } catch (err) {
      showMessage(friendlyAuthError(err), 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      setVerificationLoading(true);
      await sendVerificationEmail();
      showMessage(
        'Verification email sent! Check your inbox and refresh after verifying.',
        'success'
      );
    } catch (err) {
      showMessage(friendlyAuthError(err), 'error');
    } finally {
      setVerificationLoading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      showMessage('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showMessage('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      setPasswordLoading(true);
      await updateUserPassword(currentPassword, newPassword);
      setEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showMessage('Password updated successfully.', 'success');
    } catch (err) {
      showMessage(friendlyAuthError(err), 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      leavingRef.current = true;
      await deleteAccount(isPasswordProvider ? deletePassword : undefined);
      toast.success('Your account and its data have been deleted');
    } catch (err) {
      leavingRef.current = false;
      showMessage(friendlyAuthError(err), 'error');
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

        {message && (
          <Alert
            className={`shadow-sm ${
              message.type === 'error'
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-emerald-500/50 bg-emerald-500/10'
            }`}
          >
            <AlertDescription
              className={
                message.type === 'error'
                  ? isDarkMode
                    ? 'text-red-400'
                    : 'text-red-700'
                  : isDarkMode
                    ? 'text-emerald-400'
                    : 'text-emerald-700'
              }
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

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
                    setMessage(null);
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
                  onChange={e => setEmailValue(e.target.value)}
                  placeholder="New email address"
                  autoFocus
                  className="h-10"
                />
                <div className="relative">
                  <Input
                    type="password"
                    value={emailPasswordValue}
                    onChange={e => setEmailPasswordValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEmail();
                      if (e.key === 'Escape') {
                        setEditingEmail(false);
                        setEmailValue('');
                        setEmailPasswordValue('');
                      }
                    }}
                    placeholder="Current password to confirm"
                    className="h-10"
                  />
                </div>
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
                        setMessage(null);
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
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
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
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password (min. 6 characters)"
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
                    className="h-10"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p
                      className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}
                    >
                      Passwords do not match.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        passwordLoading ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword ||
                        newPassword !== confirmPassword
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
                      setMessage(null);
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
              <Alert className="border-red-500/30 bg-red-500/10">
                <AlertDescription
                  className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}
                >
                  This permanently deletes your account, every session you
                  recorded (including ones your team can see) and your share
                  links, and removes you from your team. If you own the team
                  it passes to its longest-standing member, or is deleted if
                  you are its only member. This action cannot be undone.
                </AlertDescription>
              </Alert>

              {isPasswordProvider && (
                <div className="space-y-1.5">
                  <Label
                    className={`text-xs font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                  >
                    Confirm your password
                  </Label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    className="h-10"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label
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
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE"'
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
              <div>
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
                className={`border-red-500/40 hover:bg-red-500/10 hover:border-red-500/60 ${
                  isDarkMode
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-red-700 hover:text-red-800'
                }`}
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setMessage(null);
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4">
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
            <Button variant="destructive" size="sm" onClick={signOut}>
              Sign Out Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
