import { useState, useEffect } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme } from '@/contexts';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ROUTES, STORAGE_KEYS } from '@/constants';
import { readGuestSessions } from '@/lib/guestSessions';
import {
  requestPersistentStorage,
  safariMayEraseStorage,
} from '@/lib/browserStorage';

const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // Show once per day

const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD];

/** Every page the app has; anything else is the 404 page */
const KNOWN_ROUTES = Object.values(ROUTES);

/** Gap between the card and the screen edge (`bottom-4`), in px */
const CARD_GAP = 16;

export const GuestPrompt = () => {
  const { isGuest, guestId } = useAuth();
  const { isDarkMode } = useTheme();
  const { isTutorialActive, matchActive } = useSessionCore();
  const location = useLocation();
  /** Due to be shown: not dismissed for good, and not shown in the last day */
  const [isDue, setIsDue] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  /** The guest has at least one saved session, i.e. something to back up */
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  /** Safari erases an unvisited site's storage after a week */
  const [safariErases] = useState(safariMayEraseStorage);

  // Hide on auth pages where user is already trying to sign up/log in
  const isOnAuthPage = (AUTH_ROUTES as readonly string[]).includes(
    location.pathname
  );
  const isOnActivePage = location.pathname.startsWith(ROUTES.ACTIVE);
  const isOnSessionsPage = location.pathname.startsWith(ROUTES.SESSIONS);
  // The 404 page has nothing of theirs on it to back up
  const isOnKnownPage = KNOWN_ROUTES.some(
    route => matchPath(route, location.pathname) !== null
  );

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

  // Asked on value, not on arrival: there is nothing to back up until a
  // session has been saved. Completing one leads to another page, so looking
  // again on each page change is enough to notice it.
  useEffect(() => {
    const saved = isGuest && readGuestSessions().length > 0;
    setHasSavedSession(saved);
    // Once there is something to lose, ask the browser to keep this site's
    // storage rather than clear it (granted where the browser trusts the
    // site, such as an app added to the Home Screen).
    if (saved) requestPersistentStorage();
  }, [isGuest, location.pathname]);

  // A first-time guest gets the tutorial before anything else. The tutorial
  // records that it has been seen as it closes, so look again once it does
  // (same keys as ActiveTutorial). Seen on this device by anyone counts too:
  // the tutorial does not open again for a new guest on the same phone.
  useEffect(() => {
    if (isTutorialActive) return;
    const key = guestId
      ? `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`
      : STORAGE_KEYS.TUTORIAL_SEEN;
    setTutorialSeen(
      !!localStorage.getItem(key) ||
        !!localStorage.getItem(STORAGE_KEYS.TUTORIAL_SEEN)
    );
  }, [isTutorialActive, guestId, location.pathname]);

  // Held back while it would be in the way: on the sign-in pages, before a
  // new guest has been shown around, while a match is running, and anywhere
  // on the scoring page. That page is controls from top to bottom, and the
  // card sat on the setup's Save button and on Complete Session. It waits
  // for the next page instead, e.g. the analysis the finished session leads
  // to (it only counts as shown once it is on screen). The sessions list
  // says the same thing in a line of its own, above the sessions.
  const isVisible =
    isDue &&
    isGuest &&
    hasSavedSession &&
    isOnKnownPage &&
    !isOnAuthPage &&
    !isOnActivePage &&
    !isOnSessionsPage &&
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

  // Tells the page the bar is up, so a "sign up" line of its own (marked
  // data-hide-under-guest-prompt) can step aside: see global.css.
  useEffect(() => {
    if (!isVisible) return;
    const root = document.documentElement;
    root.dataset.guestPrompt = 'shown';
    return () => {
      delete root.dataset.guestPrompt;
    };
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
    localStorage.setItem(
      STORAGE_KEYS.GUEST_PROMPT_LAST_SHOWN,
      Date.now().toString()
    );
    // How many times the bar has been closed. The first close puts it off
    // for a day, the second for good (there is no separate "Don't ask again").
    const closes =
      (parseInt(
        localStorage.getItem(STORAGE_KEYS.GUEST_PROMPT_DISMISS_COUNT) ?? ''
      ) || 0) + 1;
    localStorage.setItem(
      STORAGE_KEYS.GUEST_PROMPT_DISMISS_COUNT,
      String(closes)
    );
    if (closes >= 2) {
      localStorage.setItem(STORAGE_KEYS.GUEST_PROMPT_DISMISSED, 'true');
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* The bar stays over the bottom of the screen, so whatever the page
          ends with would be stuck under it (on a phone it is as wide as the
          page). The page gets that much more room, in its own colour, to
          scroll its last rows clear. */}
      <div
        aria-hidden="true"
        className={`shrink-0 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
        style={{ height: cardHeight + CARD_GAP * 2 }}
      />
      {/* One line: what is at risk, the fix, and a way to close it. The
          popover surface of the theme, like a toast. z-40: under a dialog's
          backdrop, so it never takes a dialog's taps. */}
      <div
        ref={setCardEl}
        role="region"
        aria-label="Back up your sessions"
        className="fixed bottom-4 left-4 right-4 ml-auto sm:left-auto sm:w-max max-w-md flex items-center gap-2 rounded-xl border border-team-blue-40 bg-popover text-popover-foreground shadow-2xl py-1.5 pl-4 pr-1.5 z-40 animate-slide-up"
      >
        <p className="min-w-0 flex-1 text-sm font-medium leading-tight text-balance">
          {safariErases
            ? 'Saved only in this browser, and Safari can erase it after a week unused'
            : 'Saved only in this browser'}
        </p>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full border-team-blue text-foreground [@media(pointer:coarse)]:min-h-11"
        >
          <Link to={ROUTES.SIGNUP}>Sign up</Link>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 ${
            isDarkMode
              ? 'text-team-white-60 hover:bg-white/10 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          aria-label="Dismiss"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </>
  );
};
