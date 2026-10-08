import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { HueQuery } from '@/examples/plane/hero';
import initialFrame from './initial-frame.ts?build';
import './hero.css';

type Engine = typeof import('@/examples/plane/hero');

/** Prerendered at build time; identical on the server and the client. */
const INITIAL = initialFrame as HueQuery;
/** Canvas cells per side: coarse on purpose, smoothed by CSS scaling. */
const GRID = 160;
/** Degrees of hue per plane width when dragging. */
const DRAG_DEGREES = 180;

const C_TICKS = [0, 0.1, 0.2, 0.3, 0.4];
const L_TICKS = [1, 0.75, 0.5, 0.25, 0];

let enginePromise: Promise<Engine> | null = null;

/** `color-kit/plane` and the painter, loaded once after hydration. */
function loadEngine(): Promise<Engine> {
  enginePromise ??= import('@/examples/plane/hero').catch((error: unknown) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

interface PaintTarget {
  context: CanvasRenderingContext2D;
  image: ImageData;
  colorSpace: PredefinedColorSpace;
}

/** A 2D context in Display P3 where the browser supports it, else sRGB. */
function createPaintTarget(canvas: HTMLCanvasElement): PaintTarget | null {
  const context =
    canvas.getContext('2d', { colorSpace: 'display-p3' }) ??
    canvas.getContext('2d');
  if (!context) return null;
  const colorSpace: PredefinedColorSpace =
    context.getContextAttributes?.().colorSpace ?? 'srgb';
  const image = context.createImageData(GRID, GRID, { colorSpace });
  return { context, image, colorSpace };
}

interface FrameStats {
  ms: number;
  colorSpace: PredefinedColorSpace;
}

const wrapHue = (hue: number) => ((Math.round(hue) % 360) + 360) % 360;
const fmt = (value: number, digits: number) => value.toFixed(digits);

/**
 * The home hero: one hue slice of OKLCH, queried live. The SVG overlay is
 * the plane's answers (sRGB region, Display P3 boundary, WCAG AA regions on
 * white and on black); the canvas underneath paints the slice's colors.
 * Theme picks the contrast reference in CSS, so no branch runs in React.
 */
export function PlaneHero() {
  const [hue, setHue] = useState(INITIAL.hue);
  const [frame, setFrame] = useState<HueQuery>(INITIAL);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<PaintTarget | null>(null);
  const dragRef = useRef<{ x: number; hue: number; width: number } | null>(
    null,
  );
  const ids = useId();
  const summaryId = `${ids}-summary`;
  const hatchId = `${ids}-hatch`;
  const clipId = `${ids}-srgb`;
  const sliderId = `${ids}-hue`;

  useEffect(() => {
    let live = true;
    void loadEngine().then(
      (module) => {
        if (live) setEngine(module);
      },
      () => {
        if (live) setLoadFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // At most one query + paint per animation frame, for the latest hue.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const handle = requestAnimationFrame(() => {
      targetRef.current ??= createPaintTarget(canvas);
      const target = targetRef.current;
      const start = performance.now();
      const next = engine.queryHue(hue);
      if (target) {
        engine.paintPlane(target.image, engine.hueSlice(hue));
        target.context.putImageData(target.image, 0, 0);
      }
      const ms = performance.now() - start;
      performance.measure?.('hero-frame', { start, duration: ms });
      setFrame(next);
      setStats({ ms, colorSpace: target?.colorSpace ?? 'srgb' });
    });
    return () => cancelAnimationFrame(handle);
  }, [engine, hue]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!engine || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      hue,
      width: event.currentTarget.clientWidth,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = ((event.clientX - drag.x) / drag.width) * DRAG_DEGREES;
    setHue(wrapHue(drag.hue + delta));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const { srgbPeak, p3Peak, onWhite, onBlack } = frame;
  const at = `At hue ${frame.hue}°`;

  return (
    <figure className="hero" aria-label="Live OKLCH plane">
      <div className="hero__plot">
        <p className="hero__axis-title hero__axis-title--y" aria-hidden="true">
          <b>L</b> lightness
        </p>
        <div className="hero__axis hero__axis--y" aria-hidden="true">
          {L_TICKS.map((tick) => (
            <span
              key={tick}
              className="hero__tick"
              style={{ top: `${(1 - tick) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <div
          className="hero__plane"
          data-loaded={stats ? '' : undefined}
          data-color-space={stats?.colorSpace}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <canvas
            ref={canvasRef}
            className="hero__canvas"
            width={GRID}
            height={GRID}
            aria-hidden="true"
          />
          <svg
            className="hero__svg"
            viewBox="0 0 100 100"
            role="img"
            aria-labelledby={summaryId}
          >
            <defs>
              <pattern
                id={hatchId}
                width="1.6"
                height="1.6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line className="hero__hatch" x1="0" y1="0" x2="0" y2="1.6" />
              </pattern>
              <clipPath id={clipId}>
                <path d={frame.srgb} />
              </clipPath>
            </defs>
            <g className="hero__aa" data-reference="white">
              <title>WCAG AA (4.5:1) as text on white</title>
              <path
                className="hero__aa-area"
                d={onWhite.area}
                fill={`url(#${hatchId})`}
                clipPath={`url(#${clipId})`}
              />
              <path className="hero__halo" d={onWhite.line} />
              <path className="hero__aa-line" d={onWhite.line} />
            </g>
            <g className="hero__aa" data-reference="black">
              <title>WCAG AA (4.5:1) as text on black</title>
              <path
                className="hero__aa-area"
                d={onBlack.area}
                fill={`url(#${hatchId})`}
                clipPath={`url(#${clipId})`}
              />
              <path className="hero__halo" d={onBlack.line} />
              <path className="hero__aa-line" d={onBlack.line} />
            </g>
            <g>
              <title>sRGB gamut</title>
              <path className="hero__halo" d={frame.srgb} />
              <path className="hero__srgb" d={frame.srgb} />
            </g>
            <g>
              <title>Display P3 gamut boundary</title>
              <path className="hero__halo" d={frame.p3} />
              <path className="hero__p3" d={frame.p3} />
            </g>
          </svg>
        </div>
        <div className="hero__axis hero__axis--x" aria-hidden="true">
          {C_TICKS.map((tick) => (
            <span
              key={tick}
              className="hero__tick"
              style={{ left: `${(tick / 0.4) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <p className="hero__axis-title hero__axis-title--x" aria-hidden="true">
          chroma <b>C</b>
        </p>
      </div>

      <p id={summaryId} className="visually-hidden">
        {at}, sRGB reaches chroma {fmt(srgbPeak.c, 3)} at lightness{' '}
        {fmt(srgbPeak.l, 2)} and Display P3 reaches {fmt(p3Peak.c, 3)} at{' '}
        {fmt(p3Peak.l, 2)}.{' '}
        <span data-reference="white">
          The AA region against white spans lightness 0 to{' '}
          {fmt(onWhite.grayL ?? 0, 2)} for grays.
        </span>
        <span data-reference="black">
          The AA region against black spans lightness{' '}
          {fmt(onBlack.grayL ?? 1, 2)} to 1 for grays.
        </span>
      </p>

      <div className="hero__panel">
        <div className="hero__control">
          <label htmlFor={sliderId} className="hero__label">
            Hue
          </label>
          <output htmlFor={sliderId} className="hero__value">
            {hue}°
          </output>
          <input
            id={sliderId}
            className="hero__slider"
            type="range"
            min={0}
            max={359}
            step={1}
            value={hue}
            disabled={!engine}
            aria-valuetext={`Hue ${hue}°`}
            onChange={(event) => setHue(Number(event.target.value))}
          />
        </div>

        <dl className="hero__legend">
          <div className="hero__key">
            <dt>
              <svg
                className="hero__glyph"
                viewBox="0 0 24 12"
                aria-hidden="true"
              >
                <line className="hero__srgb" x1="1" y1="6" x2="23" y2="6" />
              </svg>
              sRGB gamut
            </dt>
            <dd>
              cusp L {fmt(srgbPeak.l, 2)} · C {fmt(srgbPeak.c, 3)}
            </dd>
          </div>
          <div className="hero__key">
            <dt>
              <svg
                className="hero__glyph"
                viewBox="0 0 24 12"
                aria-hidden="true"
              >
                <line className="hero__p3" x1="1" y1="6" x2="23" y2="6" />
              </svg>
              Display P3 boundary
            </dt>
            <dd>
              cusp L {fmt(p3Peak.l, 2)} · C {fmt(p3Peak.c, 3)}
            </dd>
          </div>
          <div className="hero__key" data-reference="white">
            <dt>
              <span
                className="hero__glyph hero__glyph--hatch"
                aria-hidden="true"
              />
              AA as text on white
            </dt>
            <dd>grays pass at L ≤ {fmt(onWhite.grayL ?? 0, 2)}</dd>
          </div>
          <div className="hero__key" data-reference="black">
            <dt>
              <span
                className="hero__glyph hero__glyph--hatch"
                aria-hidden="true"
              />
              AA as text on black
            </dt>
            <dd>grays pass at L ≥ {fmt(onBlack.grayL ?? 1, 2)}</dd>
          </div>
        </dl>

        {loadFailed ? (
          <p className="hero__stats" role="status">
            Live colors could not load. Showing hue {INITIAL.hue}°.{' '}
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload to retry
            </button>
          </p>
        ) : (
          <p className="hero__stats" aria-hidden="true">
            {stats ? (
              <>
                <span>
                  <strong>{fmt(stats.ms, 1)} ms</strong> queries + paint
                </span>
                <span>
                  <strong>{stats.colorSpace}</strong> canvas, {GRID}² cells
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong>prerendered</strong> at build time
                </span>
                <span>canvas loading</span>
              </>
            )}
          </p>
        )}
      </div>
    </figure>
  );
}
