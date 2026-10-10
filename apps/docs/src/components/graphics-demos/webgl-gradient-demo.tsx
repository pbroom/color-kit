import { useEffect, useRef, useState } from 'react';
import { packColors, parse } from 'color-kit';
import {
  createGradientRenderer,
  watchContextLoss,
  type GradientRenderer,
  type VertexColorSpace,
} from './webgl-gradient.js';
import { DemoFrame } from './demo-frame.js';

const CORNER_LABELS = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
const DEFAULT_CORNERS = ['#ff0000', '#00ff00', '#0000ff', '#ffffff'];

function detectWebgl2(): boolean {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return gl != null;
}

export default function WebglGradientDemo() {
  const [supported] = useState(detectWebgl2);
  const [corners, setCorners] = useState(DEFAULT_CORNERS);
  const [space, setSpace] = useState<VertexColorSpace>('linearSrgb');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GradientRenderer | null>(null);

  // Bumped on webglcontextrestored so the renderer is rebuilt and redrawn.
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return watchContextLoss(
      canvas,
      () => {
        // The old GL objects are gone; stop drawing until restore.
        rendererRef.current = null;
      },
      () => setContextVersion((version) => version + 1),
    );
  }, []);

  useEffect(() => {
    const gl = canvasRef.current?.getContext('webgl2');
    if (!gl || gl.isContextLost()) return;
    const renderer = createGradientRenderer(gl);
    rendererRef.current = renderer;
    return () => {
      // A renderer from a lost context owns nothing; only free live ones.
      if (rendererRef.current !== renderer) return;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [contextVersion]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.draw(
      corners.map((hex) => parse(hex)),
      space,
    );
  }, [corners, space, contextVersion]);

  // Same call the renderer makes, rendered here so the floats are visible.
  const packed = packColors(
    corners.map((hex) => parse(hex)),
    space,
    new Float32Array(corners.length * 3),
    { clamp: true },
  );

  if (!supported) {
    return (
      <DemoFrame label="Live demo: packColors → WebGL2 vertex colors">
        <p className="text-sm text-muted-foreground">
          WebGL2 is not available in this browser, so the live canvas is hidden.
          The code below still shows the full recipe.
        </p>
      </DemoFrame>
    );
  }

  return (
    <DemoFrame label="Live demo: packColors → WebGL2 vertex colors">
      <div className="flex flex-wrap gap-4">
        <canvas
          ref={canvasRef}
          width={320}
          height={200}
          className="h-[200px] w-[320px] max-w-full rounded-lg border border-border/60"
          aria-label="Four-corner gradient rendered with WebGL2"
        />
        <div className="min-w-[200px] flex-1 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {corners.map((hex, index) => (
              <label
                key={CORNER_LABELS[index]}
                className="flex items-center gap-2"
              >
                <input
                  type="color"
                  aria-label={`${CORNER_LABELS[index]} color`}
                  value={hex}
                  onChange={(event) => {
                    const next = [...corners];
                    next[index] = event.target.value;
                    setCorners(next);
                  }}
                  className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
                />
                <span className="text-muted-foreground">
                  {CORNER_LABELS[index]}
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['linearSrgb', 'srgb'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={space === option}
                onClick={() => setSpace(option)}
                className={
                  space === option
                    ? 'rounded-md border border-foreground/40 bg-accent px-2 py-1 font-medium'
                    : 'rounded-md border border-border px-2 py-1 hover:bg-accent'
                }
              >
                {option === 'linearSrgb'
                  ? "'linearSrgb' + shader encode"
                  : "'srgb' (gamma-space blend)"}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1 text-muted-foreground">
              Float32Array sent to the GPU (4 vertices × rgb)
            </p>
            <pre
              className="m-0 overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-[11px] leading-relaxed"
              data-testid="packed-floats"
            >
              {[0, 1, 2, 3]
                .map((vertex) =>
                  Array.from(packed.subarray(vertex * 3, vertex * 3 + 3))
                    .map((value) => value.toFixed(4))
                    .join(', '),
                )
                .join('\n')}
            </pre>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
