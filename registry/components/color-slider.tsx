"use client";

import {
  useRef,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  type HTMLAttributes,
} from "react";
import type { Color } from "@color-kit/core";
import { clamp } from "@color-kit/core";
import { useOptionalColorContext } from "@/hooks/color-context";

export interface ColorSliderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "color"> {
  /**
   * Which color channel the slider controls.
   */
  channel: "l" | "c" | "h" | "alpha";
  /**
   * Value range for the channel.
   * Defaults: l=[0,1], c=[0,0.4], h=[0,360], alpha=[0,1]
   */
  range?: [number, number];
  /**
   * Slider orientation.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
  /** Standalone onChange (alternative to ColorProvider) */
  onChange?: (color: Color) => void;
}

const DEFAULT_RANGES: Record<string, [number, number]> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

const CHANNEL_LABELS: Record<string, string> = {
  l: "Lightness",
  c: "Chroma",
  h: "Hue",
  alpha: "Opacity",
};

/**
 * A 1D color slider for a single color channel.
 *
 * Renders as a plain `<div>` with a draggable thumb (`<div>`).
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes on the root:
 * - `[data-color-slider]` - always present
 * - `[data-channel]` - the channel name (l, c, h, alpha)
 * - `[data-orientation]` - horizontal or vertical
 * - `[data-dragging]` - present while the user is dragging
 *
 * Data attributes on the thumb (first child):
 * - `[data-color-slider-thumb]` - always present
 * - `[data-value]` - normalized position (0-1)
 */
export const ColorSlider = forwardRef<HTMLDivElement, ColorSliderProps>(
  function ColorSlider(
    {
      channel,
      range,
      orientation = "horizontal",
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
        "ColorSlider requires either a <ColorProvider> ancestor or explicit color/onChange props.",
      );
    }

    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const r = range ?? DEFAULT_RANGES[channel];

    // Compute normalized position from color
    const norm = clamp((color[channel] - r[0]) / (r[1] - r[0]), 0, 1);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = sliderRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        let t: number;

        if (orientation === "horizontal") {
          t = clamp((clientX - rect.left) / rect.width, 0, 1);
        } else {
          // Vertical: top = max, bottom = min (inverted)
          t = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
        }

        const value = r[0] + t * (r[1] - r[0]);

        setColor({
          ...color,
          [channel]: value,
        });
      },
      [color, setColor, channel, r, orientation],
    );

    const onPointerDown = useCallback(
      (e: ReactPointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        updateFromPosition(e.clientX, e.clientY);
      },
      [updateFromPosition],
    );

    const onPointerMove = useCallback(
      (e: ReactPointerEvent) => {
        if (!isDragging) return;
        updateFromPosition(e.clientX, e.clientY);
      },
      [isDragging, updateFromPosition],
    );

    const onPointerUp = useCallback(() => {
      setIsDragging(false);
    }, []);

    const onKeyDown = useCallback(
      (e: ReactKeyboardEvent) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const channelStep = step * (r[1] - r[0]);

        let newColor: Color | null = null;

        const isForward =
          orientation === "horizontal" ? "ArrowRight" : "ArrowUp";
        const isBackward =
          orientation === "horizontal" ? "ArrowLeft" : "ArrowDown";

        switch (e.key) {
          case isForward:
          case "ArrowRight":
          case "ArrowUp":
            if (
              e.key === isForward ||
              e.key === "ArrowRight" ||
              e.key === "ArrowUp"
            ) {
              newColor = {
                ...color,
                [channel]: clamp(color[channel] + channelStep, r[0], r[1]),
              };
            }
            break;
          case isBackward:
          case "ArrowLeft":
          case "ArrowDown":
            if (
              e.key === isBackward ||
              e.key === "ArrowLeft" ||
              e.key === "ArrowDown"
            ) {
              newColor = {
                ...color,
                [channel]: clamp(color[channel] - channelStep, r[0], r[1]),
              };
            }
            break;
        }

        if (newColor) {
          e.preventDefault();
          setColor(newColor);
        }
      },
      [color, setColor, channel, r, orientation],
    );

    const isHorizontal = orientation === "horizontal";
    const defaultLabel = `${CHANNEL_LABELS[channel] ?? channel} slider`;

    return (
      <div
        {...props}
        ref={(node) => {
          (sliderRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-slider=""
        data-channel={channel}
        data-orientation={orientation}
        data-dragging={isDragging || undefined}
        role="slider"
        aria-label={props["aria-label"] ?? defaultLabel}
        aria-valuemin={r[0]}
        aria-valuemax={r[1]}
        aria-valuenow={color[channel]}
        aria-orientation={orientation}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          touchAction: "none",
          ...props.style,
        }}
      >
        <div
          data-color-slider-thumb=""
          data-value={norm.toFixed(4)}
          style={{
            position: "absolute",
            ...(isHorizontal
              ? {
                  left: `${norm * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }
              : {
                  left: "50%",
                  top: `${(1 - norm) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }),
            pointerEvents: "none",
          }}
        />
        {props.children}
      </div>
    );
  },
);
