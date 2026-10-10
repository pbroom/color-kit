import {
  Component,
  useId,
  useState,
  type ComponentType,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { CodeBlock } from '@/components/ui/code-block';
import './example.css';

/** The module a `?highlighted` import produces (`import * as src from …`). */
export interface HighlightedSource {
  default: string;
  code: string;
  filename: string;
  lang?: string;
}

/**
 * `<Example of={Component} source={html} />`: a live example and the exact
 * source that runs it.
 *
 * - Examples are real files under `src/examples/<entry>/<name>.tsx` that
 *   import `color-kit/*` the way users do, default-export a component, and
 *   are type-checked (and prerender-tested) with the site.
 * - `of`: that component, rendered live inside the example frame.
 * - `source`: build-time Shiki HTML of the same file from a `?highlighted`
 *   import, either the HTML string (`import html, { code } from …`) or the
 *   whole module (`import * as source from …`), which also supplies `code`
 *   and `filename`.
 * - `code`: raw source for Copy (taken from `source` when it is a module).
 * - `filename`: tab label (taken from `source` when it is a module).
 * - `title`: accessible name and caption for the example.
 * - `minHeight`: reserved height (px) for the live area so late-mounting
 *   canvases do not shift layout.
 * - `collapseAfter`: sources longer than this many lines start collapsed
 *   behind "Show all N lines" (default 28; `false` never collapses).
 * - Examples break out to the 920 px column by default; `breakout={false}`
 *   keeps them in the prose column.
 * - Live components must be prerender-safe: no window access in render;
 *   put DOM/canvas work in effects. A component that throws in the browser
 *   is replaced by a notice; its source still shows.
 */
export interface ExampleProps {
  of: ComponentType;
  source?: string | HighlightedSource;
  code?: string;
  filename?: string;
  title?: string;
  minHeight?: number;
  breakout?: boolean;
  collapseAfter?: number | false;
}

const DEFAULT_COLLAPSE_AFTER = 28;

export function Example({
  of: Live,
  source,
  code,
  filename,
  title,
  minHeight,
  breakout = true,
  collapseAfter = DEFAULT_COLLAPSE_AFTER,
}: ExampleProps) {
  const module = typeof source === 'object' ? source : undefined;
  const html = typeof source === 'string' ? source : source?.default;
  const raw = code ?? module?.code;
  const label = filename ?? module?.filename;
  const lines = raw ? raw.split('\n').length : 0;
  const collapsible = collapseAfter !== false && lines > collapseAfter + 4;
  const [expanded, setExpanded] = useState(false);
  const sourceId = useId();
  const collapsed = collapsible && !expanded;

  return (
    <figure
      className={breakout ? 'example breakout' : 'example'}
      aria-label={title ?? label ?? 'Example'}
    >
      <div className="example__live" style={{ minHeight }}>
        <LiveBoundary>
          <Live />
        </LiveBoundary>
      </div>
      {html || raw ? (
        <div
          id={sourceId}
          className="example__source"
          data-collapsed={collapsed || undefined}
          style={
            collapsible
              ? ({ '--example-lines': collapseAfter } as CSSProperties)
              : undefined
          }
        >
          <CodeBlock html={html} code={raw} filename={label} />
          {collapsible ? (
            <button
              type="button"
              className="example__expand"
              aria-expanded={expanded}
              aria-controls={sourceId}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Show less' : `Show all ${lines} lines`}
            </button>
          ) : null}
        </div>
      ) : null}
      {title ? (
        <figcaption className="example__caption">{title}</figcaption>
      ) : null}
    </figure>
  );
}

interface LiveBoundaryState {
  error: Error | null;
}

/** Keeps a failing live example from taking the page down with it. */
class LiveBoundary extends Component<
  { children: ReactNode },
  LiveBoundaryState
> {
  state: LiveBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LiveBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Example failed to render', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="example__error" role="status">
          This example could not run here ({this.state.error.message}). Its
          source is below.
        </p>
      );
    }
    return this.props.children;
  }
}
