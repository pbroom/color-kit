import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { DeferredMount } from '@/components/deferred-mount';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';

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

// The demos' color-kit logic lives in these files; the page shows them
// verbatim so the visible code is the code that runs.
const SOURCES = {
  'linear-mix.ts': () => import('./linear-mix.ts?highlighted'),
  'mix-into-loop.ts': () => import('./mix-into-loop.ts?highlighted'),
  'webgl-gradient.ts': () => import('./webgl-gradient.ts?highlighted'),
} as const;

export type DemoSourceFile = keyof typeof SOURCES;

function DemoSourceLoader({ file }: { file: DemoSourceFile }) {
  const [source, setSource] = useState<{ html: string; code: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void SOURCES[file]().then(({ default: html, code }) => {
      if (!cancelled) setSource({ html, code });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (source == null) {
    return <Skeleton height={160} />;
  }
  return <CodeBlock html={source.html} code={source.code} filename={file} />;
}

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

export function DemoSource({ file }: { file: DemoSourceFile }) {
  return (
    <DeferredMount minHeight={160}>
      <DemoSourceLoader file={file} />
    </DeferredMount>
  );
}
