import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { CodeBlock } from '@/components/code-block';
import { DeferredMount } from '@/components/deferred-mount';
import { Skeleton } from '@/components/ui/skeleton';

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
  const fallback = (
    <Skeleton
      className="not-prose my-6 w-full rounded-xl"
      style={{ height: minHeight }}
    />
  );
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

// The demos' color-kit logic lives in these files; the page shows them
// verbatim so the visible code is the code that runs.
const SOURCES = {
  'linear-mix.ts': () => import('./linear-mix.ts?raw'),
  'mix-into-loop.ts': () => import('./mix-into-loop.ts?raw'),
  'webgl-gradient.ts': () => import('./webgl-gradient.ts?raw'),
} as const;

export type DemoSourceFile = keyof typeof SOURCES;

function DemoSourceLoader({ file }: { file: DemoSourceFile }) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void SOURCES[file]().then(({ default: text }) => {
      if (!cancelled) setSource(text.replace(/\r\n/g, '\n').trimEnd());
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (source == null) {
    return <Skeleton className="not-prose my-6 h-40 w-full rounded-lg" />;
  }
  return (
    <CodeBlock code={source} language="ts" label={`Demo source: ${file}`} />
  );
}

export function Recommendation({
  verdict,
  children,
}: {
  verdict: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-6 rounded-lg border border-l-4 border-emerald-600/30 border-l-emerald-600 bg-emerald-600/5 px-4 py-1 text-sm">
      <p className="font-semibold">Recommendation: {verdict}</p>
      {children}
    </aside>
  );
}

export function DemoSource({ file }: { file: DemoSourceFile }) {
  return (
    <DeferredMount minHeight={160}>
      <DemoSourceLoader file={file} />
    </DeferredMount>
  );
}
