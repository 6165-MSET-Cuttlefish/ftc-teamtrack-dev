import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { getInitials } from '@/lib';
import { mapAuthError, isWrongPasswordError } from '@/lib/authErrors';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PAGE_TITLE_CLASS,
  SECTION_TITLE_CLASS,
} from '@/components/ui/page-header';
import { BadgeCheck, AlertCircle, Trash2, Eye, EyeOff } from 'lucide-react';
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

/** A card with an h2 title (the page's h1 is "Profile") */
const Section = ({
  title,
  description,
  children,
  isDarkMode,
  variant = 'default',
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
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
      <CardHeader className="pb-4 px-5 sm:px-6 pt-5 sm:pt-6 space-y-0.5">
        <CardTitle
          as="h2"
          className={`${SECTION_TITLE_CLASS} leading-snug tracking-normal ${
            variant === 'danger'
              ? // red-500 is under 4.5:1 on the light background
                isDarkMode
                ? 'text-red-400'
                : 'text-red-700'
              : ''
          }`}
        >
          {title}
        </CardTitle>
        {description && (
          <CardDescription
            className={`text-xs ${
              isDarkMode ? 'text-team-white-60' : 'text-gray-500'
            }`}
          >
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
        {children}
      </CardContent>
    </Card>
  );
};

/** The small capitals over a field (Display name, Email, Current password…) */
const fieldLabelClass = (isDarkMode: boolean) =>
  `text-xs font-medium uppercase tracking-wider ${
    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
  }`;

const Field = ({
  label,
  htmlFor,
  children,
  isDarkMode,
}: {
  label: string;
  /** The input it names, when there is one */
  htmlFor?: string;
  children: ReactNode;
  isDarkMode: boolean;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className={fieldLabelClass(isDarkMode)}>
      {label}
    </Label>
    {children}
  </div>
);

/**
 * A password input with its own show/hide eye. Every password field on the
 * page has one, so a stack of them lines up.
 */
const PasswordInput = ({
  id,
  value,
  onChange,
  onKeyDown,
  autoComplete,
  placeholder,
  errorId,
  invalid,
  autoFocus,
  isDarkMode,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  /** The id of the error under the field, while it shows one */
  errorId?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  isDarkMode: boolean;
}) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative sm:max-w-sm">
      <Input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        autoFocus={autoFocus}
        className="h-10 pr-10"
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-controls={id}
        className={`absolute inset-y-0 right-0 w-10 inline-flex items-center justify-center transition-colors ${isDarkMode ? 'text-team-white-40 hover:text-team-blue' : 'text-gray-400 hover:text-gray-600'}`}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

/**
 * Save and Cancel beside an inline field: as tall as the field (h-10, 44px
 * on a phone like the field), and on their own line, halving it, under
 * 360px so neither is squeezed.
 */
const INLINE_EDIT_ROW = 'flex flex-wrap items-center gap-2';
const INLINE_EDIT_INPUT =
  'h-10 min-w-0 w-full min-[360px]:w-auto min-[360px]:flex-1';
const INLINE_EDIT_BUTTON = 'h-10 px-4 text-sm max-[359px]:flex-1';

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
    updateDisplayName,
    updateUserEmail,
    sendVerificationEmail,
    updateUserPassword,
    deleteAccount,
  } = useAuth();
  const { isDarkMode } = useTheme();
  const { team, updateMemberDisplayName } = useTeam();

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

  const signedIn = !!user && !isGuest;
  /**
   * Signed in at some point while this page was open: signing out (from the
   * account menu) or deleting the account from here is not "please sign in".
   */
  const wasSignedInRef = useRef(signedIn);
  useEffect(() => {
    if (signedIn) wasSignedInRef.current = true;
  }, [signedIn]);
  // A guest who opens /profile (a bookmark, an old tab) is told once. From
  // an effect, not while rendering: React may render this several times
  // before the redirect commits, and the id keeps it to one toast anyway.
  useEffect(() => {
    if (signedIn || wasSignedInRef.current) return;
    toast.error('Please sign in to view your profile', {
      id: 'profile-needs-account',
    });
  }, [signedIn]);

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

  const [verificationLoading, setVerificationLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isPasswordProvider =
    user?.providerId === 'password' || !user?.providerId;

  /** Both new-password fields are filled in and disagree (shown as it is typed) */
  const passwordsDiffer =
    !!newPassword && !!confirmPassword && newPassword !== confirmPassword;

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
   * Report a failed account change, once. An error one field caused (the
   * wrong current password, an email already taken, a weak new password) is
   * written under that field, where it stays until the field is edited or
   * the form is sent again; anything else is a toast.
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
    else toast.error(info.message);
  };

  const cancelNameEdit = () => {
    setEditingName(false);
    setNameValue('');
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    try {
      setNameLoading(true);
      await updateDisplayName(nameValue.trim());
      await updateMemberDisplayName(nameValue.trim());
      setEditingName(false);
      toast.success('Display name updated');
    } catch (err) {
      showAuthError(err);
    } finally {
      setNameLoading(false);
    }
  };

  const cancelEmailEdit = () => {
    setEditingEmail(false);
    setEmailValue('');
    setEmailPasswordValue('');
    clearFieldError('email', 'emailPassword');
  };

  const saveEmail = async () => {
    if (!emailValue.trim() || !emailPasswordValue) return;
    clearFieldError('email', 'emailPassword');
    try {
      setEmailLoading(true);
      await updateUserEmail(emailValue.trim(), emailPasswordValue);
      setEditingEmail(false);
      toast.success('Email updated');
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
      toast.success(
        'Verification email sent. Check your inbox, then refresh this page.'
      );
    } catch (err) {
      showAuthError(err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const cancelPasswordEdit = () => {
    setEditingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    clearFieldError('currentPassword', 'newPassword');
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    clearFieldError('currentPassword', 'newPassword');
    // Already said under Confirm new password, as it is typed.
    if (newPassword !== confirmPassword) return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFieldError(
        'newPassword',
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    try {
      setPasswordLoading(true);
      await updateUserPassword(currentPassword, newPassword);
      setEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (err) {
      showAuthError(err, {
        password: 'currentPassword',
        newPassword: 'newPassword',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletePassword('');
    setDeleteConfirmText('');
    clearFieldError('deletePassword');
  };

  const handleDeleteAccount = async () => {
    clearFieldError('deletePassword');
    try {
      setDeleteLoading(true);
      await deleteAccount(isPasswordProvider ? deletePassword : undefined);
      toast.success('Your account and data were deleted');
    } catch (err) {
      showAuthError(err, { password: 'deletePassword' });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!signedIn || !user) {
    // Signed out or deleted from this page: that isn't "please sign in".
    return (
      <Navigate
        to={wasSignedInRef.current ? ROUTES.LOGIN : ROUTES.SESSIONS}
        replace
      />
    );
  }

  const providerLabel =
    PROVIDER_LABELS[user.providerId || 'password'] ||
    user.providerId ||
    'Email & Password';

  const strongText = isDarkMode ? 'text-white' : 'text-gray-900';
  const mutedText = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const verifiedTone = isDarkMode ? 'text-emerald-400' : 'text-emerald-700';
  const unverifiedTone = isDarkMode ? 'text-amber-400' : 'text-amber-700';
  const isOwner = !!team && teamService.ownerOf(team) === user.uid;

  return (
    // flex-1 under the header (main is a flex column), not a second screen
    // height that scrolls by exactly the header.
    <div
      className={`flex-1 ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-6 sm:py-10 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className={PAGE_TITLE_CLASS}>Profile</h1>

        {/* Who you are, once: the avatar beside the name, Verified as the
            email's badge. Sign out is in the account menu. */}
        <Section title="Profile Information" isDarkMode={isDarkMode}>
          <Field
            label="Display Name"
            htmlFor={editingName ? 'profile-display-name' : undefined}
            isDarkMode={isDarkMode}
          >
            {editingName ? (
              <div className={INLINE_EDIT_ROW}>
                <Input
                  id="profile-display-name"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') cancelNameEdit();
                  }}
                  autoFocus
                  placeholder="Enter display name"
                  autoComplete="name"
                  className={INLINE_EDIT_INPUT}
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={nameLoading || !nameValue.trim()}
                  onClick={saveName}
                  className={INLINE_EDIT_BUTTON}
                >
                  {nameLoading ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={cancelNameEdit}
                  className={INLINE_EDIT_BUTTON}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.photoURL || ''} alt="" />
                  <AvatarFallback
                    className={`text-sm font-semibold ${
                      isDarkMode
                        ? 'bg-team-white-10 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {getInitials(user.displayName || user.email || 'User')}
                  </AvatarFallback>
                </Avatar>
                <p
                  className={`flex-1 min-w-0 text-sm font-medium break-words [overflow-wrap:anywhere] ${strongText}`}
                >
                  {user.displayName || (
                    <span className="italic opacity-50">Not set</span>
                  )}
                </p>
                <Button
                  variant="neutral"
                  size="sm"
                  className="shrink-0"
                  aria-label="Edit display name"
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

          <Field
            label="Email"
            htmlFor={editingEmail ? 'profile-email' : undefined}
            isDarkMode={isDarkMode}
          >
            {editingEmail ? (
              <div className="space-y-3">
                <Input
                  id="profile-email"
                  type="email"
                  value={emailValue}
                  onChange={e => {
                    setEmailValue(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="New email address"
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email || undefined}
                  aria-describedby={
                    fieldErrors.email ? 'profile-email-error' : undefined
                  }
                  autoFocus
                  className="h-10 sm:max-w-sm"
                />
                {fieldErrors.email && (
                  <FieldError id="profile-email-error" isDarkMode={isDarkMode}>
                    {fieldErrors.email}
                  </FieldError>
                )}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="profile-email-password"
                    className={fieldLabelClass(isDarkMode)}
                  >
                    Current password
                  </Label>
                  <PasswordInput
                    id="profile-email-password"
                    value={emailPasswordValue}
                    onChange={value => {
                      setEmailPasswordValue(value);
                      clearFieldError('emailPassword');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEmail();
                      if (e.key === 'Escape') cancelEmailEdit();
                    }}
                    placeholder="To confirm it's you"
                    autoComplete="current-password"
                    invalid={!!fieldErrors.emailPassword}
                    errorId="profile-email-password-error"
                    isDarkMode={isDarkMode}
                  />
                  {fieldErrors.emailPassword && (
                    <FieldError
                      id="profile-email-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.emailPassword}
                    </FieldError>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      emailLoading || !emailValue.trim() || !emailPasswordValue
                    }
                    onClick={saveEmail}
                    className={INLINE_EDIT_BUTTON}
                  >
                    {emailLoading ? 'Saving…' : 'Save email'}
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={cancelEmailEdit}
                    className={INLINE_EDIT_BUTTON}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p
                    className={`text-sm font-medium break-words [overflow-wrap:anywhere] ${strongText}`}
                  >
                    {user.email}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                    {user.emailVerified ? (
                      <span
                        className={`inline-flex items-center gap-1 ${verifiedTone}`}
                      >
                        <BadgeCheck aria-hidden="true" size={13} />
                        Verified
                      </span>
                    ) : (
                      <>
                        <span
                          className={`inline-flex items-center gap-1 ${unverifiedTone}`}
                        >
                          <AlertCircle aria-hidden="true" size={13} />
                          Not verified
                        </span>
                        <button
                          type="button"
                          onClick={handleSendVerification}
                          disabled={verificationLoading}
                          className="text-team-blue hover:underline disabled:opacity-40"
                        >
                          {verificationLoading
                            ? 'Sending…'
                            : 'Send verification email'}
                        </button>
                      </>
                    )}
                    {!isPasswordProvider && (
                      <span className={`font-normal ${mutedText}`}>
                        Managed by your {providerLabel} account
                      </span>
                    )}
                  </div>
                </div>
                {isPasswordProvider && (
                  <Button
                    variant="neutral"
                    size="sm"
                    className="shrink-0"
                    aria-label="Edit email"
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
            )}
          </Field>
        </Section>

        <div id="team" className="scroll-mt-24">
          <Section
            title="Team"
            description={
              team ? (
                <>
                  {isOwner ? "You're the owner" : "You're a member"}
                  {/* From sm up the team button carries the count */}
                  <span className="sm:hidden">
                    {` · ${team.members.length} member${team.members.length === 1 ? '' : 's'}`}
                  </span>
                </>
              ) : (
                'Share sessions with teammates. You can be in one team at a time.'
              )
            }
            isDarkMode={isDarkMode}
          >
            <TeamManager compact />
          </Section>
        </div>

        {/* Only a password can be changed here; a Google account's security
            is Google's, which the email row already says. */}
        {isPasswordProvider && (
          <Section title="Security" isDarkMode={isDarkMode}>
            {editingPassword ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="profile-current-password"
                    className={fieldLabelClass(isDarkMode)}
                  >
                    Current password
                  </Label>
                  <PasswordInput
                    id="profile-current-password"
                    value={currentPassword}
                    onChange={value => {
                      setCurrentPassword(value);
                      clearFieldError('currentPassword');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') cancelPasswordEdit();
                    }}
                    autoComplete="current-password"
                    invalid={!!fieldErrors.currentPassword}
                    errorId="profile-current-password-error"
                    autoFocus
                    isDarkMode={isDarkMode}
                  />
                  {fieldErrors.currentPassword && (
                    <FieldError
                      id="profile-current-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.currentPassword}
                    </FieldError>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="profile-new-password"
                    className={fieldLabelClass(isDarkMode)}
                  >
                    New password
                  </Label>
                  <PasswordInput
                    id="profile-new-password"
                    value={newPassword}
                    onChange={value => {
                      setNewPassword(value);
                      clearFieldError('newPassword');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') cancelPasswordEdit();
                    }}
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    autoComplete="new-password"
                    invalid={!!fieldErrors.newPassword}
                    errorId="profile-new-password-error"
                    isDarkMode={isDarkMode}
                  />
                  {fieldErrors.newPassword && (
                    <FieldError
                      id="profile-new-password-error"
                      isDarkMode={isDarkMode}
                    >
                      {fieldErrors.newPassword}
                    </FieldError>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="profile-confirm-password"
                    className={fieldLabelClass(isDarkMode)}
                  >
                    Confirm new password
                  </Label>
                  <PasswordInput
                    id="profile-confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    onKeyDown={e => {
                      if (e.key === 'Enter') savePassword();
                      if (e.key === 'Escape') cancelPasswordEdit();
                    }}
                    autoComplete="new-password"
                    invalid={passwordsDiffer}
                    errorId="profile-confirm-password-error"
                    isDarkMode={isDarkMode}
                  />
                  {passwordsDiffer && (
                    <FieldError
                      id="profile-confirm-password-error"
                      isDarkMode={isDarkMode}
                    >
                      New passwords do not match.
                    </FieldError>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      passwordLoading ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      passwordsDiffer
                    }
                    onClick={savePassword}
                    className={INLINE_EDIT_BUTTON}
                  >
                    {passwordLoading ? 'Updating…' : 'Update password'}
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={cancelPasswordEdit}
                    className={INLINE_EDIT_BUTTON}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Field label="Password" isDarkMode={isDarkMode}>
                <div className="flex items-center justify-between gap-3">
                  <p aria-hidden="true" className={`text-sm ${strongText}`}>
                    ••••••••••••
                  </p>
                  <Button
                    variant="neutral"
                    size="sm"
                    aria-label="Change password"
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
              </Field>
            )}
          </Section>
        )}

        <Section
          title="Share Links"
          description="Public pages made from sessions. Anyone with a link can open it until it is removed."
          isDarkMode={isDarkMode}
        >
          <ShareLinks userId={user.uid} isDarkMode={isDarkMode} />
        </Section>

        <Section title="Danger Zone" isDarkMode={isDarkMode} variant="danger">
          {/* The button never shrinks below its label; on the narrowest
              phones it drops under the text instead of squeezing it. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-44">
              <p className={`text-sm font-medium ${strongText}`}>
                Delete your account
              </p>
              <p className={`text-xs mt-0.5 ${mutedText}`}>
                Permanently remove your account, sessions and share links
              </p>
            </div>
            <Button
              variant="dangerOutline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => {
                clearFieldError('deletePassword');
                setShowDeleteConfirm(true);
              }}
            >
              Delete account
            </Button>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={open => {
          if (!open) closeDeleteConfirm();
        }}
        title="Delete your account?"
        description="Your account, every session you recorded and your share links are deleted for good."
        confirmLabel="Delete account"
        icon={Trash2}
        busy={deleteLoading}
        confirmDisabled={
          deleteConfirmText !== 'DELETE' ||
          (isPasswordProvider && !deletePassword)
        }
        onConfirm={() => void handleDeleteAccount()}
      >
        <div className="space-y-4">
          <p className={`text-sm ${mutedText}`}>
            {team && (
              <>
                Your teammates lose the sessions you shared.{' '}
                {describeTeamAfterDelete(team, user.uid)}{' '}
              </>
            )}
            {/* A 44px target on a phone (global.css); the negative margin
                keeps that from doubling the line's height */}
            <Link
              to={ROUTES.SESSIONS}
              className="inline-flex items-center font-semibold text-team-blue underline underline-offset-2 hover:no-underline [@media(max-width:640px)]:-my-3"
            >
              Export sessions (CSV) first
            </Link>
          </p>

          {isPasswordProvider && (
            <div className="space-y-1.5">
              <Label
                htmlFor="delete-password"
                className={fieldLabelClass(isDarkMode)}
              >
                Your password
              </Label>
              <PasswordInput
                id="delete-password"
                value={deletePassword}
                onChange={value => {
                  setDeletePassword(value);
                  clearFieldError('deletePassword');
                }}
                autoComplete="current-password"
                invalid={!!fieldErrors.deletePassword}
                errorId="delete-password-error"
                isDarkMode={isDarkMode}
              />
              {fieldErrors.deletePassword && (
                <FieldError id="delete-password-error" isDarkMode={isDarkMode}>
                  {fieldErrors.deletePassword}
                </FieldError>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="delete-confirm-text"
              className={fieldLabelClass(isDarkMode)}
            >
              Type{' '}
              <span className={isDarkMode ? 'text-red-400' : 'text-red-700'}>
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
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default Profile;
