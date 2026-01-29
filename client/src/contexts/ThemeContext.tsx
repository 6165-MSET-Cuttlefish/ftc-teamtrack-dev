import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { STORAGE_KEYS } from '@/constants';

type ThemeMode = 'dark' | 'light' | 'honeycomb' | 'zen';

interface ThemeContextType {
  isDarkMode: boolean;
  isHoneycombMode: boolean;
  isZenMode: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) {
      // Handle legacy boolean format
      if (saved === 'true') return 'dark';
      if (saved === 'false') return 'light';
      // New format
      try {
        const parsed = JSON.parse(saved);
        if (parsed === true) return 'dark';
        if (parsed === false) return 'light';
        if (typeof parsed === 'string' && ['dark', 'light', 'honeycomb', 'zen'].includes(parsed)) {
          return parsed as ThemeMode;
        }
      } catch {
        return 'dark';
      }
    }
    return 'dark';
  });

  // Derived values for backward compatibility
  const isDarkMode = themeMode === 'dark' || themeMode === 'honeycomb' || themeMode === 'zen';
  const isHoneycombMode = themeMode === 'honeycomb';
  const isZenMode = themeMode === 'zen';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Remove all theme classes first
    document.documentElement.classList.remove('dark', 'honeycomb', 'zen');
    // Add appropriate classes
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'honeycomb') {
      document.documentElement.classList.add('dark', 'honeycomb');
    } else if (themeMode === 'zen') {
      document.documentElement.classList.add('dark', 'zen');
    }
    // light mode = no classes
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev: ThemeMode) => {
      // Cycle: dark -> light -> honeycomb -> zen -> dark
      let next: ThemeMode;
      if (prev === 'dark') next = 'light';
      else if (prev === 'light') next = 'honeycomb';
      else if (prev === 'honeycomb') next = 'zen';
      else next = 'dark';
      
      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, isHoneycombMode, isZenMode, themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
