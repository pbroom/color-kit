import { Menu } from '@base-ui/react/menu';
import { Circle, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from './theme-context.js';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const options: Array<{ label: string; value: ThemePreference }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export function ThemeSwitcher() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <Menu.Root>
      <Menu.Trigger
        render={(props, state) => (
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            data-state={state.open ? 'open' : 'closed'}
          >
            {resolvedTheme === 'dark' ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
          </Button>
        )}
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4}>
          <Menu.Popup className="z-50 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <Menu.RadioGroup
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              {options.map((option) => (
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                  closeOnClick
                >
                  <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <Circle className="size-2 fill-current" />
                    </Menu.RadioItemIndicator>
                  </span>
                  {option.label}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
