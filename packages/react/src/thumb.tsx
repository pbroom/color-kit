import {
  forwardRef,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { ColorAreaChannel } from './api/color-area.js';
import { getColorDisplayStyles } from './api/color-display.js';
import {
  colorFromColorAreaKey,
  getColorAreaThumbPosition,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { createColorState, getActiveDisplayedColor } from './color-state.js';
import { useOptionalColorContext } from './context.js';

export interface ThumbProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Arrow-key movement step ratio of axis range. @default 0.01 */
  stepRatio?: number;
  /** Shift+arrow movement step ratio of axis range. @default 0.1 */
  shiftStepRatio?: number;
}

function getChangedChannel(
  key: string,
  xChannel: ColorAreaChannel,
  yChannel: ColorAreaChannel,
): ColorAreaChannel | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowLeft':
      return xChannel;
    case 'ArrowUp':
    case 'ArrowDown':
      return yChannel;
    default:
      return null;
  }
}

/**
 * The primary interactive selector for ColorArea.
 *
 * Thumb owns keyboard and focus semantics. Pointer interaction is handled by the root ColorArea.
 */
export const Thumb = forwardRef<HTMLDivElement, ThumbProps>(function Thumb(
  {
    stepRatio = 0.01,
    shiftStepRatio = 0.1,
    onKeyDown,
    style,
    children,
    ...props
  },
  ref,
) {
  const { requested, setRequested, axes } = useColorAreaContext();
  const colorContext = useOptionalColorContext();
  const contextState = useSelector(() => colorContext?.state$.get() ?? null);

  const { x: xNorm, y: yNorm } = getColorAreaThumbPosition(requested, axes);
  const state = useMemo(
    () =>
      contextState ??
      createColorState(requested, {
        activeGamut: 'display-p3',
        source: 'programmatic',
      }),
    [contextState, requested],
  );
  const displayed = useMemo(() => getActiveDisplayedColor(state), [state]);
  const displayStyles = useMemo(
    () =>
      getColorDisplayStyles(displayed, state.displayed.srgb, state.activeGamut),
    [displayed, state.activeGamut, state.displayed.srgb],
  );
  const activeGamutKey = state.activeGamut === 'display-p3' ? 'p3' : 'srgb';

  return (
    <div
      {...props}
      ref={ref}
      data-color-area-thumb=""
      data-gamut={state.activeGamut}
      data-out-of-gamut={state.meta.outOfGamut[activeGamutKey] || undefined}
      data-x={xNorm.toFixed(4)}
      data-y={yNorm.toFixed(4)}
      role={props.role ?? 'slider'}
      aria-label={props['aria-label'] ?? 'Color area'}
      aria-valuetext={
        props['aria-valuetext'] ??
        `${axes.x.channel}: ${requested[axes.x.channel].toFixed(4)}, ${axes.y.channel}: ${requested[
          axes.y.channel
        ].toFixed(4)}`
      }
      tabIndex={props.tabIndex ?? 0}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const ratio = event.shiftKey ? shiftStepRatio : stepRatio;
        const next = colorFromColorAreaKey(requested, axes, event.key, ratio);
        if (!next) {
          return;
        }

        event.preventDefault();
        const changedChannel = getChangedChannel(
          event.key,
          axes.x.channel,
          axes.y.channel,
        );

        setRequested(next, {
          interaction: 'keyboard',
          changedChannel: changedChannel ?? undefined,
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
