import { Check, ChevronDown, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from './theme-context.js';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options: Array<{ label: string; value: ThemePreference }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function themeIcon(preference: ThemePreference, resolvedTheme: 'light' | 'dark') {
  if (preference === 'light') return <Sun className="size-4" />;
  if (preference === 'dark') return <Moon className="size-4" />;
  return resolvedTheme === 'dark' ? (
    <Moon className="size-4" />
  ) : (
    <Laptop className="size-4" />
  );
}

export function ThemeSwitcher() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const icon = themeIcon(preference, resolvedTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ck-theme-trigger min-h-9"
          aria-label="Theme settings"
        >
          <span className="flex items-center gap-2">
            {icon}
            <span className="text-xs sm:text-sm">
              {preference === 'system' ? 'System' : options.find((o) => o.value === preference)?.label}
            </span>
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between text-xs">
          Active theme
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Check className="size-3.5" />
            {resolvedTheme}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
