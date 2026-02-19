import { useState } from 'react';
import { useAuth, useTheme } from '@/contexts';
import { getInitials } from '@/lib/utils';
import { UI_TIMING } from '@/constants';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, Edit2, X, Check } from 'lucide-react';

const Profile = () => {
  const { user, logout, updateDisplayName, updateUserEmail } = useAuth();
  const { isDarkMode } = useTheme();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  // Email editing
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), UI_TIMING.MESSAGE_DISPLAY_TIMEOUT);
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
    } catch {
      // Logout errors are non-critical — user is already navigating away
    } finally {
      setLoading(false);
    }
  };

  const startEditName = () => {
    setNameValue(user?.displayName || '');
    setEditingName(true);
    setMessage(null);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameValue('');
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    try {
      setNameLoading(true);
      await updateDisplayName(nameValue.trim());
      setEditingName(false);
      showMessage('Display name updated.', 'success');
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : 'Failed to update name.',
        'error'
      );
    } finally {
      setNameLoading(false);
    }
  };

  const startEditEmail = () => {
    setEmailValue(user?.email || '');
    setPasswordValue('');
    setEditingEmail(true);
    setMessage(null);
  };

  const cancelEditEmail = () => {
    setEditingEmail(false);
    setEmailValue('');
    setPasswordValue('');
  };

  const saveEmail = async () => {
    if (!emailValue.trim() || !passwordValue) return;
    try {
      setEmailLoading(true);
      await updateUserEmail(emailValue.trim(), passwordValue);
      setEditingEmail(false);
      showMessage('Email updated successfully.', 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update email.';
      const friendly =
        msg.includes('wrong-password') || msg.includes('invalid-credential')
          ? 'Incorrect password. Please try again.'
          : msg.includes('email-already-in-use')
            ? 'That email is already in use by another account.'
            : msg.includes('invalid-email')
              ? 'Please enter a valid email address.'
              : msg;
      showMessage(friendly, 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
    </div>
  );

  const inputBase = `w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-team-blue/50 ${
    isDarkMode
      ? 'bg-team-dark border-team-blue-40 text-white placeholder:text-team-white-60'
      : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
  }`;

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-[1152px] mx-auto">
        <Card
          className={
            isDarkMode
              ? 'bg-team-dark-20 border-team-blue-40'
              : 'bg-white border-gray-200'
          }
        >
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                />
                <AvatarFallback
                  className={`bg-team-blue text-xl ${isDarkMode ? '!text-black' : '!text-white'}`}
                >
                  {getInitials(user.displayName || user.email || 'User')}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle
              className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              {user.displayName || 'User Profile'}
            </CardTitle>
            <CardDescription
              className={
                isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
              }
            >
              Manage your account settings
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {message && (
              <Alert
                className={
                  message.type === 'error'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-emerald-500/50 bg-emerald-500/10'
                }
              >
                <AlertDescription
                  className={
                    message.type === 'error'
                      ? 'text-red-500'
                      : 'text-emerald-600'
                  }
                >
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* Display Name */}
            <div className="flex items-start gap-3">
              <User
                className={`h-5 w-5 mt-1 shrink-0 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
              />
              <div className="flex-1 min-w-0">
                <Label
                  className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Display Name
                </Label>
                {editingName ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      className={inputBase}
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') cancelEditName();
                      }}
                      autoFocus
                      placeholder="Display name"
                    />
                    <button
                      onClick={saveName}
                      disabled={nameLoading || !nameValue.trim()}
                      className="p-2 rounded-lg bg-team-blue/20 text-team-blue hover:bg-team-blue/30 disabled:opacity-40 transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={cancelEditName}
                      className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-team-dark text-team-white-60 hover:bg-team-blue/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p
                      className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                    >
                      {user.displayName || 'Not set'}
                    </p>
                    <button
                      onClick={startEditName}
                      className={`p-1 rounded transition-colors opacity-60 hover:opacity-100 ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-gray-100'}`}
                    >
                      <Edit2 size={13} className="text-team-blue" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Separator
              className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'}
            />

            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail
                className={`h-5 w-5 mt-1 shrink-0 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
              />
              <div className="flex-1 min-w-0">
                <Label
                  className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Email Address
                </Label>
                {editingEmail ? (
                  <div className="mt-2 space-y-2">
                    <input
                      className={inputBase}
                      type="email"
                      value={emailValue}
                      onChange={e => setEmailValue(e.target.value)}
                      placeholder="New email address"
                      autoFocus
                    />
                    <input
                      className={inputBase}
                      type="password"
                      value={passwordValue}
                      onChange={e => setPasswordValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEmail();
                        if (e.key === 'Escape') cancelEditEmail();
                      }}
                      placeholder="Current password to confirm"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveEmail}
                        disabled={
                          emailLoading || !emailValue.trim() || !passwordValue
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-team-blue/20 text-team-blue hover:bg-team-blue/30 disabled:opacity-40 transition-colors text-sm font-medium"
                      >
                        <Check size={14} />
                        {emailLoading ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditEmail}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${isDarkMode ? 'bg-team-dark text-team-white-60 hover:bg-team-blue/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p
                      className={`text-sm truncate ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                    >
                      {user.email}
                    </p>
                    <button
                      onClick={startEditEmail}
                      className={`p-1 rounded transition-colors opacity-60 hover:opacity-100 shrink-0 ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-gray-100'}`}
                      style={{ display: user.providerId === 'password' || !user.providerId ? 'inline-flex' : 'none' }}
                    >
                      <Edit2 size={13} className="text-team-blue" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Separator
              className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'}
            />

            {/* Account Provider */}
            <div className="flex items-center gap-3">
              <Shield
                className={`h-5 w-5 shrink-0 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
              />
              <div>
                <Label
                  className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  Account Provider
                </Label>
                <p
                  className={`text-sm ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                >
                  {user.providerId === 'google.com'
                    ? 'Google'
                    : user.providerId === 'github.com'
                      ? 'GitHub'
                      : 'Email & Password'}
                </p>
              </div>
            </div>

            <Separator
              className={isDarkMode ? 'bg-team-blue-40' : 'bg-gray-200'}
            />

            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? 'Signing Out…' : 'Sign Out'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
