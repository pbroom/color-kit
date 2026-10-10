import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { toCss, type Color } from 'color-kit';
import {
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  createPointerDragController,
  getColorAreaThumbPosition,
  getColorAreaValueText,
  normalizeColorAreaPointer,
  resolveColorAreaAxes,
  type ColorAreaAxes,
} from 'color-kit/driver';
import {
  useAdaptiveQuality,
  useColor,
  useColorPlaneRenderer,
  useGamutBoundary,
  type ColorPlaneQualityLevel,
  type SetRequestedOptions,
} from 'color-kit/react';

/** What an overlay needs to query the plane the canvas paints. */
export interface PlaneOverlayProps {
  color: Color;
  axes: ColorAreaAxes;
  isDragging: boolean;
  quality: ColorPlaneQualityLevel;
}

export interface PlanePickerProps {
  color: Color;
  /** Color the thumb is painted with, usually the state's `displayed`. */
  displayed?: Color;
  onChange: (color: Color, options?: SetRequestedOptions) => void;
  label: string;
  axes?: ColorAreaAxes;
  disabled?: boolean;
  className?: string;
  /** SVG drawn over the canvas in a `0 0 100 100` viewBox. */
  children?: (plane: PlaneOverlayProps) => ReactNode;
}

type Pointer = { clientX: number; clientY: number };

const LC_AXES: ColorAreaAxes = {
  x: { channel: 'l' },
  y: { channel: 'c', range: [0, 0.37] },
};

/**
 * A 2D picker built from plain elements: a canvas the plane renderer
 * paints, an SVG for overlays, and a thumb. Pointer and keyboard input go
 * through the driver; the hooks only compute.
 */
export function PlanePicker({
  color,
  displayed = color,
  onChange,
  label,
  axes = LC_AXES,
  disabled = false,
  className = '',
  children,
}: PlanePickerProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const lastFrame = useRef(0);
  // The pointer that started the drag; other contacts are ignored.
  const activePointer = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Disabling mid-drag ends the drag (the controller is cancelled below).
  if (disabled && isDragging) {
    setIsDragging(false);
  }
  // Lowers raster resolution and overlay sampling while frames are slow.
  const { quality, reportFrame, reset } = useAdaptiveQuality('auto');
  const { ref: canvasRef, canvasKey } = useColorPlaneRenderer(
    { color, axes },
    { quality, isDragging },
  );

  // The driver's drag controller coalesces moves to one commit per frame.
  const [drag] = useState(() =>
    createPointerDragController<Pointer>({
      normalize: () => null,
      commit: () => {},
    }),
  );

  useEffect(() => {
    const resolved = resolveColorAreaAxes(axes);
    drag.configure({
      normalize: ({ clientX, clientY }) => {
        const rect = areaRef.current?.getBoundingClientRect();
        return rect ? normalizeColorAreaPointer(clientX, clientY, rect) : null;
      },
      commit: (point) => {
        if (disabled) return;
        const start = performance.now();
        onChange(
          colorFromColorAreaPosition(color, resolved, point.x, point.y),
          { interaction: 'pointer' },
        );
        const end = performance.now();
        reportFrame({
          updateDurationMs: end - start,
          frameTimeMs: lastFrame.current ? start - lastFrame.current : 0,
        });
        lastFrame.current = start;
      },
    });
  }, [axes, color, disabled, drag, onChange, reportFrame]);

  useEffect(() => () => drag.cancel(), [drag]);

  // Disabled: drop the pending update and the drag, so nothing changes.
  useEffect(() => {
    if (!disabled) return;
    drag.cancel();
    activePointer.current = null;
  }, [disabled, drag]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    if (activePointer.current !== null) return; // a second finger
    event.preventDefault();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    thumbRef.current?.focus({ preventScroll: true });
    reset();
    lastFrame.current = 0;
    setIsDragging(true);
    drag.start({ clientX: event.clientX, clientY: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointer.current) return;
    drag.move({ clientX: event.clientX, clientY: event.clientY });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointer.current) return;
    activePointer.current = null;
    drag.end();
    setIsDragging(false);
  };

  const resolved = resolveColorAreaAxes(axes);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    const next = colorFromColorAreaKey(color, resolved, event.key, step);
    if (!next) return;
    event.preventDefault();
    onChange(next, { interaction: 'keyboard' });
  };

  const thumb = getColorAreaThumbPosition(color, resolved);

  return (
    <div
      ref={areaRef}
      data-picker-area=""
      data-dragging={isDragging || undefined}
      className={`relative touch-none select-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <canvas
        ref={canvasRef}
        key={canvasKey}
        aria-hidden="true"
        className="absolute inset-0 size-full rounded-[inherit]"
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      >
        {children?.({ color, axes, isDragging, quality })}
      </svg>
      <div
        ref={thumbRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-roledescription="2D slider"
        aria-valuemin={Math.min(...resolved.x.range)}
        aria-valuemax={Math.max(...resolved.x.range)}
        aria-valuenow={color[resolved.x.channel]}
        aria-valuetext={getColorAreaValueText(color, resolved)}
        aria-disabled={disabled || undefined}
        data-picker-thumb=""
        data-x={thumb.x.toFixed(4)}
        data-y={thumb.y.toFixed(4)}
        onKeyDown={onKeyDown}
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)]"
        style={{
          left: `${thumb.x * 100}%`,
          top: `${thumb.y * 100}%`,
          background: toCss(displayed, 'oklch'),
        }}
      />
    </div>
  );
}

/** Dashed: the sRGB edge. Solid: the Display P3 edge. */
function GamutEdges({ color, axes, isDragging, quality }: PlaneOverlayProps) {
  const query = { isDragging, quality };
  const srgb = useGamutBoundary({ color, axes }, { gamut: 'srgb', ...query });
  const p3 = useGamutBoundary(
    { color, axes },
    { gamut: 'display-p3', ...query },
  );
  return (
    <g fill="none" stroke="#fff" strokeWidth={1.5}>
      <path
        d={srgb.path}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      <path d={p3.path} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export default function PlanePickerExample() {
  const {
    requested,
    displayed,
    setRequested,
    requestedCss,
    displayedCss,
    state,
  } = useColor({ defaultColor: 'oklch(0.66 0.24 268)' });
  return (
    <div className="grid max-w-96 gap-4">
      <PlanePicker
        color={requested}
        displayed={displayed}
        onChange={setRequested}
        label="Lightness and chroma"
        className="aspect-[4/3] w-full rounded-md"
      >
        {(plane) => <GamutEdges {...plane} />}
      </PlanePicker>
      <dl className="grid grid-cols-[9ch_1fr] gap-x-3 gap-y-1 [font-family:var(--font-mono)] text-[12px]">
        <dt className="text-muted-foreground">requested</dt>
        <dd>{requestedCss('oklch')}</dd>
        <dt className="text-muted-foreground">displayed</dt>
        <dd>{displayedCss('oklch')}</dd>
        <dt className="text-muted-foreground">in sRGB</dt>
        <dd>{state.meta.outOfGamut.srgb ? 'no, mapped' : 'yes'}</dd>
      </dl>
    </div>
  );
}
