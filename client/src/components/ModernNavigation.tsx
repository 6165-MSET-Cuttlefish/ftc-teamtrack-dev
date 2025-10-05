import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
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
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { 
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Zap,
  Target,
  TrendingUp
} from 'lucide-react';

const TeamTrackLogo = () => {
  const { isDarkMode } = useTheme();
  
  return (
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
            d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7.67857 2.31992Z"
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
  );
};

const navigationItems = [
  {
    title: 'Analytics',
    href: '/analysis',
    description: 'View performance insights and trends',
    icon: TrendingUp,
    items: [
      { title: 'Performance Metrics', href: '/analysis', description: 'Team performance analytics' },
      { title: 'Session Reports', href: '/sessions', description: 'Detailed session analysis' },
      { title: 'Comparisons', href: '/sessions/compare', description: 'Compare team sessions' },
    ]
  },
  {
    title: 'Sessions',
    href: '/sessions',
    description: 'Manage and view team sessions',
    icon: Target,
    items: [
      { title: 'All Sessions', href: '/sessions', description: 'View all team sessions' },
      { title: 'Create Session', href: '/sessions/select', description: 'Start new session' },
      { title: 'Live Sessions', href: '/live', description: 'Active team sessions' },
    ]
  },
  {
    title: 'Tools',
    href: '/tools',
    description: 'Design and analysis tools',
    icon: Zap,
    items: [
      { title: 'Figma Integration', href: '/figma', description: 'Design system integration' },
      { title: 'Original Tools', href: '/original', description: 'Legacy toolset' },
      { title: 'API Access', href: '/api', description: 'Developer tools' },
    ]
  }
];

interface ModernNavigationProps {
  variant?: 'default' | 'transparent';
}

export function ModernNavigation({ variant = 'default' }: ModernNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navClasses = cn(
    'sticky top-0 z-50 w-full transition-all duration-300',
    {
      'bg-background/80 backdrop-blur-lg border-b border-border/50': variant === 'default',
      'bg-transparent': variant === 'transparent',
    }
  );

  return (
    <nav className={navClasses}>
      <div className="container-modern">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <TeamTrackLogo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavigationMenu>
              <NavigationMenuList>
                {navigationItems.map((item) => (
                  <NavigationMenuItem key={item.title}>
                    <NavigationMenuTrigger 
                      className={cn(
                        'bg-transparent hover:bg-accent/50 data-[active]:bg-accent/50 transition-colors',
                        isActive(item.href) && 'bg-accent/50 text-accent-foreground'
                      )}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.title}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="grid gap-3 p-6 w-[400px]">
                        <div className="grid gap-1">
                          <h4 className="text-sm font-medium leading-none">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="grid gap-2">
                          {item.items.map((subItem) => (
                            <NavigationMenuLink
                              key={subItem.title}
                              asChild
                            >
                              <Link
                                to={subItem.href}
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">{subItem.title}</div>
                                <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                  {subItem.description}
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          ))}
                        </div>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

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
            {user && (
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
                      <Settings className="w-4 h-4" />
                      Profile Settings
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
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 p-0"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => (
                <div key={item.title} className="space-y-1">
                  <Link
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.title}
                  </Link>
                  <div className="ml-8 space-y-1">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.title}
                        to={subItem.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'block px-3 py-2 rounded-md text-xs transition-colors',
                          isActive(subItem.href)
                            ? 'bg-accent/50 text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                        )}
                      >
                        {subItem.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}