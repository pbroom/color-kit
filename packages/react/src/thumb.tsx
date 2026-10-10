import {
  forwardRef,
  useCallback,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import { assignRef } from './assign-ref.js';
import { useColorStoreSelector } from './color-store.js';
import {
  colorFromColorAreaKey,
  createColorState,
  getActiveDisplayedColor,
  getColorAreaKeyAxis,
  getColorAreaThumbPosition,
  getColorAreaValueText,
  getColorDisplayStyles,
  type ResolvedColorAreaAxes,
} from '@color-kit/driver';
import { useColorAreaContext } from './color-area-context.js';
import { useOptionalColorContext } from './context.js';
import { useFocusVisible } from './use-focus-visible.js';

export interface ThumbProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Arrow-key step as a ratio of the axis range. @default 0.01 */
  stepRatio?: number;
  /**
   * PageUp/PageDown (y axis) and Shift+Arrow step as a ratio of the axis
   * range. @default 0.1
   */
  largeStepRatio?: number;
  /**
   * Formats `aria-valuetext`. Defaults to both axes with channel names and
   * units, e.g. "Lightness 60%, Chroma 0.2".
   */
  getValueText?: (color: Color, axes: ResolvedColorAreaAxes) => string;
}

/**
 * The primary interactive selector for ColorArea.
 *
 * Thumb owns keyboard and focus semantics. Pointer interaction is handled by
 * the root ColorArea, which focuses the thumb on pointerdown.
 *
 * Semantics: a single focusable `role="slider"` with
 * `aria-roledescription="2D slider"`. `aria-valuenow`/`min`/`max` describe the
 * x axis (a slider exposes one numeric value), while `aria-valuetext`
 * announces both axes.
 *
 * Keyboard: Arrow keys step x/y by `stepRatio` (Shift: `largeStepRatio`),
 * PageUp/PageDown step y by `largeStepRatio`, Home/End jump x to its range
 * ends. Hue axes wrap around.
 */
export const Thumb = forwardRef<HTMLDivElement, ThumbProps>(function Thumb(
  {
    stepRatio = 0.01,
    largeStepRatio = 0.1,
    getValueText,
    onKeyDown,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
    style,
    children,
    ...props
  },
  ref,
) {
  const { requested, setRequested, axes, disabled } = useColorAreaContext();
  const colorContext = useOptionalColorContext();
  const contextState = useColorStoreSelector(
    colorContext?.store ?? null,
    (state) => state,
  );
  const [thumbNode, setThumbNode] = useState<HTMLDivElement | null>(null);
  const setThumbRef = useCallback(
    (node: HTMLDivElement | null) => {
      setThumbNode(node);
      const detachForwarded = assignRef(ref, node);
      return () => {
        setThumbNode(null);
        detachForwarded();
      };
    },
    [ref],
  );
  const { focusVisible, onFocus, onBlur, markKeyboardInteraction } =
    useFocusVisible<HTMLDivElement>(thumbNode, onFocusProp, onBlurProp);

  const { x: xNorm, y: yNorm } = getColorAreaThumbPosition(requested, axes);
  const state =
    contextState ??
    createColorState(requested, {
      activeGamut: 'display-p3',
      source: 'programmatic',
    });
  const displayed = getActiveDisplayedColor(state);
  const displayStyles = getColorDisplayStyles(
    displayed,
    state.displayed.srgb,
    state.activeGamut,
  );
  const activeGamutKey = state.activeGamut === 'display-p3' ? 'p3' : 'srgb';
  const xRange = axes.x.range;
  const valueText =
    props['aria-valuetext'] ??
    (getValueText
      ? getValueText(requested, axes)
      : getColorAreaValueText(requested, axes));

  return (
    <div
      {...props}
      ref={setThumbRef}
      data-color-area-thumb=""
      data-gamut={state.activeGamut}
      data-out-of-gamut={state.meta.outOfGamut[activeGamutKey] || undefined}
      data-disabled={disabled || undefined}
      data-focus-visible={focusVisible || undefined}
      data-x={xNorm.toFixed(4)}
      data-y={yNorm.toFixed(4)}
      role={props.role ?? 'slider'}
      aria-roledescription={props['aria-roledescription'] ?? '2D slider'}
      aria-label={props['aria-label'] ?? 'Color area'}
      aria-valuenow={requested[axes.x.channel]}
      aria-valuemin={Math.min(xRange[0], xRange[1])}
      aria-valuemax={Math.max(xRange[0], xRange[1])}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : (props.tabIndex ?? 0)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        markKeyboardInteraction(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        const ratio = event.shiftKey ? largeStepRatio : stepRatio;
        const next = colorFromColorAreaKey(requested, axes, event.key, ratio, {
          largeStepRatio,
        });
        if (!next) {
          return;
        }

        event.preventDefault();
        const axis = getColorAreaKeyAxis(event.key);

        setRequested(next, {
          interaction: 'keyboard',
          changedChannel: axis ? axes[axis].channel : undefined,
        });
      }}
      style={{
        position: 'absolute',
        left: `${xNorm * 100}%`,
        top: `${yNorm * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 2147483647,
        touchAction: 'none',
        ...displayStyles,
        ...style,
      }}
    >
      {children}
    </div>
  );
});
