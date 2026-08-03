import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ className = '', showLabel = false }) {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme') || 'light';
    setTheme(stored);
    if (stored === 'dark') document.documentElement.classList.add('dark');
    setMounted(true);
  }, []);

  const toggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={`${showLabel ? 'h-10 flex-1' : 'h-9 w-9 sm:h-11 sm:w-11'} ${className}`}
      />
    );
  }

  const actionLabel = theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={actionLabel}
      aria-pressed={theme === 'dark'}
      className={`flex h-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.98] sm:h-11 ${showLabel ? 'flex-1 gap-2 px-3 text-xs font-semibold' : 'w-9 sm:w-11'} ${className}`}
      title={showLabel ? undefined : actionLabel}
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
      {showLabel && <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>}
    </button>
  );
}
