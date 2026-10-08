import { useEffect, useSyncExternalStore } from 'react';

/**
 * Theme state lives on `<html>` (`data-theme`, `data-theme-preference`),
 * set before first paint by the inline script in `index.html` and kept in
 * sync here. React never stores the theme, so prerendered markup and the
 * first client render agree and toggling causes no re-render cascade.
 *
 * The toggle is two-state: it flips what is rendered, and if the result
 * matches the OS preference it forgets the override instead of pinning it.
 */
export const THEME_STORAGE_KEY = 'color-kit-docs-theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Storage blocked: follow the OS.
  }
  return 'system';
}

function writePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Not persisted; the page still switches.
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyPreference(preference: ThemePreference): void {
  const resolved = preference === 'system' ? systemTheme() : preference;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
}

/** Flip the rendered theme. Event handlers only. */
export function toggleTheme(): void {
  const rendered: ResolvedTheme =
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const target: ResolvedTheme = rendered === 'dark' ? 'light' : 'dark';
  const preference: ThemePreference =
    target === systemTheme() ? 'system' : target;
  writePreference(preference);
  applyPreference(preference);
}

/** Follow OS changes while on `system`, and overrides made in other tabs. */
export function useThemeSync(): void {
  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY);
    const onSystemChange = () => {
      if (readPreference() === 'system') {
        applyPreference('system');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        applyPreference(readPreference());
      }
    };
    media?.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media?.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

function getTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * The rendered theme for components that must branch in JS (canvas, the
 * hero's contrast reference). `null` during prerender and hydration; prefer
 * CSS (`[data-theme]`) whenever the branch is presentational.
 */
export function useResolvedTheme(): ResolvedTheme | null {
  return useSyncExternalStore(subscribeTheme, getTheme, () => null);
}
