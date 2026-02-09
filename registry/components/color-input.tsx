"use client";

import {
  forwardRef,
  useState,
  useCallback,
  useEffect,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { Color } from "@color-kit/core";
import { toHex, toCss, parse } from "@color-kit/core";
import { useColorContext } from "@/hooks/color-context";

export interface ColorInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "color"
  > {
  /**
   * The color format to display and parse.
   * @default "hex"
   */
  format?: "hex" | "rgb" | "hsl" | "oklch";
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
  /** Standalone onChange (alternative to ColorProvider) */
  onChange?: (color: Color) => void;
}

function colorToString(color: Color, format: string): string {
  if (format === "hex") return toHex(color);
  return toCss(color, format);
}

/**
 * A text input for entering and editing color values.
 *
 * Parses color strings on blur or Enter key press.
 * Supports hex, rgb, hsl, and oklch formats.
 *
 * Data attributes:
 * - `[data-color-input]` — always present
 * - `[data-format]` — the current format (hex, rgb, hsl, oklch)
 * - `[data-invalid]` — present when the current text cannot be parsed
 */
export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  function ColorInput(
    { format = "hex", color: colorProp, onChange: onChangeProp, ...props },
    ref,
  ) {
    const context = (() => {
      try {
        return useColorContext();
      } catch {
        return null;
      }
    })();

    const color = colorProp ?? context?.color;
    const setColor = onChangeProp ?? context?.setColor;

    if (!color || !setColor) {
      throw new Error(
        "ColorInput requires either a <ColorProvider> ancestor or explicit color/onChange props.",
      );
    }

    const [text, setText] = useState(() => colorToString(color, format));
    const [isInvalid, setIsInvalid] = useState(false);

    // Sync text when color changes externally
    useEffect(() => {
      setText(colorToString(color, format));
      setIsInvalid(false);
    }, [color, format]);

    const commit = useCallback(
      (value: string) => {
        try {
          const parsed = parse(value.trim());
          setColor(parsed);
          setIsInvalid(false);
        } catch {
          setIsInvalid(true);
        }
      },
      [setColor],
    );

    const handleBlur = useCallback(() => {
      commit(text);
    }, [text, commit]);

    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          commit(text);
        }
        if (e.key === "Escape") {
          setText(colorToString(color, format));
          setIsInvalid(false);
        }
        props.onKeyDown?.(e);
      },
      [text, commit, color, format, props.onKeyDown],
    );

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        data-color-input=""
        data-format={format}
        data-invalid={isInvalid || undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={props["aria-label"] ?? `Color value (${format})`}
        aria-invalid={isInvalid || undefined}
      />
    );
  },
);
