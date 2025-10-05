import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Sun, 
  Moon, 
  Settings, 
  LogOut, 
  User,
  ChevronDown
} from 'lucide-react';

interface ModernHeaderProps {
  className?: string;
  showNavigation?: boolean;
}

export function ModernHeader({ className, showNavigation = true }: ModernHeaderProps) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg border-b border-border/50",
      className
    )}>
      <div className="container-modern">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center gap-2.5">
              <svg
                width="8"
                height="20"
                viewBox="0 0 8 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-2 h-5"
              >
                <path
                  d="M3.9994 0.645596L7.60709 6.46935H0.464233L3.9994 0.645596Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M4.00005 9.38123L0.392909 7.23372H7.53577L4.00005 9.38123Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M0.321429 2.31992L3.28571 0.5L0 6.06897L0.321429 2.31992Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7..67857 2.31992Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M0.392822 9.24855C0.392822 8.74891 0.92601 8.43006 1.36618 8.66649C1.58053 8.78162 1.71425 9.00524 1.71425 9.24855V18.3817C1.71425 18.6225 1.58325 18.8442 1.37235 18.9604C0.932001 19.203 0.392822 18.8844 0.392822 18.3817V9.24855Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M2.3681 10.2849C2.37112 9.76044 2.94632 9.44078 3.39332 9.71519C3.59274 9.83762 3.71427 10.0548 3.71427 10.2888V17.1858C3.71427 17.4334 3.58216 17.6622 3.36771 17.786C2.9042 18.0535 2.32529 17.717 2.32837 17.1818L2.3681 10.2849Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M7.53577 9.26287C7.53577 8.75993 6.9962 8.4414 6.55585 8.68437C6.34516 8.80063 6.21434 9.02223 6.21434 9.26287V18.4077C6.21434 18.6534 6.35068 18.8788 6.5683 18.9929C7.00823 19.2235 7.53577 18.9044 7.53577 18.4077V9.26287Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
                <path
                  d="M5.6319 10.2849C5.62888 9.76044 5.05368 9.44078 4.60668 9.71519C4.40726 9.83762 4.28573 10.0548 4.28573 10.2888V17.1858C4.28573 17.4334 4.41784 17.6622 4.63229 17.786C5.0958 18.0535 5.67471 17.717 5.67163 17.1818L5.6319 10.2849Z"
                  fill={isDarkMode ? '#B0E5FE' : '#537788'}
                />
              </svg>
              <span
                className={`font-montserrat italic text-sm leading-6 relative -top-1.5 ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                TeamTrack
              </span>
            </div>
          </Link>

          {/* Navigation - can be hidden on auth pages */}
          {showNavigation && (
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/analysis"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Analytics
              </Link>
              <Link
                to="/sessions"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sessions
              </Link>
              <Link
                to="/figma"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Design
              </Link>
            </nav>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="w-9 h-9 p-0 hover:bg-accent/50"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 hover:bg-accent/50"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.photoURL || undefined} />
                      <AvatarFallback className="bg-team-blue text-white text-sm">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium">
                      {user.displayName || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
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
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button size="sm" className="btn-primary-modern" asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}