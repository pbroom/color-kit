import { Moon, Sun } from 'lucide-react';
import { toggleTheme } from '@/site/theme';

/**
 * Two-state theme toggle. Both icon/label pairs are in the markup and CSS
 * shows the one for the current `[data-theme]`, so the control is correct in
 * prerendered HTML, before hydration, and with no React state at all.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggleTheme}
    >
      <span className="theme-toggle__when-light">
        <Moon aria-hidden="true" size={16} strokeWidth={1.75} />
        <span className="visually-hidden">Switch to dark theme</span>
      </span>
      <span className="theme-toggle__when-dark">
        <Sun aria-hidden="true" size={16} strokeWidth={1.75} />
        <span className="visually-hidden">Switch to light theme</span>
      </span>
    </button>
  );
}
