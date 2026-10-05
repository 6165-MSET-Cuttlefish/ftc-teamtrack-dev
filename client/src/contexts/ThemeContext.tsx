import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
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

/**
 * Turns every CSS transition off (`.theme-switching` in global.css) until
 * the new theme has been painted. Otherwise anything with its own transition
 * fades from the old colours while the page around it has already switched:
 * white text on a white card, black blocks on a light page. Two frames: the
 * first paints the new theme, the second gives the transitions back once
 * nothing is changing any more, so none of them starts.
 */
const suspendTransitions = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove('theme-switching'))
  );
};

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

  // Before paint, so the theme classes on <html> change in the same frame as
  // the colour classes React renders from isDarkMode.
  useLayoutEffect(() => {
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
    suspendTransitions();
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
    suspendTransitions();
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
