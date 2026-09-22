import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme, useAuth, useSession } from '@/contexts';
import { ROUTES, TUTORIAL_RESTART_EVENT } from '@/constants';
import { getInitials } from '@/lib';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

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
      className="flex items-center gap-2 sm:gap-4 focus:outline-none transition-all duration-200 origin-left"
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

const NavigationMenu = () => {
  const { isDarkMode, themeMode, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { sessionData } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnActivePage = location.pathname.includes('/active');

  const { hasStarted } = useSession();
  const hasActiveSession =
    sessionData &&
    !sessionData.isSessionCompleted &&
    (hasStarted ||
      sessionData.sessionName?.trim() ||
      (sessionData.matches && sessionData.matches.length > 0));

  const handleLogout = async () => {
    try {
      const { clearSessionFromStorage } = await import('@/lib/sessionPersistence');
      clearSessionFromStorage();

      await logout();
      navigate(ROUTES.LOGIN);
      toast.success('Logged out successfully');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Logout failed', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };


  const handleStartInteractiveTutorial = () => {
    if (isOnActivePage) {
      // Already on active page, just trigger the tutorial
      window.dispatchEvent(new Event(TUTORIAL_RESTART_EVENT));
    } else {
      toast.info('You can only access the tutorial on the Active Sessions page!');
    }
  };

  return (
    <div
      className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 ${
        isDarkMode ? 'bg-[rgba(25,25,25,0.2)]' : ''
      }`}
    >
      {!isOnActivePage &&
        (hasActiveSession ? (
          <button
            onClick={() => navigate('/active')}
            aria-label="Active practice session"
            className={`flex items-center gap-1.5 sm:gap-2 transition-colors ${isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'}`}
          >
            {/* Label collapses to an icon on mobile — same pattern as "My
                Sessions" below — so this doesn't crowd the icons next to it
                on a phone-width header. */}
            <span className="hidden sm:inline text-sm font-semibold">
              Active Session
            </span>
            <Radio className="w-4 h-4 sm:hidden" />
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 bg-green-500 rounded-full"></div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate(ROUTES.ACTIVE)}
            aria-label="New session"
            className={`px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-2 transition-all bg-team-blue hover:opacity-90 ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            <span className="hidden sm:inline text-sm font-semibold">
              New Session
            </span>
            <Plus className="w-4 h-4 sm:hidden" />
          </button>
        ))}

      <button
        onClick={() => navigate('/sessions')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isDarkMode
            ? 'hover:bg-team-white-10 text-white'
            : 'hover:bg-gray-100 text-black'
        }`}
      >
        <span className="hidden sm:inline">My Sessions</span>
        <BarChart3 className="w-4 h-4 sm:hidden" />
      </button>


      <button
        onClick={handleStartInteractiveTutorial}
        aria-label="Start interactive tutorial"
        className={`p-2 sm:p-2.5 rounded-full transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`}
      >
        <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Select theme"
            className={`p-2 sm:p-2.5 rounded-full transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-team-white-10' : 'hover:bg-gray-100'}`}
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
          <DropdownMenuItem
            onClick={() => setTheme('dark')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Moon className="w-4 h-4" />
            <span>Dark</span>
            {themeMode === 'dark' && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('light')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Sun className="w-4 h-4" />
            <span>Light</span>
            {themeMode === 'light' && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('honeycomb')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Hexagon className="w-4 h-4" />
            <span>Honeycomb</span>
            {themeMode === 'honeycomb' && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('deepsea')} className="flex items-center gap-2 cursor-pointer">
            <Waves className="w-4 h-4" />
            <span>Deep Sea</span>
            {themeMode === 'deepsea' && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full ml-2"
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
          <Button
            size="sm"
            asChild
            className={isDarkMode ? '!text-[#191919]' : '!text-[#FEFEFE]'}
          >
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

const CompactTimer = () => {
  const { isDarkMode } = useTheme();
  const { timer, formatTime, matchPhase, phaseTimer } = useSession();

  const timerColor =
    matchPhase === 'controller_pickup'
      ? 'text-yellow-400'
      : isDarkMode
        ? 'text-white'
        : 'text-team-blue';

  return (
    <span
      className={`text-xl sm:text-3xl md:text-4xl font-righteous tracking-wider leading-none transition-colors ${timerColor}`}
    >
      {matchPhase === 'controller_pickup'
        ? formatTime(phaseTimer)
        : formatTime(timer)}
    </span>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  const { hasStarted, sessionData } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnSessionsPage = location.pathname === '/sessions';
  const isOnActivePage = location.pathname.includes('/active');
  const [timerScrolledPast, setTimerScrolledPast] = useState(false);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);

  const showCompactTimer =
    !sessionData.isSessionCompleted &&
    ((isOnActivePage && timerScrolledPast) || (!isOnActivePage && hasStarted));

  useEffect(() => {
    if (!isOnActivePage) {
      setTimerScrolledPast(false);
      return;
    }

    const check = () => {
      const timerEl = document.querySelector<HTMLElement>('[data-tutorial="timer"]');
      if (!timerEl || !headerEl) return;
      const headerBottom = headerEl.offsetHeight;
      const timerTop = timerEl.getBoundingClientRect().top;
      setTimerScrolledPast(timerTop < headerBottom);
    };

    const timeout = setTimeout(() => {
      check(); // run immediately after mount
      window.addEventListener('scroll', check, { passive: true });
    }, 100);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', check);
    };
  }, [isOnActivePage, location.pathname, headerEl]);

  return (
    <header
      ref={setHeaderEl}
      className={`sticky top-0 w-full px-2 sm:px-3 md:px-4 lg:px-8 py-2 sm:py-3 md:py-4 border-b z-50 ${isDarkMode ? 'border-team-white-20 bg-team-dark' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1216px] mx-auto px-2 sm:px-3 md:px-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4 md:gap-6">
        <div className="flex items-center justify-start gap-1 sm:gap-2 md:gap-3 min-w-0">
          {!isOnSessionsPage && (
            <button
              onClick={() => navigate('/sessions')}
              aria-label="Back to sessions"
              className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          <TeamTrackLogo />
        </div>

        {/*
          A real grid track, not an absolute overlay: the timer can only ever
          take the space left over between the two side groups, so it cannot
          render on top of the nav icons no matter how wide either side gets
          (e.g. the extra "Sign in" / "Sign up" buttons in guest mode).
          `overflow-hidden` is a last-resort clamp for when even that leftover
          space is narrower than the timer itself on very small screens.
        */}
        <div className="min-w-0 flex items-center justify-center overflow-hidden">
          {showCompactTimer && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <CompactTimer />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-4 lg:gap-6 flex-shrink-0">
          <NavigationMenu />
        </div>
      </div>
    </header>
  );
};
