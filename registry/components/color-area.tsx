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
import { useColorContext } from '@/hooks/color-context';

export interface ColorAreaProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'color'> {
  channels?: {
    x: 'l' | 'c' | 'h';
    y: 'l' | 'c' | 'h';
  };
  xRange?: [number, number];
  yRange?: [number, number];
  color?: Color;
  onChange?: (color: Color) => void;
}

const DEFAULT_RANGES: Record<string, [number, number]> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
};

export const ColorArea = forwardRef<HTMLDivElement, ColorAreaProps>(
  function ColorArea(
    {
      channels = { x: 'c', y: 'l' },
      xRange,
      yRange,
      color: colorProp,
      onChange: onChangeProp,
      ...props
    },
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
        'ColorArea requires either a <ColorProvider> ancestor or explicit color/onChange props.',
      );
    }

    const areaRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const xR = xRange ?? DEFAULT_RANGES[channels.x];
    const yR = yRange ?? DEFAULT_RANGES[channels.y];

    const xNorm = (color[channels.x] - xR[0]) / (xR[1] - xR[0]);
    const yNorm = 1 - (color[channels.y] - yR[0]) / (yR[1] - yR[0]);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = areaRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const x = clamp((clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((clientY - rect.top) / rect.height, 0, 1);

        const xVal = xR[0] + x * (xR[1] - xR[0]);
        const yVal = yR[0] + (1 - y) * (yR[1] - yR[0]);

        setColor({
          ...color,
          [channels.x]: xVal,
          [channels.y]: yVal,
        });
      },
      [color, setColor, channels, xR, yR],
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
        const xStep = step * (xR[1] - xR[0]);
        const yStep = step * (yR[1] - yR[0]);

        let newColor: Color | null = null;

        switch (e.key) {
          case 'ArrowRight':
            newColor = {
              ...color,
              [channels.x]: clamp(color[channels.x] + xStep, xR[0], xR[1]),
            };
            break;
          case 'ArrowLeft':
            newColor = {
              ...color,
              [channels.x]: clamp(color[channels.x] - xStep, xR[0], xR[1]),
            };
            break;
          case 'ArrowUp':
            newColor = {
              ...color,
              [channels.y]: clamp(color[channels.y] + yStep, yR[0], yR[1]),
            };
            break;
          case 'ArrowDown':
            newColor = {
              ...color,
              [channels.y]: clamp(color[channels.y] - yStep, yR[0], yR[1]),
            };
            break;
        }

        if (newColor) {
          e.preventDefault();
          setColor(newColor);
        }
      },
      [color, setColor, channels, xR, yR],
    );

    return (
      <div
        {...props}
        ref={(node) => {
          (areaRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-area=""
        data-dragging={isDragging || undefined}
        role="slider"
        aria-label="Color area"
        aria-valuetext={`${channels.x}: ${color[channels.x].toFixed(2)}, ${
          channels.y
        }: ${color[channels.y].toFixed(2)}`}
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
          data-color-area-thumb=""
          data-x={xNorm.toFixed(4)}
          data-y={yNorm.toFixed(4)}
          style={{
            position: 'absolute',
            left: `${xNorm * 100}%`,
            top: `${yNorm * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
