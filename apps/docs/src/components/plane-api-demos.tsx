import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { loadPlaneApiPlaygroundSource } from './plane-api-playground.source.js';

const PlaneApiPlaygroundDemo = lazy(
  () => import('./plane-api-playground.demo.js'),
);
const PlaneApiPlaygroundSandpack = lazy(
  () => import('./plane-api-playground.sandpack.js'),
);

function PlaneDemoPreviewPlaceholder() {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Plane API preview loading"
    >
      <path
        d="M 8 90 L 16 72 L 24 58 L 34 44 L 47 32 L 61 24 L 74 19 L 86 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.55"
      />
    </svg>
  );
}

function PlaneQuickStartStaticPreview() {
  return (
    <div
      style={{
        width: 320,
        height: 320,
        maxWidth: '100%',
        border: '1px solid oklch(50% 0 0 / 0.1)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        color: '#dbe7ff',
      }}
    >
      <Suspense fallback={<PlaneDemoPreviewPlaceholder />}>
        <PlaneApiPlaygroundDemo />
      </Suspense>
    </div>
  );
}

function PlaneQuickStartPlaygroundFrame({ children }: { children: ReactNode }) {
  return (
    <div className="ck-docs-content-bleed not-prose my-6 min-w-0">
      <div className="w-full min-w-0 max-w-none overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-xs">
        {children}
      </div>
    </div>
  );
}

function PlaneQuickStartPlaygroundFallback() {
  return (
    <div className="flex min-h-[520px] items-center justify-center bg-card/60 p-8">
      <PlaneQuickStartStaticPreview />
    </div>
  );
}

function PlaneApiPlaygroundLoader({
  sourceLoader,
  sourceFallback,
  instanceId,
  appFile,
  panelHeight,
}: {
  sourceLoader: () => Promise<string>;
  sourceFallback: ReactNode;
  instanceId: string;
  appFile?: string;
  panelHeight?: number;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void sourceLoader().then((nextSource) => {
      if (!cancelled) {
        setSource(nextSource);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sourceLoader]);

  if (!source) {
    return <>{sourceFallback}</>;
  }

  return (
    <PlaneApiPlaygroundSandpack
      instanceId={instanceId}
      source={source}
      appFile={appFile}
      panelHeight={panelHeight}
    />
  );
}

export function PlaneQuickStartDemo() {
  return (
    <div className="not-prose my-6">
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid rgba(156, 192, 255, 0.05)',
          borderRadius: '0.75rem',
          background: '#141516',
          color: '#e5ecff',
          padding: '2rem',
        }}
      >
        <PlaneQuickStartStaticPreview />
      </div>
    </div>
  );
}

export function PlaneQuickStartPlayground() {
  return (
    <PlaneQuickStartPlaygroundFrame>
      <Suspense fallback={<PlaneQuickStartPlaygroundFallback />}>
        <PlaneApiPlaygroundLoader
          instanceId="quick-start"
          sourceLoader={loadPlaneApiPlaygroundSource}
          sourceFallback={<PlaneQuickStartPlaygroundFallback />}
        />
      </Suspense>
    </PlaneQuickStartPlaygroundFrame>
  );
}
