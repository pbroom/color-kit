import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useColorStoreSelector } from './color-store.js';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  formatColorStringInputValue,
  hasExplicitOklchHue,
  isColorStringInputValueValid,
  parseColorStringInputValue,
  resolveIncomingRequested,
  type ColorStringInputFormat,
} from '@color-kit/driver';
import type { SetRequestedOptions } from './use-color.js';

/** Props for {@link ColorStringInput}; other attributes go to the wrapper `div`. */
export interface ColorStringInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Color format displayed in the input. Committed text may use any format
   * `parse` accepts.
   * @defaultValue 'hex'
   */
  format?: ColorStringInputFormat;
  /** Standalone requested color, used instead of a `<Color>` provider. */
  requested?: Color;
  /** Standalone change handler, used instead of a `<Color>` provider. */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /** Called when invalid text is committed via Enter or blur. */
  onInvalidCommit?: (draft: string) => void;
}

/**
 * Text input that shows the requested color as a CSS string and sets it
 * from typed text.
 *
 * Shows the requested color in `format` while not focused. Text is
 * committed on Enter or blur; Escape reverts. Valid text sets the requested
 * color (interaction `'text-input'`), invalid text calls `onInvalidCommit`
 * and reverts. An achromatic entry (a gray, black or white) keeps the
 * current hue unless it is an `oklch()` string with a hue other than
 * `none`. Renders a `div` (`data-color-string-input`, `data-format`,
 * `data-valid`, `data-editing`) around an unstyled text `input`.
 *
 * @throws {Error} When there is neither a `<Color>` ancestor nor both
 *   `requested` and `onChangeRequested`.
 *
 * @example
 * ```tsx
 * import { Color, ColorStringInput } from 'color-kit/react';
 *
 * export const Field = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorStringInput
 *       format="oklch"
 *       aria-label="Color"
 *       onInvalidCommit={(draft) => console.warn(`Not a color: ${draft}`)}
 *     />
 *   </Color>
 * );
 * ```
 */
export const ColorStringInput = forwardRef<
  HTMLDivElement,
  ColorStringInputProps
>(function ColorStringInput(
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
  const contextRequested = useColorStoreSelector(
    context?.store ?? null,
    (state) => state?.requested ?? null,
  );

  const requested = requestedProp ?? contextRequested;
  const setRequested = onChangeRequestedProp ?? context?.setRequested;

  if (!requested || !setRequested) {
    throw new Error(
      'ColorStringInput requires either a <Color> ancestor or explicit requested/onChangeRequested props.',
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
    if (inputValue === displayValue) {
      return;
    }
    const parsed = parseColorStringInputValue(inputValue);
    if (parsed) {
      // Only `oklch()` with a hue states one; any other achromatic entry
      // keeps the current hue. The resolved color serves standalone handlers;
      // `explicitHue` lets hook setters re-resolve against the latest state.
      const explicitHue = hasExplicitOklchHue(inputValue);
      setRequested(
        resolveIncomingRequested(requested, parsed, { explicitHue }),
        {
          interaction: 'text-input',
          explicitHue,
        },
      );
    } else {
      onInvalidCommit?.(inputValue);
    }
  }, [displayValue, inputValue, onInvalidCommit, requested, setRequested]);

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
});
