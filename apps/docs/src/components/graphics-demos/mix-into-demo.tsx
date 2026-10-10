import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { parse, toHex, type InterpolationSpace } from 'color-kit';
import { startMixIntoLoop } from './mix-into-loop.js';
import { DemoFrame } from './demo-frame.js';

const FROM = parse('#2563eb');
const TO = parse('#f97316');
const SPACES: InterpolationSpace[] = ['oklch', 'linear-srgb'];

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION).matches
  );
}

export default function MixIntoDemo() {
  const [space, setSpace] = useState<InterpolationSpace>('oklch');
  // Live OS setting: updates when the user toggles reduced motion.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  // A Play/Pause click only applies under the reduced-motion setting it was
  // made in; changing the setting falls back to its default.
  const [choice, setChoice] = useState<{
    playing: boolean;
    reducedMotion: boolean;
  } | null>(null);
  const playing =
    choice && choice.reducedMotion === reducedMotion
      ? choice.playing
      : !reducedMotion;
  // Without IntersectionObserver, assume visible.
  const [onScreen, setOnScreen] = useState(
    () => typeof IntersectionObserver !== 'function',
  );
  const swatchRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const hexRef = useRef<HTMLSpanElement | null>(null);

  // Pause while scrolled offscreen.
  useEffect(() => {
    const node = swatchRef.current;
    if (!node || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver((entries) => {
      setOnScreen(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !onScreen) {
      return;
    }
    // Per-frame work writes straight to the DOM; React does not re-render.
    return startMixIntoLoop(FROM, TO, space, (color, frame) => {
      const hex = toHex(color);
      if (swatchRef.current) swatchRef.current.style.background = hex;
      if (hexRef.current) hexRef.current.textContent = hex;
      if (frameRef.current) frameRef.current.textContent = String(frame);
    });
  }, [playing, onScreen, space]);

  return (
    <DemoFrame label="Live demo: mixInto(out, a, b, t) every frame">
      <div className="flex flex-wrap items-center gap-4">
        <div
          ref={swatchRef}
          className="h-20 w-40 rounded-lg border border-border/60"
          style={{ background: toHex(FROM) }}
        />
        <div className="space-y-1 text-xs">
          <p>
            frame{' '}
            <span
              ref={frameRef}
              className="tabular-nums"
              data-testid="frame-count"
            >
              0
            </span>
          </p>
          <p>
            color <code ref={hexRef}>{toHex(FROM)}</code>
          </p>
          <p className="text-muted-foreground">
            One <code>out</code> object for the whole animation.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          {SPACES.map((option) => (
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
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoice({ playing: !playing, reducedMotion })}
            className="rounded-md border border-border px-2 py-1 hover:bg-accent"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    </DemoFrame>
  );
}
