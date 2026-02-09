import {
  forwardRef,
  useState,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import { toCss, parse } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';

export interface ColorInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'color'> {
  /**
   * Color format displayed in the input.
   * @default 'hex'
   */
  format?: 'hex' | 'rgb' | 'hsl' | 'oklch';
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
  /** Standalone onChange (alternative to ColorProvider) */
  onChange?: (color: Color) => void;
}

/**
 * A text input for entering color values in various formats.
 *
 * Renders as a `<div>` wrapper containing an `<input type="text">`.
 * Completely unstyled — use data attributes and CSS to style it.
 *
 * Data attributes on the root:
 * - `[data-color-input]` — always present
 * - `[data-format]` — current format string
 * - `[data-valid]` — present when the input text is parseable
 * - `[data-editing]` — present while the user is actively editing
 */
export const ColorInput = forwardRef<HTMLDivElement, ColorInputProps>(
  function ColorInput(
    {
      format = 'hex',
      color: colorProp,
      onChange: onChangeProp,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();

    const color = colorProp ?? context?.color;
    const setColor = onChangeProp ?? context?.setColor;

    if (!color || !setColor) {
      throw new Error(
        'ColorInput requires either a <ColorProvider> ancestor or explicit color/onChange props.',
      );
    }

    const displayValue = useMemo(() => toCss(color, format), [color, format]);

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const currentValue = isEditing ? inputValue : displayValue;

    const isValid = useMemo(() => {
      try {
        parse(currentValue);
        return true;
      } catch {
        return false;
      }
    }, [currentValue]);

    const commitValue = useCallback(() => {
      setIsEditing(false);
      try {
        const parsed = parse(inputValue);
        setColor(parsed);
      } catch {
        // Invalid input — revert to current color display value
      }
    }, [inputValue, setColor]);

    const handleFocus = useCallback(() => {
      setIsEditing(true);
      setInputValue(displayValue);
    }, [displayValue]);

    const handleBlur = useCallback(() => {
      commitValue();
    }, [commitValue]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
      },
      [],
    );

    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          commitValue();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setIsEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      },
      [commitValue],
    );

    return (
      <div
        {...props}
        ref={ref}
        data-color-input=""
        data-format={format}
        data-valid={isValid || undefined}
        data-editing={isEditing || undefined}
      >
        <input
          type="text"
          value={currentValue}
          aria-label="Color value"
          spellCheck={false}
          autoComplete="off"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  },
);
