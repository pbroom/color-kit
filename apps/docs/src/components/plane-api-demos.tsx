import { lazy, Suspense, type ReactNode } from 'react';
import { planeApiQuickStartSnippet } from '@/lib/plane-api-playground-source';
import { CodeBlock } from './code-block.js';
import PlaneApiPlaygroundDemo from './plane-api-playground.demo.js';

const PlaneApiPlaygroundSandpack = lazy(
  () => import('./plane-api-playground.sandpack.js'),
);

const PLAYGROUND_WIDTH = 'min(80rem, max(100%, calc(100vw - 6rem)))';

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

function PlaneQuickStartPlaygroundFrame({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6">
      <div
        className="relative left-1/2 -translate-x-1/2 overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-xs"
        style={{ width: PLAYGROUND_WIDTH }}
      >
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

export function PlaneQuickStartSnippet() {
  return (
    <div className="not-prose my-6 rounded-xl border border-border/70 bg-card/40 p-3">
      <CodeBlock
        code={planeApiQuickStartSnippet}
        language="ts"
        className="my-0"
      />
    </div>
  );
}

export function PlaneQuickStartPlayground() {
  return (
    <PlaneQuickStartPlaygroundFrame>
      <Suspense fallback={<PlaneQuickStartPlaygroundFallback />}>
        <PlaneApiPlaygroundSandpack />
      </Suspense>
    </PlaneQuickStartPlaygroundFrame>
  );
}
