import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme } from '@/contexts';
import { Button } from '@/components/ui/button';
import { X, UserPlus } from 'lucide-react';
import { ROUTES, STORAGE_KEYS } from '@/constants';

const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // Show once per day

const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD];

/** Gap between the card and the screen edge (`bottom-4`), in px */
const CARD_GAP = 16;

export const GuestPrompt = () => {
  const { isGuest, guestId } = useAuth();
  const { isDarkMode, themeMode } = useTheme();
  const { isTutorialActive, matchActive } = useSessionCore();
  const location = useLocation();
  /** Due to be shown: not dismissed for good, and not shown in the last day */
  const [isDue, setIsDue] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  // Hide on auth pages where user is already trying to sign up/log in
  const isOnAuthPage = (AUTH_ROUTES as readonly string[]).includes(
    location.pathname
  );
  const isOnActivePage = location.pathname.startsWith(ROUTES.ACTIVE);

  useEffect(() => {
    if (!isGuest) {
      setIsDue(false);
      return;
    }

    const dismissed = localStorage.getItem(STORAGE_KEYS.GUEST_PROMPT_DISMISSED);
    if (dismissed === 'true') {
      return;
    }

    const lastShown = localStorage.getItem(STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN);

    if (!lastShown || Date.now() - parseInt(lastShown) > PROMPT_INTERVAL_MS) {
      setIsDue(true);
    }
  }, [isGuest]);

  // A first-time guest gets the tutorial before anything else. The tutorial
  // records that it has been seen as it closes, so look again once it does
  // (same key as ActiveTutorial).
  useEffect(() => {
    if (isTutorialActive) return;
    const key = guestId
      ? `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`
      : STORAGE_KEYS.TUTORIAL_SEEN;
    setTutorialSeen(!!localStorage.getItem(key));
  }, [isTutorialActive, guestId, location.pathname]);

  // Held back while it would be in the way: on the sign-in pages, before a
  // new guest has been shown around, while a match is running, and anywhere
  // on the scoring page. That page is controls from top to bottom, and the
  // card sat on the setup's Save button and on Complete Session. It waits
  // for the next page instead, e.g. the sessions list or the analysis the
  // finished session leads to (it only counts as shown once it is on screen).
  const isVisible =
    isDue &&
    isGuest &&
    !isOnAuthPage &&
    !isOnActivePage &&
    !isTutorialActive &&
    tutorialSeen &&
    !matchActive;

  // Counts as shown only once it is really on screen.
  useEffect(() => {
    if (!isVisible) return;
    localStorage.setItem(
      STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN,
      Date.now().toString()
    );
  }, [isVisible]);

  // Tracked for the room left under the page (see below).
  useEffect(() => {
    if (!cardEl) return;
    const measure = () =>
      setCardHeight(Math.round(cardEl.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cardEl);
    return () => observer.disconnect();
  }, [cardEl]);

  const handleDismiss = () => {
    setIsDue(false);
    localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN, Date.now().toString());
  };

  const handlePermanentDismiss = () => {
    setIsDue(false);
    localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_DISMISSED, 'true');
  };

  if (!isVisible) {
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
    <>
      {/* The card stays over the bottom of the screen, so whatever the page
          ends with would be stuck under it (on a phone it is as wide as the
          page). The page gets that much more room, in its own colour, to
          scroll its last rows clear. */}
      <div
        aria-hidden="true"
        className={`shrink-0 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
        style={{ height: cardHeight + CARD_GAP * 2 }}
      />
      {/* z-40: under a dialog's backdrop (z-50). At the same level the card,
          later in the page, sat on the Edit Match dialog's Cancel / Update
          Match and took their taps. */}
      <div
        ref={setCardEl}
        style={bgStyle}
        className={`fixed bottom-4 left-4 right-4 ml-auto sm:left-auto max-w-md rounded-lg shadow-2xl border-2 p-4 z-40 animate-slide-up ${
          isDarkMode
            ? 'border-team-blue-40'
            : 'bg-gradient-to-br from-white to-blue-50 border-blue-200'
        }`}
      >
        <button
          onClick={handleDismiss}
          className={`absolute top-2 right-2 inline-flex items-center justify-center p-1 rounded hover:bg-opacity-20 ${
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
          <Button
            asChild
            className={`flex-1 bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
            size="sm"
          >
            <Link to={ROUTES.SIGNUP}>Sign Up</Link>
          </Button>
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
    </>
  );
};
