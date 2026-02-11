import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
} from 'react';
import type { ColorAreaChannel } from './api/color-area.js';
import {
  colorFromColorAreaKey,
  getColorAreaThumbPosition,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';

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

  const { x: xNorm, y: yNorm } = getColorAreaThumbPosition(requested, axes);

  const onThumbKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
    },
    [onKeyDown, requested, axes, setRequested, shiftStepRatio, stepRatio],
  );

  return (
    <div
      {...props}
      ref={ref}
      data-color-area-thumb=""
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
      onKeyDown={onThumbKeyDown}
      style={{
        position: 'absolute',
        left: `${xNorm * 100}%`,
        top: `${yNorm * 100}%`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
});
