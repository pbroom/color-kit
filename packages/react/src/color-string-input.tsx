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
  formatColorStringInputValue,
  isColorStringInputValueValid,
  parseColorStringInputValue,
  type ColorStringInputFormat,
} from './api/color-string-input.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorStringInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /**
   * Color format displayed in the input.
   * @default 'hex'
   */
  format?: ColorStringInputFormat;
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /** Called when invalid text is committed via Enter or blur. */
  onInvalidCommit?: (draft: string) => void;
}

/**
 * Legacy free-form color-string input for hex/rgb/hsl/oklch editing.
 */
export const ColorStringInput = forwardRef<HTMLDivElement, ColorStringInputProps>(
  function ColorStringInput(
    {
      format = 'hex',
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      onInvalidCommit,
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
        'ColorStringInput requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const displayValue = useMemo(
      () => formatColorStringInputValue(requested, format),
      [requested, format],
    );

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const skipBlurCommitRef = useRef(false);

    const currentValue = isEditing ? inputValue : displayValue;
    const isValid = useMemo(
      () => isColorStringInputValueValid(currentValue),
      [currentValue],
    );

    const commitValue = useCallback(() => {
      setIsEditing(false);
      const parsed = parseColorStringInputValue(inputValue);
      if (parsed) {
        setRequested(parsed, { interaction: 'text-input' });
      } else {
        onInvalidCommit?.(inputValue);
      }
    }, [inputValue, onInvalidCommit, setRequested]);

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
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
      },
      [],
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitValue();
          skipBlurCommitRef.current = true;
          (event.target as HTMLInputElement).blur();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setIsEditing(false);
          setInputValue(displayValue);
          skipBlurCommitRef.current = true;
          (event.target as HTMLInputElement).blur();
        }
      },
      [commitValue, displayValue],
    );

    return (
      <div
        {...props}
        ref={ref}
        data-color-string-input=""
        data-format={format}
        data-valid={isValid || undefined}
        data-editing={isEditing || undefined}
      >
        <input
          type="text"
          value={currentValue}
          aria-label={props['aria-label'] ?? 'Color value'}
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
