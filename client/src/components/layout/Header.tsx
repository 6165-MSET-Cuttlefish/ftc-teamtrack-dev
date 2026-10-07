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
import { ACTIVE_PAGE_CONTAINER, PAGE_CONTAINER } from '@/constants/layout';
import { calculateScore, getInitials, liveMatchType } from '@/lib';
import { formatPoints } from '@/lib/points';
import { flushPendingDeletes } from '@/lib/pendingSessionDeletes';
import {
  describeSignOutLoss,
  describeStoredSignOutLoss,
} from '@/lib/signOutLoss';
import { useIsCompact, useMediaQuery } from '@/hooks';
import { allowNavigation } from '@/hooks/useNavigationGuard';
import {
  useActiveCompact,
  useActiveShort,
  useActiveSideBySide,
} from '@/components/session/layout/useActiveCompact';
import { ClockDigits } from '@/components/session/ClockDigits';
import { requestCompleteSession } from '@/components/session/controls/completeRequest';
import { LivePhaseChip, PausedPill } from '@/components/session/MatchPhase';
import {
  matchClockText,
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CHIP_BASE,
  CHIP_SIZES,
  chipTone,
  primaryClass,
} from '@/components/ui/tokens';
import {
  Sun,
  Moon,
  LogOut,
  UserCircle,
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

const TeamTrackLogo = ({
  iconOnly = false,
  roomy = false,
}: {
  iconOnly?: boolean;
  /**
   * Nothing to its left (no back arrow): the name shows from a 360px phone
   * up, rather than only from `sm`.
   */
  roomy?: boolean;
}) => {
  const { isDarkMode, isHoneycombMode, isDeepSeaMode } = useTheme();

  const logoColor = isDeepSeaMode
    ? '#00BCD4'
    : isHoneycombMode
      ? '#DAA520'
      : isDarkMode
        ? '#B0E5FE'
        : '#537788';

  // Written out in full so Tailwind sees every class
  const wordmark = iconOnly
    ? 'hidden'
    : roomy
      ? 'hidden min-[360px]:inline'
      : 'hidden sm:inline';

  return (
    <Link
      to="/sessions"
      aria-label="TeamTrack home"
      className="flex items-center justify-center gap-2 sm:gap-4 focus:outline-none transition-all duration-200 origin-left [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* One size at every width: shrunk any further on a phone it read
            as a stray glyph beside the bar's 44px buttons. */}
        <svg
          width="8"
          height="20"
          viewBox="0 0 8 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[0.73125rem] h-[1.828125rem]"
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
          className={`font-montserrat italic text-[0.984rem] leading-6 relative -top-.5 ${wordmark} ${isDeepSeaMode ? 'text-[#00BCD4]' : isHoneycombMode ? 'text-[#DAA520]' : isDarkMode ? 'text-white' : 'text-black'}`}
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
 * Where the "New Session" / "Active Session" buttons switch from an icon to
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

/** The shape of the bar's text buttons (Sign in, Sign up) */
const PILL = `inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${TOUCH_TARGET}`;

/**
 * New Session is a review page's one filled button, unless the page has a
 * primary of its own (an empty state's "Add First Match"): then it steps
 * back to an outline, so no view shows two fills. The page marks that
 * button `data-page-primary` and CSS does the rest, so the bar never has to
 * know which page, or which state of it, is showing. An inset ring rather
 * than a border, so the pill keeps its size. The fill is cleared with
 * `!important`, as the honeycomb and deepsea `.bg-team-blue` colours in
 * global.css are themselves important and would otherwise keep it filled.
 */
const STEPS_BACK_FOR_PAGE_PRIMARY =
  '[body:has([data-page-primary])_&]:!bg-transparent [body:has([data-page-primary])_&]:text-foreground [body:has([data-page-primary])_&]:ring-1 [body:has([data-page-primary])_&]:ring-inset [body:has([data-page-primary])_&]:ring-team-blue';

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
  /**
   * A sign-in, sign-up or reset page: only the theme, and the way back to a
   * session that is still being scored.
   */
  minimal: boolean;
}

const NavigationMenu = ({
  timerInBar,
  condensed,
  flush,
  minimal,
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
  // What keeps the matches is completing the session, which the question
  // offers itself when it can be done now: saved matches, none being played.
  // Not under the walkthrough, which holds the session as it found it.
  const canCompleteFirst =
    !isTutorialActive &&
    !sessionData.isSessionCompleted &&
    !matchActive &&
    (sessionData.matches?.length ?? 0) > 0;

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

  /**
   * "Complete session and sign out": the scoring page saves the session as
   * Complete Session does (going there first, if it isn't the page shown),
   * then signs out. If it can't be saved, it says why and stays signed in.
   */
  const completeThenSignOut = () => {
    setShowLogoutConfirm(false);
    requestCompleteSession({ onSaved: () => void signOut() });
    if (!isOnActivePage) navigate(ROUTES.ACTIVE);
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
      // Already there: the tutorial opens itself, or says why it can't
      window.dispatchEvent(new Event(TUTORIAL_RESTART_EVENT));
      return;
    }
    // The tutorial borrows the session and puts back what it found when it
    // closes, which would undo the scoring of a match still being played.
    if (matchActive) {
      toast.info('Finish or discard this match to replay the tutorial');
      return;
    }
    // The tutorial lives on the scoring page, and picks this up there
    try {
      sessionStorage.setItem(STORAGE_KEYS.START_TUTORIAL, 'true');
    } catch {
      /* storage unavailable: they still land on the page it explains */
    }
    navigate(ROUTES.ACTIVE);
  };

  const iconButtonClass = `p-2 sm:p-2.5 rounded-full transition-colors items-center justify-center ${TOUCH_TARGET} ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`;
  const hoverClass = isDarkMode
    ? 'hover:bg-team-white-10'
    : 'hover:bg-gray-100';

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

  /**
   * Profile, Team and Sign out. `labelled` heads them with the name and
   * email; the scoring bar's menu drops that during a match, to stay short.
   */
  const accountItems = (labelled: boolean) =>
    user && (
      <>
        {labelled && (
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
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center">
            <UserCircle className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTeam} className="flex items-center">
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
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </>
    );

  // The way back to a session still being scored, from any other page. A
  // link, named for what it opens; the word is the name while it shows,
  // and the dot only goes with the word (beside the icon alone it read as
  // a second signal light).
  const activeSessionLink = hasActiveSession && !isOnActivePage && (
    <Link
      to={ROUTES.ACTIVE}
      aria-label="Active session"
      className={`flex items-center justify-center gap-1.5 sm:gap-2 sm:px-3 sm:py-1.5 rounded-full whitespace-nowrap transition-colors ${TOUCH_TARGET} ${isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-team-white-10' : 'text-green-600 hover:text-green-700 hover:bg-gray-100'}`}
    >
      {/* Label collapses to an icon when the bar is short of room, so this
          doesn't crowd the buttons next to it. The padding keeps the
          icon-only link the size of its neighbours (phones get their 44px
          minimum from global.css). */}
      <span className={`${labels.text} text-sm font-semibold`}>
        Active Session
      </span>
      <Radio aria-hidden className={`w-4 h-4 ${labels.icon}`} />
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full bg-green-500 ${labels.text}`}
      />
    </Link>
  );

  const themeMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Select theme"
          // On the sign-in pages it is all the bar holds, phones included
          className={`${minimal ? 'flex' : 'hidden sm:flex'} ${iconButtonClass}`}
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
  );

  // During a match the scoring bar's menu keeps to what can't wait: the
  // tutorial can't run over a match, and the theme can be picked between
  // matches.
  const compactMenu = !matchActive;

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-2 ${flush ? '' : 'py-1 sm:py-2'}`}
    >
      {minimal ? (
        <>
          {activeSessionLink}
          {themeMenu}
        </>
      ) : condensed ? (
        // Everything the bar usually holds, behind one button. Sessions is
        // the back arrow at the other end of the bar.
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
            {compactMenu && (
              <>
                {tutorialItem}
                {tutorialItem && <DropdownMenuSeparator />}
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <ThemeMenuItems />
                <DropdownMenuSeparator />
              </>
            )}
            {user ? (
              accountItems(compactMenu)
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
          {/* No "Sessions" here: the back arrow and the logo lead there
              from every other page. */}
          {activeSessionLink ||
            (!isOnActivePage && !isVisitor && (
              <button
                onClick={() => navigate(ROUTES.ACTIVE)}
                aria-label="New Session"
                className={`px-3 sm:px-4 py-1.5 rounded-full flex items-center justify-center gap-2 whitespace-nowrap transition-all bg-team-blue hover:opacity-90 ${TOUCH_TARGET} ${isDarkMode ? 'text-black' : 'text-white'} ${STEPS_BACK_FOR_PAGE_PRIMARY}`}
              >
                <span className={`${labels.text} text-sm font-semibold`}>
                  New Session
                </span>
                <Plus className={`w-4 h-4 ${labels.icon}`} />
              </button>
            ))}

          {canTour && (
            <button
              onClick={handleStartInteractiveTutorial}
              aria-label="Start interactive tutorial"
              className={`hidden sm:flex ${iconButtonClass}`}
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {themeMenu}

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
                  aria-label={`Account menu, ${user.displayName || user.email || 'User'}`}
                  className={`relative h-8 w-8 rounded-full sm:ml-2 ${TOUCH_TARGET}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.photoURL || ''}
                      alt={user.displayName || ''}
                    />
                    {/* Neutral, so it doesn't pass for a second "+" beside
                        the filled New Session button */}
                    <AvatarFallback
                      className={`text-xs font-semibold ${isDarkMode ? 'bg-team-white-10 text-white' : 'bg-gray-100 text-gray-900'}`}
                    >
                      {getInitials(user.displayName || user.email || 'User')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              {/* The theme's own menu surface, like every other menu */}
              <DropdownMenuContent
                className="w-56"
                align="end"
                onCloseAutoFocus={afterAccountMenuClosed}
              >
                {accountItems(true)}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.LOGIN}
                className={`${PILL} font-medium ${hoverClass} ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Sign in
              </Link>
              {/* An outline, so New Session stays the bar's one filled
                  button; a plain link while a match is being scored, where
                  the match controls are what counts. On a phone Sign up
                  lives in the overflow menu above. */}
              <Link
                to={ROUTES.SIGNUP}
                className={`hidden sm:inline-flex ${PILL} font-semibold ${hoverClass} ${
                  isOnActivePage && matchActive
                    ? isDarkMode
                      ? 'text-team-white-60 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                    : `border border-team-blue ${isDarkMode ? 'text-white' : 'text-gray-900'}`
                }`}
              >
                Sign up
              </Link>
            </div>
          )}
        </>
      )}

      {/* Dialog puts itself at the end of <body>, out of the sticky
          header's stacking context. */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title={
          canCompleteFirst
            ? 'Complete this session before signing out?'
            : 'Sign out and lose this session?'
        }
        description={signOutLoss}
        cancelLabel="Cancel"
        confirmLabel="Sign out anyway"
        icon={LogOut}
        onConfirm={signOut}
      >
        {canCompleteFirst && (
          <button
            type="button"
            onClick={completeThenSignOut}
            className={`flex w-full min-h-11 items-center justify-center rounded-xl border-2 px-4 py-1.5 text-sm font-bold leading-tight transition-colors ${primaryClass(isDarkMode)}`}
          >
            Complete session and sign out
          </button>
        )}
      </ConfirmDialog>
    </div>
  );
};

/** Text of the bar on a dark theme / the light one */
const TEXT = ['text-gray-900', 'text-white'] as const;

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
  // '1 pt' / '97 pts', the number and its unit set apart below
  const [points, unit] = formatPoints(total).split(' ');
  // As the big clock reads it: a bare '3' / '2' / '1' through the 3-2-1
  // (the chip beside it says STARTING), not '0:03'
  const time = matchClockText({
    matchActive,
    matchPhase,
    timer,
    phaseTimer,
    isTutorialActive,
    formatTime,
  });
  const text = TEXT[isDarkMode ? 1 : 0];

  // The paused chip is the phase chip's size, so pausing changes nothing
  // else in the bar. On a phone the total keeps its unit from 360px up; a
  // wider bar has room for all of it: the logo gives up its name while the
  // clock is there (see `Header`).
  const unitClass = dense ? 'max-[359px]:hidden' : '';

  return (
    <span
      className={`flex items-center whitespace-nowrap ${dense ? 'gap-2' : 'gap-2 sm:gap-3'}`}
    >
      {/* Every digit in a cell of its own width, so neither the digits nor
          the chip beside them shift as the seconds tick, and always as wide
          as 'm:ss' (the 3-2-1's one digit sits in the middle of that), so
          nothing moves when the countdown gives way to the clock. Always
          the text colour: the chip is what says which part of the match
          this is. */}
      <span
        data-header-clock
        role="timer"
        aria-label="Match clock"
        className={`min-w-[2.3em] text-center font-righteous leading-none transition-opacity ${dense ? 'text-3xl' : 'text-xl sm:text-3xl lg:text-4xl'} ${text} ${paused ? 'opacity-40' : ''}`}
      >
        <ClockDigits text={time} />
        <span className="sr-only">{time}</span>
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
        className={`font-bold tabular-nums leading-none ${text} ${dense ? 'text-xl' : 'text-lg sm:text-2xl lg:text-3xl'}`}
      >
        {points}
        <span
          className={`ml-1 text-xs sm:text-sm font-semibold ${unitClass} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {unit}
        </span>
      </span>
    </span>
  );
};

/**
 * Says which saved match is open in the scoring fields. It takes the
 * clock's place in the bar: the clock belongs to the next match, and beside
 * an old match's total it would read as that match's time. A chip, in the
 * amber of PAUSED: a state the fields are in, not an alarm.
 */
const EditingLabel = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, editingMatchId } = useSessionCore();
  const match = sessionData.matches?.find(m => m.id === editingMatchId);

  return (
    <span
      data-header-editing
      className={`${CHIP_BASE} ${CHIP_SIZES.md} ${chipTone('amber', isDarkMode)}`}
    >
      Editing Match {match?.matchNumber ?? ''}
    </span>
  );
};

/**
 * The phone scoring bar's middle while the big clock is on screen below it:
 * which match is being played and, until its buzzer, its running total.
 */
const MatchLabel = ({ withTotal }: { withTotal: boolean }) => {
  const { isDarkMode } = useTheme();
  const { sessionData, editingMatchId } = useSessionCore();
  const matches = sessionData.matches ?? [];
  // The number Start gave it: one past the highest saved so far
  const matchNumber =
    matches.reduce((n, m, i) => Math.max(n, m.matchNumber ?? i + 1), 0) + 1;
  const total = withTotal
    ? calculateScore({
        ...sessionData,
        matchType: liveMatchType(sessionData, editingMatchId),
      }).total
    : null;

  return (
    <span
      data-header-match
      className={`text-sm font-semibold whitespace-nowrap tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
    >
      Match {matchNumber}
      {total !== null && (
        <>
          <span aria-hidden className="mx-1.5">
            ·
          </span>
          <span className="sr-only">, </span>
          <span className={TEXT[isDarkMode ? 1 : 0]}>
            {formatPoints(total)}
          </span>
        </>
      )}
    </span>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  const { hasStarted, sessionData, matchActive, matchPhase, editingMatchId } =
    useSessionCore();
  const location = useLocation();
  const isOnSessionsPage = location.pathname === '/sessions';
  const isOnActivePage = location.pathname.includes('/active');
  const isAuthPage = AUTH_PATHS.includes(location.pathname);
  const [timerScrolledPast, setTimerScrolledPast] = useState(false);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const isNarrow = useIsCompact();
  const isActiveCompact = useActiveCompact();
  const isShort = useActiveShort();
  const sideBySide = useActiveSideBySide();
  // The scoring page decides for itself when it is a phone (a phone on its
  // side counts); the bar follows it there, so the two never disagree.
  const isCompact = isOnActivePage ? isActiveCompact : isNarrow;

  const isCompleted = Boolean(sessionData.isSessionCompleted);
  const isEditing = editingMatchId !== null;
  /** A match is being played (or paused), and its buzzer hasn't gone */
  const matchLive = matchActive && matchPhase !== 'ended';

  // On the scoring page the bar's clock stands in for the big one once that
  // is scrolled under the bar, and only while it has a match to time: after
  // the buzzer and between matches it would only repeat what the page says.
  // Elsewhere it shows for as long as the session runs, except on the
  // sign-in pages, which keep to the logo and the theme.
  const showCompactTimer =
    !isCompleted &&
    (isOnActivePage
      ? timerScrolledPast && matchLive
      : hasStarted && !isAuthPage);
  /** The middle of the bar holds something (a phone gives it its own row) */
  const clockInBar =
    !isCompact && (showCompactTimer || (isOnActivePage && isEditing));
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
  /**
   * The bar's ends line up with the content under them. The scoring page's
   * full-size layout has a column of its own; its phone layout keeps the
   * usual one, whose 8px ends the toasts over the bar are sized to cover.
   */
  const column =
    isOnActivePage && !isCompact ? ACTIVE_PAGE_CONTAINER : PAGE_CONTAINER;

  useEffect(() => {
    if (!isOnActivePage) {
      setTimerScrolledPast(false);
      return;
    }

    // Track the big match clock itself (not the block around it), and swap
    // in the header copy as soon as its top goes under the header. Waiting
    // for all of it to pass left a laptop screen, which can't scroll that
    // far, with the clock cut in half or gone and nothing in its place.
    const check = () => {
      const timerEl = document.querySelector<HTMLElement>('[data-match-timer]');
      if (!timerEl || !headerEl) {
        setTimerScrolledPast(false);
        return;
      }
      const headerBottom = headerEl.getBoundingClientRect().bottom;
      setTimerScrolledPast(timerEl.getBoundingClientRect().top < headerBottom);
    };

    const timeout = setTimeout(check, 100);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    // A match starting, ending or being opened for editing changes what is
    // above the clock without a scroll: look again then too.
  }, [
    isOnActivePage,
    location.pathname,
    headerEl,
    matchActive,
    matchPhase,
    isEditing,
    isCompact,
  ]);

  // No way "back" from a sign-in page: the logo still goes to the sessions
  const backButton = !isOnSessionsPage && !isAuthPage && (
    <Link
      to={ROUTES.SESSIONS}
      aria-label="Back to sessions"
      className={`p-1.5 sm:p-2 rounded-full transition-colors flex items-center justify-center ${TOUCH_TARGET} ${isDarkMode ? 'hover:bg-team-white-10 text-white' : 'hover:bg-gray-100 text-black'}`}
    >
      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
    </Link>
  );

  /** What the middle of the bar holds; `null` leaves it empty. */
  const centre = () => {
    if (isAuthPage) return null;
    if (isScoringBar) {
      if (isEditing) return <EditingLabel />;
      // On its side the clock has a column of its own, always in view
      if (sideBySide) return null;
      if (timerScrolledPast && matchLive) {
        return (
          <div className="animate-in fade-in duration-200">
            <HeaderClock dense />
          </div>
        );
      }
      // The big clock is on screen just below (or its match is over): say
      // which match this is, and its total until the buzzer
      return <MatchLabel withTotal={matchLive} />;
    }
    if (isCompact) return null;
    if (isEditing && (isOnActivePage || showCompactTimer)) {
      return <EditingLabel />;
    }
    if (!showCompactTimer) return null;
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
      className={`top-0 w-full border-b z-50 [&_[id]]:scroll-mt-0 ${
        isShort && !matchActive ? 'relative' : 'sticky'
      } ${
        isShort ? 'py-1' : isFixedHeight ? 'py-2' : 'py-2 sm:py-3 md:py-4'
      } ${isDarkMode ? 'border-team-white-20 bg-team-dark' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      {/* The pages' own column, so the bar's ends line up with the content
          under it. */}
      <div
        className={`${column} grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-1 sm:gap-4 lg:gap-6 ${isFixedHeight ? 'h-11' : ''}`}
      >
        {/* Never narrower than the arrow and logo, so the nav can't sit on
            top of them. */}
        <div className="flex items-center justify-start gap-1 sm:gap-2 md:gap-3 shrink-0">
          {backButton}
          {/* The clock needs the room in the middle more than the logo
              needs its name, short of the widest bar. */}
          {!isScoringBar && (
            <TeamTrackLogo
              iconOnly={isShort || (clockInBar && !isWide)}
              roomy={!backButton}
            />
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
            minimal={isAuthPage}
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
