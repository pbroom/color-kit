import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import PlaneApiPlaygroundDemo from './plane-api-playground.demo.js';
import { DeferredMount } from './deferred-mount.js';
import {
  loadPlaneApiPlaygroundLabSource,
  loadPlaneApiPlaygroundSource,
} from './plane-api-playground.source.js';

const PlaneApiPlaygroundSandpack = lazy(
  () => import('./plane-api-playground.sandpack.js'),
);

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
      }}
    >
      <PlaneApiPlaygroundDemo />
    </div>
  );
}

function PlaneLabStaticPreview() {
  return (
    <div
      style={{
        width: 'min(100%, 560px)',
        minHeight: 640,
        border: '1px solid oklch(50% 0 0 / 0.1)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          minHeight: 640,
          gridTemplateRows: 'auto 1fr',
          background:
            'linear-gradient(180deg, rgba(12,14,18,0.98), rgba(18,20,24,0.92))',
          color: '#dbe7ff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            borderBottom: '1px solid rgba(156, 192, 255, 0.1)',
            padding: '0.9rem 1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              Validation Playground
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.72 }}>
              Deferred until the section scrolls into view.
            </div>
          </div>
          <div
            style={{
              alignSelf: 'center',
              border: '1px solid rgba(156, 192, 255, 0.12)',
              borderRadius: '999px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.72rem',
              opacity: 0.78,
            }}
          >
            contrastRegion
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)',
            padding: '1rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(156, 192, 255, 0.1)',
              borderRadius: '0.9rem',
              background:
                'radial-gradient(circle at 50% 22%, rgba(125, 211, 252, 0.16), rgba(15, 23, 42, 0.96) 62%)',
            }}
          >
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label="Validation playground preview"
              style={{ width: 'min(100%, 320px)', height: 'auto' }}
            >
              <path
                d="M 8 90 L 16 72 L 24 58 L 34 44 L 47 32 L 61 24 L 74 19 L 86 16"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.6"
                opacity="0.9"
              />
              <path
                d="M 12 88 L 20 77 L 29 67 L 39 58 L 50 48 L 61 39 L 73 31 L 86 24"
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.9"
              />
              <circle cx="50" cy="48" r="2.6" fill="#f8fafc" />
            </svg>
          </div>

          <div
            style={{ display: 'grid', gap: '0.75rem', alignContent: 'start' }}
          >
            {[
              'Trace stages',
              'Overlay sampling',
              'Path construction',
              'Editable sandbox source',
            ].map((label) => (
              <div
                key={label}
                style={{
                  border: '1px solid rgba(156, 192, 255, 0.08)',
                  borderRadius: '0.75rem',
                  background: 'rgba(17, 24, 39, 0.82)',
                  padding: '0.8rem 0.9rem',
                  fontSize: '0.8rem',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
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

function PlaneLabPlaygroundFallback() {
  return (
    <div className="flex min-h-[720px] items-center justify-center bg-card/60 p-8">
      <PlaneLabStaticPreview />
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

export function PlaneApiValidationPlayground() {
  return (
    <PlaneQuickStartPlaygroundFrame>
      <DeferredMount minHeight={720} fallback={<PlaneLabPlaygroundFallback />}>
        <Suspense fallback={<PlaneLabPlaygroundFallback />}>
          <PlaneApiPlaygroundLoader
            instanceId="validation"
            sourceLoader={loadPlaneApiPlaygroundLabSource}
            sourceFallback={<PlaneLabPlaygroundFallback />}
            appFile="/App.tsx"
            panelHeight={720}
          />
        </Suspense>
      </DeferredMount>
    </PlaneQuickStartPlaygroundFrame>
  );
}
