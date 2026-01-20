import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

// ============================================================================
// Constants
// ============================================================================

const THEME_STORAGE_KEY = 'teamtrack-theme';

// ============================================================================
// Types
// ============================================================================

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev: boolean) => {
      const next = !prev;
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
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
