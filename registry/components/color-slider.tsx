'use client';

import {
  useRef,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  type HTMLAttributes,
} from 'react';
import type { Color } from '@color-kit/core';
import { clamp } from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { SetRequestedOptions } from '@/hooks/use-color';

export interface ColorSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  channel: 'l' | 'c' | 'h' | 'alpha';
  range?: [number, number];
  orientation?: 'horizontal' | 'vertical';
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

const DEFAULT_RANGES: Record<string, [number, number]> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

const CHANNEL_LABELS: Record<string, string> = {
  l: 'Lightness',
  c: 'Chroma',
  h: 'Hue',
  alpha: 'Opacity',
};

export const ColorSlider = forwardRef<HTMLDivElement, ColorSliderProps>(
  function ColorSlider(
    {
      channel,
      range,
      orientation = 'horizontal',
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
        'ColorSlider requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const r = range ?? DEFAULT_RANGES[channel];
    const norm = clamp((requested[channel] - r[0]) / (r[1] - r[0]), 0, 1);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = sliderRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        let t: number;

        if (orientation === 'horizontal') {
          t = clamp((clientX - rect.left) / rect.width, 0, 1);
        } else {
          t = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
        }

        const value = r[0] + t * (r[1] - r[0]);

        setRequested(
          {
            ...requested,
            [channel]: value,
          },
          {
            changedChannel: channel,
            interaction: 'pointer',
          },
        );
      },
      [requested, setRequested, channel, r, orientation],
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

        let next: Color | null = null;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            next = {
              ...requested,
              [channel]: clamp(requested[channel] + channelStep, r[0], r[1]),
            };
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            next = {
              ...requested,
              [channel]: clamp(requested[channel] - channelStep, r[0], r[1]),
            };
            break;
        }

        if (next) {
          e.preventDefault();
          setRequested(next, {
            changedChannel: channel,
            interaction: 'keyboard',
          });
        }
      },
      [requested, setRequested, channel, r],
    );

    const isHorizontal = orientation === 'horizontal';
    const defaultLabel = `${CHANNEL_LABELS[channel] ?? channel} slider`;

    return (
      <div
        {...props}
        ref={(node) => {
          (sliderRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-slider=""
        data-channel={channel}
        data-orientation={orientation}
        data-dragging={isDragging || undefined}
        role="slider"
        aria-label={props['aria-label'] ?? defaultLabel}
        aria-valuemin={r[0]}
        aria-valuemax={r[1]}
        aria-valuenow={requested[channel]}
        aria-orientation={orientation}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          touchAction: 'none',
          ...props.style,
        }}
      >
        <div
          data-color-slider-thumb=""
          data-value={norm.toFixed(4)}
          style={{
            position: 'absolute',
            ...(isHorizontal
              ? {
                  left: `${norm * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  left: '50%',
                  top: `${(1 - norm) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }),
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
