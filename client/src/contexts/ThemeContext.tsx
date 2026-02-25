import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { STORAGE_KEYS } from '@/constants';

type ThemeMode = 'dark' | 'light' | 'honeycomb' | 'deepsea';

interface ThemeContextType {
  isDarkMode: boolean;
  isHoneycombMode: boolean;
  isDeepSeaMode: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
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
      try {
        const parsed = JSON.parse(saved);
        if (parsed === true) return 'dark';
        if (parsed === false) return 'light';
        if (
          typeof parsed === 'string' &&
          ['dark', 'light', 'honeycomb', 'deepsea'].includes(parsed)
        ) {
          return parsed as ThemeMode;
        }
      } catch {
        return 'dark';
      }
    }
    return 'dark';
  });

  const isDarkMode = themeMode === 'dark' || themeMode === 'honeycomb' || themeMode === 'deepsea';
  const isHoneycombMode = themeMode === 'honeycomb';
  const isDeepSeaMode = themeMode === 'deepsea';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('dark', 'honeycomb', 'deepsea');
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'honeycomb') {
      document.documentElement.classList.add('dark', 'honeycomb');
    } else if (themeMode === 'deepsea') {
      document.documentElement.classList.add('dark', 'deepsea');
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev: ThemeMode) => {
      let next: ThemeMode;
      if (prev === 'dark') next = 'light';
      else if (prev === 'light') next = 'honeycomb';
      else if (prev === 'honeycomb') next = 'deepsea';
      else next = 'dark';

      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(next));
      return next;
    });
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(mode));
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        isHoneycombMode,
        isDeepSeaMode,
        themeMode,
        toggleTheme,
        setTheme,
      }}
    >
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
