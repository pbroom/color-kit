import { lazy, Suspense, type ReactNode } from 'react';
import { DeferredMount } from '@/components/deferred-mount';
import { Example } from '@/components/example/example';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import * as linearMixSource from './linear-mix.ts?highlighted';
import * as mixIntoSource from './mix-into-loop.ts?highlighted';
import * as webglGradientSource from './webgl-gradient.ts?highlighted';

/**
 * Graphics and performance demos for `color-kit/interop` and the
 * allocation-free core APIs.
 *
 * In MDX, use the `*Example` components: each is an `<Example>` that runs
 * the demo (mounted when scrolled near, with its WebGL/rAF work in effects)
 * over the color-kit file it calls, so the visible code is the code that
 * runs:
 *
 * ```mdx
 * import { LinearMixExample } from '@/examples/interop/graphics';
 *
 * <LinearMixExample />
 * ```
 *
 * The bare demos, `DemoSource` and `Recommendation` remain for custom
 * layouts.
 */

function Skeleton({ height }: { height: number }) {
  return (
    <div className="demo-skeleton" style={{ height }} aria-hidden="true" />
  );
}

const LinearMixDemoImpl = lazy(() => import('./linear-mix-demo.js'));
const MixIntoDemoImpl = lazy(() => import('./mix-into-demo.js'));
const WebglGradientDemoImpl = lazy(() => import('./webgl-gradient-demo.js'));

function Lazy({
  minHeight,
  children,
}: {
  minHeight: number;
  children: ReactNode;
}) {
  const fallback = <Skeleton height={minHeight} />;
  return (
    <DeferredMount minHeight={minHeight} fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </DeferredMount>
  );
}

export function LinearMixDemo() {
  return (
    <Lazy minHeight={360}>
      <LinearMixDemoImpl />
    </Lazy>
  );
}

export function MixIntoDemo() {
  return (
    <Lazy minHeight={140}>
      <MixIntoDemoImpl />
    </Lazy>
  );
}

export function WebglGradientDemo() {
  return (
    <Lazy minHeight={260}>
      <WebglGradientDemoImpl />
    </Lazy>
  );
}

/** `mix()` across interpolation spaces, over `linear-mix.ts`. */
export function LinearMixExample() {
  return (
    <Example
      of={LinearMixDemo}
      source={linearMixSource}
      title="mix(a, b, t, options) in each interpolation space"
    />
  );
}

/** A per-frame `mixInto` loop with one reused `out`, over `mix-into-loop.ts`. */
export function MixIntoExample() {
  return (
    <Example
      of={MixIntoDemo}
      source={mixIntoSource}
      title="mixInto(out, a, b, t) on every animation frame"
    />
  );
}

/** `packColors` into WebGL2 vertex colors, over `webgl-gradient.ts`. */
export function WebglGradientExample() {
  return (
    <Example
      of={WebglGradientDemo}
      source={webglGradientSource}
      title="packColors into a WebGL2 vertex buffer"
    />
  );
}

// The demos' color-kit logic lives in these files; the page shows them
// verbatim so the visible code is the code that runs.
const SOURCES = {
  'linear-mix.ts': linearMixSource,
  'mix-into-loop.ts': mixIntoSource,
  'webgl-gradient.ts': webglGradientSource,
} as const;

export type DemoSourceFile = keyof typeof SOURCES;

export function Recommendation({
  verdict,
  children,
}: {
  verdict: string;
  children: ReactNode;
}) {
  return (
    <Callout tone="tip" title={`Recommendation: ${verdict}`}>
      {children}
    </Callout>
  );
}

/** One demo source on its own (prefer the `*Example` components). */
export function DemoSource({ file }: { file: DemoSourceFile }) {
  const source = SOURCES[file];
  return <CodeBlock html={source.default} code={source.code} filename={file} />;
}
