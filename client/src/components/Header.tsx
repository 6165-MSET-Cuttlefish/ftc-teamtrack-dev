import { Search, Sun, Settings, User, LogOut, UserCircle, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Button } from './ui/button';

const TeamTrackLogo = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 flex-none"
      >
        <path d="M11.9982 0.967394L22.8213 6.75406H1.17503L11.9982 0.967394Z" fill="#B0E5FE" />
        <path d="M11.9988 9.7791L1.17505 6.81445H22.8215L11.9988 9.7791Z" fill="#B0E5FE" />
        <path d="M0.963143 3.06488L9.85636 0.659999L0 7.70297L0.963143 3.06488Z" fill="#B0E5FE" />
        <path d="M23.0369 3.06488L14.1437 0.659999L24 7.70297L23.0369 3.06488Z" fill="#B0E5FE" />
        <path d="M1.17578 10.2721C1.17578 9.76003 1.81084 9.42724 2.50806 9.66972C2.85338 9.79229 3.08514 10.055 3.08514 10.3245V20.0766C3.08514 20.3445 2.94698 20.5973 2.56425 20.7162C1.86459 20.9675 1.17578 20.6356 1.17578 20.0766V10.2721Z" fill="#B0E5FE" />
        <path d="M4.13114 11.3299C4.13689 10.7885 4.92448 10.4475 5.55498 10.7103C5.80711 10.8244 5.9475 11.0769 5.9475 11.3436V19.51C5.9475 19.7886 5.78046 20.0438 5.4682 20.1764C4.74136 20.4709 3.89309 20.1516 3.89703 19.6496L4.13114 11.3299Z" fill="#B0E5FE" />
        <path d="M22.8215 10.2703C22.8215 9.74671 22.1634 9.42352 21.6062 9.68481C21.3189 9.82336 21.1688 10.0812 21.1688 10.3372V20.1124C21.1688 20.3848 21.3259 20.6361 21.5899 20.7591C22.1868 21.0424 22.8215 20.7104 22.8215 20.1124V10.2703Z" fill="#B0E5FE" />
        <path d="M17.8006 11.3299C17.7965 10.7885 17.0089 10.4475 16.3784 10.7103C16.1263 10.8244 15.9859 11.0769 15.9859 11.3436V19.51C15.9859 19.7886 16.1529 20.0438 16.4651 20.1764C17.1919 20.4709 18.0402 20.1516 18.0362 19.6496L17.8006 11.3299Z" fill="#B0E5FE" />
      </svg>

      <div className={`font-montserrat text-white flex items-center gap-2`}>
        <span className={`text-2xl leading-none font-normal ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>Team</span>
        <span className={`text-2xl leading-none italic font-normal ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>Track</span>
      </div>
    </div>
  );
};

const SearchBox = () => {
  return (
    <div className="flex items-center gap-3 px-12 py-3.5 rounded-2xl bg-transparent border border-team-white-20">
      <Search className="w-4 h-4 text-team-blue-40" />
      <span className="text-team-blue-40 text-base font-medium">Search</span>
    </div>
  );
};

const NavigationMenu = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-dark-20">
      <span
        className={`text-base px-2 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
      >
        Learn
      </span>
      <span
        className={`text-base px-2 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
      >
        Community
      </span>
      <span
        className={`text-base px-2 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
      >
        About Us
      </span>
      <div className="w-4 h-4 bg-team-blue rounded-full flex items-center justify-center ml-2">
        <div className="w-2 h-2 bg-team-dark rounded-full"></div>
      </div>
      <button
        onClick={toggleTheme}
        className={`ml-1 hover:opacity-80 transition-opacity ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <Settings
        className={`w-4 h-4 ml-1 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
      />
      
      {/* Authentication Section */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                <AvatarFallback className="bg-team-blue text-white text-xs">
                  {getInitials(user.displayName || user.email || 'User')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
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
              <Link to="/sessions" className="flex items-center">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>My Sessions</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2 ml-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">
              <User className="mr-1 h-4 w-4" />
              Sign In
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export const Header = () => {
  const { isDarkMode } = useTheme();
  return (
    <header
      className={`w-full px-4 sm:px-8 py-4 flex items-center border-b border-team-white-20 relative ${isDarkMode ? 'bg-transparent' : 'bg-white'}`}
    >
      {/* Left: logo */}
      <div className="flex items-center flex-none">
        <TeamTrackLogo />
      </div>

      {/* spacer to push nav to right */}
      <div className="flex-1" />

      {/* Right: search + nav */}
      <div className="flex items-center flex-none">
        <div className="hidden lg:block mr-4">
          <SearchBox />
        </div>
        <NavigationMenu />
      </div>
    </header>
  );
};
