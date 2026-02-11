import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  formatColorInputValue,
  isColorInputValueValid,
  parseColorInputValue,
  type ColorInputFormat,
} from './api/color-input.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Color format displayed in the input.
   * @default 'hex'
   */
  format?: ColorInputFormat;
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
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
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextRequested = useSelector(
      () => context?.state$.requested.get() ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorInput requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const displayValue = useMemo(
      () => formatColorInputValue(requested, format),
      [requested, format],
    );

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const skipBlurCommitRef = useRef(false);

    const currentValue = isEditing ? inputValue : displayValue;

    const isValid = useMemo(() => {
      return isColorInputValueValid(currentValue);
    }, [currentValue]);

    const commitValue = useCallback(() => {
      setIsEditing(false);
      const parsed = parseColorInputValue(inputValue);
      if (parsed) {
        setRequested(parsed, {
          interaction: 'text-input',
        });
      }
      // Invalid input — revert to current color display value
    }, [inputValue, setRequested]);

    const handleFocus = useCallback(() => {
      setIsEditing(true);
      setInputValue(displayValue);
    }, [displayValue]);

    const handleBlur = useCallback(() => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        return;
      }
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
          e.preventDefault();
          commitValue();
          skipBlurCommitRef.current = true;
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsEditing(false);
          setInputValue(displayValue);
          skipBlurCommitRef.current = true;
          (e.target as HTMLInputElement).blur();
        }
      },
      [commitValue, displayValue],
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
