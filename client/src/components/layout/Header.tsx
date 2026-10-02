import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme, useAuth, useSession, useSessionCore } from '@/contexts';
import { ROUTES, TUTORIAL_RESTART_EVENT } from '@/constants';
import { calculateScore, getInitials, liveMatchType } from '@/lib';
import { flushPendingDeletes } from '@/lib/pendingSessionDeletes';
import {
  describeSignOutLoss,
  describeStoredSignOutLoss,
} from '@/lib/signOutLoss';
import { useIsCompact } from '@/hooks';
import { allowNavigation } from '@/hooks/useNavigationGuard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sun,
  Moon,
  LogOut,
  UserCircle,
  BarChart3,
  HelpCircle,
  Hexagon,
  Waves,
  ArrowLeft,
  Radio,
  Plus,
  EllipsisVertical,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TeamTrackLogo = () => {
  const { isDarkMode, isHoneycombMode, isDeepSeaMode } = useTheme();

  const logoColor = isDeepSeaMode
    ? '#00BCD4'
    : isHoneycombMode
    ? '#DAA520'
    : isDarkMode
      ? '#B0E5FE'
      : '#537788';

  return (
    <Link
      to="/sessions"
      aria-label="TeamTrack home"
      className="flex items-center justify-center gap-2 sm:gap-4 focus:outline-none transition-all duration-200 origin-left"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <svg
          width="8"
          height="20"
          viewBox="0 0 8 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[0.421875rem] h-[1.125rem] sm:w-[0.73125rem] sm:h-[1.828125rem]"
          role="img"
          aria-label="TeamTrack logo icon"
        >
          <path
            d="M3.9994 0.645596L7.60709 6.46935H0.464233L3.9994 0.645596Z"
            fill={logoColor}
          />
          <path
            d="M4.00005 9.38123L0.392909 7.23372H7.53577L4.00005 9.38123Z"
            fill={logoColor}
          />
          <path
            d="M0.321429 2.31992L3.28571 0.5L0 6.06897L0.321429 2.31992Z"
            fill={logoColor}
          />
          <path
            d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7.67857 2.31992Z"
            fill={logoColor}
          />
          <path
            d="M0.392822 9.24855C0.392822 8.74891 0.92601 8.43006 1.36618 8.66649C1.58053 8.78162 1.71425 9.00524 1.71425 9.24855V18.3817C1.71425 18.6225 1.58325 18.8442 1.37235 18.9604C0.932001 19.203 0.392822 18.8844 0.392822 18.3817V9.24855Z"
            fill={logoColor}
          />
          <path
            d="M2.3681 10.2849C2.37112 9.76044 2.94632 9.44078 3.39332 9.71519C3.59274 9.83762 3.71427 10.0548 3.71427 10.2888V17.1858C3.71427 17.4334 3.58216 17.6622 3.36771 17.786C2.9042 18.0535 2.32529 17.717 2.32837 17.1818L2.3681 10.2849Z"
            fill={logoColor}
          />
          <path
            d="M7.53577 9.26287C7.53577 8.75993 6.9962 8.4414 6.55585 8.68437C6.34516 8.80063 6.21434 9.02223 6.21434 9.26287V18.4077C6.21434 18.6534 6.35068 18.8788 6.5683 18.9929C7.00823 19.2235 7.53577 18.9044 7.53577 18.4077V9.26287Z"
            fill={logoColor}
          />
          <path
            d="M5.6319 10.2849C5.62888 9.76044 5.05368 9.44078 4.60668 9.71519C4.40726 9.83762 4.28573 10.0548 4.28573 10.2888V17.1858C4.28573 17.4334 4.41784 17.6622 4.63229 17.786C5.0958 18.0535 5.67471 17.717 5.67163 17.1818L5.6319 10.2849Z"
            fill={logoColor}
          />
        </svg>
        <span
          className={`font-montserrat italic text-[0.984rem] leading-6 relative -top-.5 hidden sm:inline ${isDeepSeaMode ? 'text-[#00BCD4]' : isHoneycombMode ? 'text-[#DAA520]' : isDarkMode ? 'text-white' : 'text-black'}`}
        >
          TeamTrack
        </span>
      </div>
    </Link>
  );
};

const THEME_OPTIONS = [
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'honeycomb', label: 'Honeycomb', Icon: Hexagon },
  { mode: 'deepsea', label: 'Deep Sea', Icon: Waves },
] as const;

/** The theme choices, for the theme menu and the phone overflow menu. */
const ThemeMenuItems = () => {
  const { themeMode, setTheme } = useTheme();

  return (
    <>
      {THEME_OPTIONS.map(({ mode, label, Icon }) => (
        <DropdownMenuItem
          key={mode}
          onClick={() => setTheme(mode)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {themeMode === mode && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      ))}
    </>
  );
};

/**
 * Where the "New Session" / "My Sessions" buttons switch from an icon to
 * their text label. Written out in full so Tailwind sees every class.
 */
const NAV_LABEL_CLASSES = {
  md: { text: 'hidden md:inline', icon: 'md:hidden' },
  lg: { text: 'hidden lg:inline', icon: 'lg:hidden' },
  xl: { text: 'hidden xl:inline', icon: 'xl:hidden' },
} as const;

interface NavigationMenuProps {
  /** The match clock is sharing the bar, so the nav has less room */
  timerInBar: boolean;
}

const NavigationMenu = ({ timerInBar }: NavigationMenuProps) => {
  const { isDarkMode, themeMode } = useTheme();
  const { user, logout } = useAuth();
  const { sessionData, hasStarted, matchActive, isTutorialActive } =
    useSessionCore();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnActivePage = location.pathname.includes('/active');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  /** Sign out was chosen with a session at stake: ask once the menu has closed */
  const confirmLogoutRef = useRef(false);

  // Not the session name: every new session starts pre-named
  // ("Default Session"), so a name alone doesn't mean one is in progress.
  const hasActiveSession =
    sessionData &&
    !sessionData.isSessionCompleted &&
    (hasStarted || (sessionData.matches && sessionData.matches.length > 0));

  // Matches only reach the server when the session is completed; signing out
  // clears the one in progress, a match that is still being scored included.
  // Not the tutorial's practice match though: that was never going to be kept.
  const signOutLoss = isTutorialActive
    ? describeStoredSignOutLoss()
    : describeSignOutLoss(sessionData, matchActive);

  // The text labels only fit once the bar is wide enough for everything in
  // it: guests carry two extra buttons (Sign in / Sign up), and the clock
  // takes about as much room as they do.
  const labels =
    NAV_LABEL_CLASSES[
      user ? (timerInBar ? 'lg' : 'md') : timerInBar ? 'xl' : 'lg'
    ];

  const signOut = async () => {
    setShowLogoutConfirm(false);
    try {
      // Session deletes still inside their undo window can only go through
      // while signed in.
      try {
        await flushPendingDeletes();
      } catch {
        /* sign out regardless */
      }

      const { clearSessionFromStorage } = await import('@/lib/sessionPersistence');
      clearSessionFromStorage();

      await logout();
      // They have been asked already; the page's own "leave?" guard may not
      // have caught up with the session being cleared.
      allowNavigation();
      navigate(ROUTES.LOGIN);
      toast.success('Logged out successfully');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Logout failed', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleLogout = () => {
    if (signOutLoss) {
      // Opened from the menu's onCloseAutoFocus: while the menu is still
      // closing it keeps focus to itself, and would take it from the dialog.
      confirmLogoutRef.current = true;
      return;
    }
    signOut();
  };

  const handleStartInteractiveTutorial = () => {
    if (isOnActivePage) {
      // Already on active page, just trigger the tutorial
      window.dispatchEvent(new Event(TUTORIAL_RESTART_EVENT));
    } else {
      toast.info('You can only access the tutorial on the Active Sessions page!');
    }
  };

  const iconButtonClass = `p-2 sm:p-2.5 rounded-full transition-colors items-center justify-center ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`;

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-2 lg:px-3 py-1 sm:py-2 ${
        isDarkMode ? 'bg-[rgba(25,25,25,0.2)]' : ''
      }`}
    >
      {!isOnActivePage &&
        (hasActiveSession ? (
          <button
            onClick={() => navigate('/active')}
            aria-label="Active practice session"
            className={`flex items-center justify-center gap-1.5 sm:gap-2 sm:px-3 sm:py-1.5 rounded-full whitespace-nowrap transition-colors ${isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-team-white-10' : 'text-green-600 hover:text-green-700 hover:bg-gray-100'}`}
          >
            {/* Label collapses to an icon when the bar is short of room —
                same pattern as "My Sessions" below — so this doesn't crowd
                the buttons next to it. The padding keeps the icon-only
                button the size of its neighbours (phones get their 44px
                minimum from global.css). */}
            <span className={`${labels.text} text-sm font-semibold`}>
              Active Session
            </span>
            <Radio className={`w-4 h-4 ${labels.icon}`} />
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 bg-green-500 rounded-full"></div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate(ROUTES.ACTIVE)}
            aria-label="New session"
            className={`px-3 sm:px-4 py-1.5 rounded-full flex items-center justify-center gap-2 whitespace-nowrap transition-all bg-team-blue hover:opacity-90 ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            <span className={`${labels.text} text-sm font-semibold`}>
              New Session
            </span>
            <Plus className={`w-4 h-4 ${labels.icon}`} />
          </button>
        ))}

      <button
        onClick={() => navigate('/sessions')}
        aria-label="My Sessions"
        className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          isDarkMode
            ? 'hover:bg-team-white-10 text-white'
            : 'hover:bg-gray-100 text-black'
        }`}
      >
        <span className={labels.text}>My Sessions</span>
        <BarChart3 className={`w-4 h-4 ${labels.icon}`} />
      </button>

      <button
        onClick={handleStartInteractiveTutorial}
        aria-label="Start interactive tutorial"
        className={`hidden sm:flex ${iconButtonClass}`}
      >
        <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Select theme"
            className={`hidden sm:flex ${iconButtonClass}`}
          >
            {themeMode === 'dark' ? (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            ) : themeMode === 'light' ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            ) : themeMode === 'deepsea' ? (
              <Waves className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            ) : (
              <Hexagon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ThemeMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* On a phone there is no room for a button each: the tutorial, the
          theme and (for guests) Sign up share one menu. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="More options"
            className={`flex sm:hidden ${iconButtonClass}`}
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem
            onClick={handleStartInteractiveTutorial}
            className="flex items-center gap-2 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Tutorial</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <ThemeMenuItems />
          {!user && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  to={ROUTES.SIGNUP}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign up</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full sm:ml-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                />
                <AvatarFallback
                  className={`text-xs bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  {getInitials(user.displayName || user.email || 'User')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={`w-56 ${isDarkMode ? 'bg-[#191919] border-team-black-40' : 'bg-white border-team-blue'}`}
            align="end"
            onCloseAutoFocus={() => {
              // Focus is back on the avatar by the time the dialog renders,
              // which is where the dialog returns it when it closes.
              if (!confirmLogoutRef.current) return;
              confirmLogoutRef.current = false;
              setShowLogoutConfirm(true);
            }}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.displayName || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          {/* On a phone Sign up lives in the overflow menu above */}
          <Button
            size="sm"
            asChild
            className={`hidden sm:inline-flex ${isDarkMode ? '!text-[#191919]' : '!text-[#FEFEFE]'}`}
          >
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      )}

      {/* In a portal: the sticky header is its own stacking context, which
          would trap the dialog under anything later in the page. */}
      {createPortal(
        <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <DialogContent
            role="alertdialog"
            className={`max-w-md ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-white border border-gray-200'}`}
          >
            <DialogHeader
              className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}
            >
              <DialogTitle
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
        </Dialog>,
        document.body
      )}
    </div>
  );
};

/** Timer plus the current match's running total, shown in the top bar. */
const CompactTimer = () => {
  const { isDarkMode } = useTheme();
  const {
    timer,
    formatTime,
    matchPhase,
    phaseTimer,
    getDisplayTimer,
    sessionData,
    editingMatchId,
  } = useSession();
  // Scored as the match in the fields, like the Breakdown: a saved match
  // being edited keeps its own type.
  const total = calculateScore({
    ...sessionData,
    matchType: liveMatchType(sessionData, editingMatchId),
  }).total;

  const timerColor =
    matchPhase === 'controller_pickup'
      ? isDarkMode
        ? 'text-yellow-400'
        : // amber-600 is under 4.5:1 on white at the phone size
          'text-amber-700'
      : isDarkMode
        ? 'text-white'
        : 'text-team-blue';

  return (
    <span className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
      <span
        className={`text-xl sm:text-3xl lg:text-4xl font-righteous tracking-wider leading-none transition-colors ${timerColor}`}
      >
        {matchPhase === 'controller_pickup'
          ? formatTime(phaseTimer)
          : matchPhase === 'auton'
            ? formatTime(getDisplayTimer(timer, matchPhase))
            : formatTime(timer)}
      </span>
      <span
        aria-hidden="true"
        className={`h-6 sm:h-8 w-px ${isDarkMode ? 'bg-team-white-20' : 'bg-gray-300'}`}
      />
      {/* Read out in words; an aria-label would need a role to be valid */}
      <span className="sr-only">{`Total score ${total} points`}</span>
      <span
        aria-hidden="true"
        className="text-lg sm:text-2xl lg:text-3xl font-bold text-team-blue tabular-nums leading-none"
      >
        {total}
        <span
          className={`ml-1 text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          pts
        </span>
      </span>
    </span>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  const { hasStarted, sessionData } = useSessionCore();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnSessionsPage = location.pathname === '/sessions';
  const isOnActivePage = location.pathname.includes('/active');
  const [timerScrolledPast, setTimerScrolledPast] = useState(false);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const isCompact = useIsCompact();

  const showCompactTimer =
    !sessionData.isSessionCompleted &&
    ((isOnActivePage && timerScrolledPast) || (!isOnActivePage && hasStarted));

  useEffect(() => {
    if (!isOnActivePage) {
      setTimerScrolledPast(false);
      return;
    }

    // Track the big match clock itself (not the block around it), and only
    // swap in the header copy once it has fully scrolled under the header.
    const check = () => {
      const timerEl = document.querySelector<HTMLElement>('[data-match-timer]');
      if (!timerEl || !headerEl) {
        setTimerScrolledPast(false);
        return;
      }
      const headerBottom = headerEl.getBoundingClientRect().bottom;
      setTimerScrolledPast(timerEl.getBoundingClientRect().bottom < headerBottom);
    };

    const timeout = setTimeout(check, 100);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [isOnActivePage, location.pathname, headerEl]);

  return (
    <header
      ref={setHeaderEl}
      className={`sticky top-0 w-full px-2 sm:px-3 md:px-4 lg:px-8 py-2 sm:py-3 md:py-4 border-b z-50 ${isDarkMode ? 'border-team-white-20 bg-team-dark' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1216px] mx-auto sm:px-3 lg:px-6 grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-1 sm:gap-4 lg:gap-6">
        {/* Never narrower than the arrow and logo, so the nav can't sit on
            top of them. */}
        <div className="flex items-center justify-start gap-1 sm:gap-2 md:gap-3 shrink-0">
          {!isOnSessionsPage && (
            <button
              onClick={() => navigate('/sessions')}
              aria-label="Back to sessions"
              className={`p-1.5 sm:p-2 rounded-full transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          <TeamTrackLogo />
        </div>

        {/*
          A real grid track, not an absolute overlay. The two side tracks are
          `minmax(max-content, 1fr)`: equal shares of the spare width, so the
          timer sits in the true center of the bar even though the logo and
          nav groups differ in width, but never less than their own content.
          (A plain `1fr` track only holds that floor while its cell keeps the
          default `min-width: auto`.) When one side needs more than its share
          the timer shifts off-center rather than overlapping it. The nav
          drops to icon-only labels while the timer is here so all three
          fit; `overflow-hidden` is a last-resort clamp that clips the timer,
          never the page, if they still don't. On a phone this track is empty
          (the clock gets its own row below), so the gaps either side of it
          are small: at 320px the 44px controls only just fit.
        */}
        <div className="min-w-0 flex items-center justify-center overflow-hidden">
          {showCompactTimer && !isCompact && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <CompactTimer />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-4 lg:gap-6 flex-shrink-0">
          <NavigationMenu timerInBar={showCompactTimer && !isCompact} />
        </div>
      </div>

      {/*
        On a phone the nav leaves the middle track too narrow to show the
        clock, so it gets its own row inside the sticky header instead.
      */}
      {showCompactTimer && isCompact && (
        <div className="flex justify-center pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <CompactTimer />
        </div>
      )}
    </header>
  );
};
