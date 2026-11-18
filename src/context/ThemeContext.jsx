import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext();

const readStoredTheme = () => {
  try {
    return localStorage.getItem('driveaway_theme') || 'dark';
  } catch {
    return 'dark';
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0C0C0D' : '#ECEAE6');
    try {
      localStorage.setItem('driveaway_theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Animate colours only during the switch, then remove the transition again
    const root = document.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export default ThemeContext;
