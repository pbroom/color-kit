import type { ComponentType } from 'react';
import { CodeBlock } from './code-block';

/**
 * `<Example of={Component} source={html} />`: a live example and the exact
 * source that runs it.
 *
 * Contract (S3 builds the full version against this):
 * - Examples are real files under `src/examples/<entry>/<name>.tsx` that
 *   import `color-kit/*` the way users do, default-export a component, and
 *   are type-checked with the site.
 * - `of`: that component, rendered live inside the example frame.
 * - `source`: build-time Shiki HTML of the same file, from
 *   `import source, { code } from '@/examples/plane/hero.tsx?highlighted'`.
 *   Pass `code` too so Copy copies the raw source.
 * - `filename`: tab label; defaults to nothing.
 * - `minHeight`: reserved height (px) for the live area so late-mounting
 *   canvases do not shift layout.
 * - Examples break out to the 920 px column by default; `breakout={false}`
 *   keeps them in the prose column.
 * - Live components must be prerender-safe: no window access in render;
 *   put DOM/canvas work in effects.
 *
 * This stub renders the component and the source with no tabs or controls.
 */
export interface ExampleProps {
  of: ComponentType;
  source?: string;
  code?: string;
  filename?: string;
  title?: string;
  minHeight?: number;
  breakout?: boolean;
}

export function Example({
  of: Live,
  source,
  code,
  filename,
  title,
  minHeight,
  breakout = true,
}: ExampleProps) {
  return (
    <section
      className={breakout ? 'example breakout' : 'example'}
      aria-label={title ?? filename ?? 'Example'}
    >
      <div className="example__live" style={{ minHeight }}>
        <Live />
      </div>
      {source || code ? (
        <CodeBlock
          html={source}
          code={code}
          filename={filename}
          className="example__source"
        />
      ) : null}
    </section>
  );
}
