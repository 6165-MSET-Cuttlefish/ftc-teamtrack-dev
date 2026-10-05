import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  useTheme,
  useAuth,
  useSession,
  useSessionCore,
  useTeam,
} from '@/contexts';
import {
  ROUTES,
  SPLIT_QUERY,
  STORAGE_KEYS,
  TUTORIAL_RESTART_EVENT,
  OPEN_TEAM_DIALOG_EVENT,
  OPEN_TEAM_DIALOG_STATE,
  TEAM_MANAGER_PATHS,
} from '@/constants';
import { calculateScore, getInitials, liveMatchType } from '@/lib';
import { flushPendingDeletes } from '@/lib/pendingSessionDeletes';
import {
  describeSignOutLoss,
  describeStoredSignOutLoss,
} from '@/lib/signOutLoss';
import { useIsCompact, useMediaQuery } from '@/hooks';
import { allowNavigation } from '@/hooks/useNavigationGuard';
import { useArmedAfterOpen } from '@/hooks/useArmedAfterOpen';
import {
  useActiveCompact,
  useActiveShort,
} from '@/components/session/layout/useActiveCompact';
import { LivePhaseChip, PausedPill } from '@/components/session/MatchPhase';
import {
  matchClockSeconds,
  useMatchPaused,
} from '@/components/session/matchPhaseLabel';
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
  DialogFooter,
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
  LogIn,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';

const TeamTrackLogo = ({ iconOnly = false }: { iconOnly?: boolean }) => {
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
      className="flex items-center justify-center gap-2 sm:gap-4 focus:outline-none transition-all duration-200 origin-left [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
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
          className={`font-montserrat italic text-[0.984rem] leading-6 relative -top-.5 hidden ${iconOnly ? '' : 'sm:inline'} ${isDeepSeaMode ? 'text-[#00BCD4]' : isHoneycombMode ? 'text-[#DAA520]' : isDarkMode ? 'text-white' : 'text-black'}`}
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
 * Where the "New Session" / "Sessions" buttons switch from an icon to
 * their text label. Written out in full so Tailwind sees every class.
 */
const NAV_LABEL_CLASSES = {
  md: { text: 'hidden md:inline', icon: 'md:hidden' },
  lg: { text: 'hidden lg:inline', icon: 'lg:hidden' },
  xl: { text: 'hidden xl:inline', icon: 'xl:hidden' },
} as const;

/** Pages for getting into an account: there is no app to tour yet */
const AUTH_PATHS: readonly string[] = [
  ROUTES.LOGIN,
  ROUTES.SIGNUP,
  ROUTES.FORGOT_PASSWORD,
];

/** 44px for a finger, whatever the width of the screen it is on */
const TOUCH_TARGET =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

interface NavigationMenuProps {
  /** The match clock is sharing the bar, so the nav has less room */
  timerInBar: boolean;
  /**
   * A match is being scored on a phone: the bar belongs to the clock, and
   * everything here folds into the one overflow menu.
   */
  condensed: boolean;
  /** No padding of its own: the bar is keeping to one fixed height */
  flush: boolean;
}

const NavigationMenu = ({
  timerInBar,
  condensed,
  flush,
}: NavigationMenuProps) => {
  const { isDarkMode, themeMode } = useTheme();
  const { user, logout } = useAuth();
  const { team } = useTeam();
  const { sessionData, hasStarted, matchActive, isTutorialActive } =
    useSessionCore();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnActivePage = location.pathname.includes('/active');
  const canTour = !AUTH_PATHS.includes(location.pathname);
  // Someone who opened a share link without an account has no sessions to
  // go to and nothing to start: the page they were sent is the whole visit.
  const isVisitor = !user && location.pathname.startsWith('/shared');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  /**
   * On a phone "Sign Out Anyway" opens right under the finger that chose
   * Sign out, from the scoring bar's menu: the second tap of a double tap
   * must not throw the session away.
   */
  const signOutArmed = useArmedAfterOpen(showLogoutConfirm);
  /** Sign out was chosen with a session at stake: ask once the menu has closed */
  const confirmLogoutRef = useRef(false);
  /** Team was chosen: where it leads, once the menu has let go of focus */
  const teamActionRef = useRef<(() => void) | null>(null);

  // Not the session name: every new session starts pre-named
  // ("Practice · Oct 1"), so a name alone doesn't mean one is in progress.
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

      const { clearSessionFromStorage } = await import(
        '@/lib/sessionPersistence'
      );
      clearSessionFromStorage();

      await logout();
      // They have been asked already; the page's own "leave?" guard may not
      // have caught up with the session being cleared.
      allowNavigation();
      navigate(ROUTES.LOGIN);
      toast.success('Signed out');
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

  // Acted on once the menu has closed, as with Sign out below: the focus it
  // hands back to its button would take over the dialog, or scroll the page
  // back up from the Team card.
  const handleTeam = () => {
    if (!team) {
      // The Team card there says what a team is, beside Create and Join.
      teamActionRef.current = () => navigate(`${ROUTES.PROFILE}#team`);
    } else if (TEAM_MANAGER_PATHS.includes(location.pathname)) {
      teamActionRef.current = () =>
        window.dispatchEvent(new Event(OPEN_TEAM_DIALOG_EVENT));
    } else {
      teamActionRef.current = () =>
        navigate(ROUTES.SESSIONS, { state: OPEN_TEAM_DIALOG_STATE });
    }
  };

  /** Runs once a menu that holds the account items has closed. */
  const afterAccountMenuClosed = () => {
    const teamAction = teamActionRef.current;
    teamActionRef.current = null;
    teamAction?.();
    confirmLogoutOnceClosed();
  };

  /** Runs once a menu that holds Sign out has closed and let go of focus. */
  const confirmLogoutOnceClosed = () => {
    // Focus is back on the menu's button by the time the dialog renders,
    // which is where the dialog returns it when it closes.
    if (!confirmLogoutRef.current) return;
    confirmLogoutRef.current = false;
    setShowLogoutConfirm(true);
  };

  const handleStartInteractiveTutorial = () => {
    if (isOnActivePage) {
      // Already there: the walkthrough opens itself, or says why it can't
      window.dispatchEvent(new Event(TUTORIAL_RESTART_EVENT));
      return;
    }
    // The walkthrough borrows the session and puts back what it found when
    // it closes, which would undo the scoring of a match still being played.
    if (matchActive) {
      toast.info('Finish or discard this match to replay the tour');
      return;
    }
    // The walkthrough lives on the scoring page, and picks this up there
    try {
      sessionStorage.setItem(STORAGE_KEYS.START_TUTORIAL, 'true');
    } catch {
      /* storage unavailable: they still land on the page it explains */
    }
    navigate(ROUTES.ACTIVE);
  };

  const iconButtonClass = `p-2 sm:p-2.5 rounded-full transition-colors items-center justify-center ${TOUCH_TARGET} ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`;

  const tutorialItem = canTour && (
    <DropdownMenuItem
      onClick={handleStartInteractiveTutorial}
      className="flex items-center gap-2 cursor-pointer"
    >
      <HelpCircle className="w-4 h-4" />
      <span>Tutorial</span>
    </DropdownMenuItem>
  );

  const signUpItem = (
    <DropdownMenuItem asChild>
      <Link
        to={ROUTES.SIGNUP}
        className="flex items-center gap-2 cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        <span>Sign up</span>
      </Link>
    </DropdownMenuItem>
  );

  const accountItems = user && (
    <>
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
      <DropdownMenuItem
        onClick={handleTeam}
        className="flex items-center [@media(pointer:coarse)]:min-h-11"
      >
        <Users className="mr-2 h-4 w-4 shrink-0" />
        {team ? (
          <>
            <span>Team</span>
            <span className="ml-auto pl-3 min-w-0 truncate text-xs text-muted-foreground">
              {team.name}
            </span>
          </>
        ) : (
          <span>Create or join a team</span>
        )}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={handleLogout}
        className="[@media(pointer:coarse)]:min-h-11"
      >
        <LogOut className="mr-2 h-4 w-4" />
        <span>Sign out</span>
      </DropdownMenuItem>
    </>
  );

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-2 lg:px-3 ${flush ? '' : 'py-1 sm:py-2'} ${
        isDarkMode && !condensed ? 'bg-[rgba(25,25,25,0.2)]' : ''
      }`}
    >
      {condensed ? (
        // Everything the bar usually holds, behind one button
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More options"
              className={`flex min-h-11 min-w-11 ${iconButtonClass}`}
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[200px]"
            onCloseAutoFocus={afterAccountMenuClosed}
          >
            <DropdownMenuItem
              onClick={() => navigate(ROUTES.SESSIONS)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Sessions</span>
            </DropdownMenuItem>
            {tutorialItem}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            {user ? (
              accountItems
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    to={ROUTES.LOGIN}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign in</span>
                  </Link>
                </DropdownMenuItem>
                {signUpItem}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          {!isOnActivePage &&
            (hasActiveSession ? (
              <button
                onClick={() => navigate('/active')}
                aria-label="Active practice session"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 sm:px-3 sm:py-1.5 rounded-full whitespace-nowrap transition-colors ${TOUCH_TARGET} ${isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-team-white-10' : 'text-green-600 hover:text-green-700 hover:bg-gray-100'}`}
              >
                {/* Label collapses to an icon when the bar is short of room —
                    same pattern as "Sessions" below — so this doesn't crowd
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
              !isVisitor && (
                <button
                  onClick={() => navigate(ROUTES.ACTIVE)}
                  aria-label="New session"
                  className={`px-3 sm:px-4 py-1.5 rounded-full flex items-center justify-center gap-2 whitespace-nowrap transition-all bg-team-blue hover:opacity-90 ${TOUCH_TARGET} ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  <span className={`${labels.text} text-sm font-semibold`}>
                    New Session
                  </span>
                  <Plus className={`w-4 h-4 ${labels.icon}`} />
                </button>
              )
            ))}

          {!isVisitor && (
            <button
              onClick={() => navigate('/sessions')}
              aria-label="Sessions"
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${TOUCH_TARGET} ${
                isDarkMode
                  ? 'hover:bg-team-white-10 text-white'
                  : 'hover:bg-gray-100 text-black'
              }`}
            >
              <span className={labels.text}>Sessions</span>
              <BarChart3 className={`w-4 h-4 ${labels.icon}`} />
            </button>
          )}

          {canTour && (
            <button
              onClick={handleStartInteractiveTutorial}
              aria-label="Start interactive tutorial"
              className={`hidden sm:flex ${iconButtonClass}`}
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

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
              {tutorialItem}
              {tutorialItem && <DropdownMenuSeparator />}
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <ThemeMenuItems />
              {!user && (
                <>
                  <DropdownMenuSeparator />
                  {signUpItem}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`relative h-8 w-8 rounded-full sm:ml-2 ${TOUCH_TARGET}`}
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
                onCloseAutoFocus={afterAccountMenuClosed}
              >
                {accountItems}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={TOUCH_TARGET}
              >
                <Link to="/login">Sign in</Link>
              </Button>
              {/* On a phone Sign up lives in the overflow menu above */}
              <Button
                size="sm"
                asChild
                className={`hidden sm:inline-flex ${TOUCH_TARGET} ${isDarkMode ? '!text-[#191919]' : '!text-[#FEFEFE]'}`}
              >
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dialog puts itself at the end of <body>, out of the sticky
          header's stacking context. */}
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
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              data-autofocus
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

/**
 * The match clock in the top bar, with its phase and the running total of
 * the match in the fields. While the match is paused the phase gives way to
 * the pill that says so, and that resumes it.
 *
 * The bar's middle track is whatever the logo and the nav leave over, which
 * below the widest layout is not much: the pill is stacked on two lines
 * there, and the logo and nav drop their words to make room. The total and
 * its unit stay in every state from a 360px phone up; narrower than that,
 * the total gives way to the pill rather than have the clock clipped.
 */
const HeaderClock = ({ dense = false }: { dense?: boolean }) => {
  const { isDarkMode } = useTheme();
  const {
    timer,
    formatTime,
    matchPhase,
    matchActive,
    phaseTimer,
    isTutorialActive,
    sessionData,
    editingMatchId,
  } = useSession();
  const paused = useMatchPaused();
  // Scored as the match in the fields, like the Breakdown: a saved match
  // being edited keeps its own type.
  const total = calculateScore({
    ...sessionData,
    matchType: liveMatchType(sessionData, editingMatchId),
  }).total;

  const timerColor =
    matchPhase === 'controller_pickup' && matchActive
      ? isDarkMode
        ? 'text-yellow-400'
        : // amber-600 is under 4.5:1 on white at the phone size
          'text-amber-700'
      : isDarkMode
        ? 'text-white'
        : 'text-gray-900';

  // The paused chip is the phase chip's size, so pausing changes nothing
  // else in the bar. On a phone the total keeps its unit from 360px up; a
  // wider bar has room for all of it: the logo gives up its name while the
  // clock is there (see `Header`).
  const unitClass = dense ? 'max-[359px]:hidden' : '';

  return (
    <span
      className={`flex items-center whitespace-nowrap ${dense ? 'gap-2' : 'gap-2 sm:gap-3'}`}
    >
      <span
        data-header-clock
        className={`font-righteous tracking-wider leading-none transition-[color,opacity] ${dense ? 'text-3xl' : 'text-xl sm:text-3xl lg:text-4xl'} ${timerColor} ${paused ? 'opacity-40' : ''}`}
      >
        {formatTime(
          matchClockSeconds({
            matchActive,
            matchPhase,
            timer,
            phaseTimer,
            isTutorialActive,
          })
        )}
      </span>
      {paused ? <PausedPill size="sm" /> : <LivePhaseChip size="sm" />}
      <span
        aria-hidden="true"
        className={`w-px ${dense ? 'h-6' : 'h-6 sm:h-8'} ${isDarkMode ? 'bg-team-white-20' : 'bg-gray-300'}`}
      />
      {/* Read out in words; an aria-label would need a role to be valid */}
      <span className="sr-only">{`Total score ${total} points`}</span>
      <span
        aria-hidden="true"
        className={`font-bold text-team-blue tabular-nums leading-none ${dense ? 'text-xl' : 'text-lg sm:text-2xl lg:text-3xl'}`}
      >
        {total}
        <span
          className={`ml-1 text-xs sm:text-sm font-semibold ${unitClass} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          pts
        </span>
      </span>
    </span>
  );
};

/**
 * Says which saved match is open in the scoring fields. It takes the
 * clock's place in the bar: the clock belongs to the next match, and beside
 * an old match's total it would read as that match's time.
 */
const EditingLabel = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, editingMatchId } = useSessionCore();
  const match = sessionData.matches?.find(m => m.id === editingMatchId);

  return (
    <span
      data-header-editing
      className={`text-sm sm:text-base font-bold uppercase tracking-wide whitespace-nowrap ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
    >
      Editing Match {match?.matchNumber ?? ''}
    </span>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  const { hasStarted, sessionData, matchActive, editingMatchId } =
    useSessionCore();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnSessionsPage = location.pathname === '/sessions';
  const isOnActivePage = location.pathname.includes('/active');
  const [timerScrolledPast, setTimerScrolledPast] = useState(false);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const isNarrow = useIsCompact();
  const isActiveCompact = useActiveCompact();
  const isShort = useActiveShort();
  // The scoring page decides for itself when it is a phone (a phone on its
  // side counts); the bar follows it there, so the two never disagree.
  const isCompact = isOnActivePage ? isActiveCompact : isNarrow;

  const isCompleted = Boolean(sessionData.isSessionCompleted);
  const isEditing = editingMatchId !== null;

  const showCompactTimer =
    !isCompleted &&
    ((isOnActivePage && timerScrolledPast) || (!isOnActivePage && hasStarted));
  /** The clock is in the middle of the bar (a phone gives it its own row) */
  const clockInBar = showCompactTimer && !isCompact;
  const isWide = useMediaQuery(SPLIT_QUERY);

  /**
   * A match is being scored, or a saved one corrected, on a phone. The bar
   * swaps what it holds rather than growing a second row for the clock: it
   * keeps one height, so the scoring controls under a thumb don't move when
   * the clock arrives.
   */
  const isScoringBar =
    isOnActivePage && isCompact && !isCompleted && (matchActive || isEditing);
  /** The phone bar on the scoring page keeps one height in every state */
  const isFixedHeight = isOnActivePage && isCompact;

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
      setTimerScrolledPast(
        timerEl.getBoundingClientRect().bottom < headerBottom
      );
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

  const backButton = !isOnSessionsPage && (
    <button
      onClick={() => navigate('/sessions')}
      aria-label="Back to sessions"
      className={`p-1.5 sm:p-2 rounded-full transition-colors flex items-center justify-center ${TOUCH_TARGET} ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`}
    >
      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  );

  /** What the middle of the bar holds; `null` leaves it empty. */
  const centre = () => {
    if (isScoringBar) {
      if (isEditing) return <EditingLabel />;
      if (timerScrolledPast) {
        return (
          <div className="animate-in fade-in duration-200">
            <HeaderClock dense />
          </div>
        );
      }
      // The big clock is on screen just below: only say which match it is
      return (
        <span
          className={`text-sm font-semibold whitespace-nowrap ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          Match {(sessionData.matches?.length ?? 0) + 1}
        </span>
      );
    }
    if (!showCompactTimer || isCompact) return null;
    if (isEditing) return <EditingLabel />;
    return (
      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
        <HeaderClock />
      </div>
    );
  };

  return (
    <header
      ref={setHeaderEl}
      // On a phone held sideways the bar is a large part of the screen, so
      // it is slim there, and only stays pinned for the clock of a running
      // match.
      // Nothing in the bar needs room kept clear of the bar: without the
      // `[id]` override, the 5rem scroll margin every element with an id gets
      // (global.css) made a menu's button, focused again as the menu closed,
      // scroll the page up by up to 5rem.
      className={`top-0 w-full px-2 sm:px-3 md:px-4 lg:px-8 border-b z-50 [&_[id]]:scroll-mt-0 ${
        isShort && !matchActive ? 'relative' : 'sticky'
      } ${
        isShort ? 'py-1' : isFixedHeight ? 'py-2' : 'py-2 sm:py-3 md:py-4'
      } ${isDarkMode ? 'border-team-white-20 bg-team-dark' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div
        className={`max-w-[1216px] mx-auto sm:px-3 lg:px-6 grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-1 sm:gap-4 lg:gap-6 ${isFixedHeight ? 'h-11' : ''}`}
      >
        {/* Never narrower than the arrow and logo, so the nav can't sit on
            top of them. */}
        <div className="flex items-center justify-start gap-1 sm:gap-2 md:gap-3 shrink-0">
          {backButton}
          {/* The clock needs the room in the middle more than the logo
              needs its name, short of the widest bar. */}
          {!isScoringBar && (
            <TeamTrackLogo iconOnly={isShort || (clockInBar && !isWide)} />
          )}
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
          away from a match: the nav leaves it no room.
        */}
        <div className="min-w-0 flex items-center justify-center overflow-hidden">
          {centre()}
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-4 lg:gap-6 flex-shrink-0">
          <NavigationMenu
            timerInBar={clockInBar}
            condensed={isScoringBar}
            flush={isFixedHeight}
          />
        </div>
      </div>

      {/*
        On a phone the nav leaves the middle track too narrow to show the
        clock, so away from the scoring page a session's clock gets a row of
        its own. The scoring page never grows one: see `isScoringBar`.
      */}
      {showCompactTimer && isCompact && !isOnActivePage && (
        <div className="flex justify-center pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {isEditing ? <EditingLabel /> : <HeaderClock />}
        </div>
      )}
    </header>
  );
};
