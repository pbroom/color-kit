'use client';

import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import { parse, toCss } from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { SetRequestedOptions } from '@/hooks/use-color';

export interface ColorInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  format?: 'hex' | 'rgb' | 'hsl' | 'oklch';
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

function formatValue(
  color: Color,
  format: 'hex' | 'rgb' | 'hsl' | 'oklch',
): string {
  return toCss(color, format);
}

function parseValue(value: string): Color | null {
  try {
    return parse(value);
  } catch {
    return null;
  }
}

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

    const requested = requestedProp ?? context?.requested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorInput requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const displayValue = useMemo(
      () => formatValue(requested, format),
      [requested, format],
    );

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const skipBlurCommitRef = useRef(false);

    const currentValue = isEditing ? inputValue : displayValue;
    const isValid = useMemo(
      () => parseValue(currentValue) !== null,
      [currentValue],
    );

    const commitValue = useCallback(() => {
      setIsEditing(false);
      const parsed = parseValue(inputValue);
      if (parsed) {
        setRequested(parsed, { interaction: 'text-input' });
      }
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
