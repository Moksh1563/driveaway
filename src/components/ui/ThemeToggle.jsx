import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import IconSwap from '../layout/IconSwap';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-10 h-10 grid place-items-center rounded-full border border-line text-ink hover:border-ink transition-[border-color,transform] duration-150 ease-out active:scale-[0.96] ${className}`}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light' : 'Switch to dark'}
    >
      {/* Sun and moon trade places with a quick turn and cross-fade */}
      <IconSwap swapKey={dark ? 'sun' : 'moon'}>
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </IconSwap>
    </button>
  );
}
