import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { Button } from '@/components/ui/button';
import { X, UserPlus } from 'lucide-react';
import { ROUTES, STORAGE_KEYS } from '@/constants';

const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // Show once per day

const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD];

export const GuestPrompt = () => {
  const { isGuest } = useAuth();
  const { isDarkMode, themeMode } = useTheme();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  // Hide on auth pages where user is already trying to sign up/log in
  const isOnAuthPage = (AUTH_ROUTES as readonly string[]).includes(
    location.pathname
  );

  useEffect(() => {
    if (!isGuest) {
      setIsVisible(false);
      return;
    }

    const dismissed = localStorage.getItem(STORAGE_KEYS.GUEST_PROMPT_DISMISSED);
    if (dismissed === 'true') {
      return;
    }

    const lastShown = localStorage.getItem(STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN);
    const now = Date.now();

    if (!lastShown || now - parseInt(lastShown) > PROMPT_INTERVAL_MS) {
      setIsVisible(true);
      localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN, now.toString());
    }
  }, [isGuest]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN, Date.now().toString());
  };

  const handlePermanentDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_DISMISSED, 'true');
  };

  if (!isVisible || !isGuest || isOnAuthPage) {
    return null;
  }

  // Use inline style for background to avoid honeycomb/deepsea global CSS making bg-team-dark transparent
  const bgStyle = isDarkMode
    ? {
        backgroundColor:
          themeMode === 'honeycomb' ? '#0a0a0a' : themeMode === 'deepsea' ? '#0a1628' : '#191919',
      }
    : undefined;

  return (
    <div
      style={bgStyle}
      className={`fixed bottom-4 right-4 max-w-md rounded-lg shadow-2xl border-2 p-4 z-50 animate-slide-up ${
        isDarkMode
          ? 'border-team-blue-40'
          : 'bg-gradient-to-br from-white to-blue-50 border-blue-200'
      }`}
    >
      <button
        onClick={handleDismiss}
        className={`absolute top-2 right-2 p-1 rounded hover:bg-opacity-20 ${
          isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-900'
        }`}
        aria-label="Dismiss"
      >
        <X
          className={`h-4 w-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div
          className={`p-2 rounded-lg ${
            isDarkMode ? 'bg-team-blue-20' : 'bg-blue-100'
          }`}
        >
          <UserPlus className="h-5 w-5 text-team-blue" />
        </div>
        <div>
          <h3
            className={`font-semibold text-base mb-1 ${
              isDarkMode ? 'text-team-white' : 'text-gray-900'
            }`}
          >
            Save Your Progress!
          </h3>
          <p
            className={`text-sm ${
              isDarkMode ? 'text-team-white-60' : 'text-gray-600'
            }`}
          >
            Guest sessions are stored only in this browser and will be lost if
            you clear your data. Create an account to save them permanently.
          </p>
        </div>
      </div>

      <div className="flex gap-2 ml-11">
        <Link to={ROUTES.SIGNUP} className="flex-1">
          <Button
            className={`w-full bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
            size="sm"
          >
            Sign Up
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePermanentDismiss}
          className={
            isDarkMode
              ? 'text-team-white-60 hover:text-team-white'
              : 'text-gray-600 hover:text-gray-900'
          }
        >
          Don't ask again
        </Button>
      </div>
    </div>
  );
};
