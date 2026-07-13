import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
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

  if (!mounted) return <div aria-hidden="true" className={`h-11 w-11 ${className}`} />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
      aria-pressed={theme === 'dark'}
      className={`flex h-11 w-11 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${className}`}
      title={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
    >
      {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
