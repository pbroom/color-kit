import { useTheme, type ThemePreference } from './theme-context.js';

const options: Array<{ label: string; value: ThemePreference }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={preference === option.value ? 'is-active' : undefined}
          aria-pressed={preference === option.value}
          onClick={() => setPreference(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
