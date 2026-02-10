import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { useDocsInspector } from './docs-inspector-context.js';

export interface DocsHeading {
  id: string;
  title: string;
  level: 2 | 3;
}

function OutlinePanel({ headings }: { headings: DocsHeading[] }) {
  if (headings.length === 0) {
    return (
      <p className="docs-right-empty">
        This page does not expose section headings yet.
      </p>
    );
  }

  return (
    <nav className="docs-outline-nav" aria-label="On this page">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={
            heading.level === 3
              ? 'docs-outline-link nested'
              : 'docs-outline-link'
          }
        >
          {heading.title}
        </a>
      ))}
    </nav>
  );
}

function SegmentedOptions<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="docs-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PropertiesPanel() {
  const {
    colorAreaState,
    colorAreaDemos,
    setColorAreaState,
    cycleColorAreaDemo,
  } = useDocsInspector();

  const selectedDemoIndex = useMemo(
    () =>
      colorAreaDemos.findIndex(
        (entry) => entry.id === colorAreaState.selectedDemo,
      ),
    [colorAreaDemos, colorAreaState.selectedDemo],
  );

  return (
    <div className="docs-properties-panel">
      <div className="docs-properties-demo-row">
        <select
          value={colorAreaState.selectedDemo}
          onChange={(event) =>
            setColorAreaState({
              selectedDemo: event.target
                .value as (typeof colorAreaDemos)[number]['id'],
            })
          }
          aria-label="Select demo scenario"
        >
          {colorAreaDemos.map((demo) => (
            <option key={demo.id} value={demo.id}>
              {demo.label}
            </option>
          ))}
        </select>
        <div className="docs-demo-pagination">
          <button type="button" onClick={() => cycleColorAreaDemo(-1)}>
            &lt;
          </button>
          <span>
            {selectedDemoIndex + 1}/{colorAreaDemos.length}
          </span>
          <button type="button" onClick={() => cycleColorAreaDemo(1)}>
            &gt;
          </button>
        </div>
      </div>

      <section className="docs-properties-group">
        <h4>Gamut</h4>
        <SegmentedOptions
          value={colorAreaState.gamut}
          onChange={(gamut) => setColorAreaState({ gamut })}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
        />
      </section>

      <section className="docs-properties-group">
        <h4>Axes</h4>
        <label className="docs-properties-label">x axis</label>
        <SegmentedOptions
          value={colorAreaState.xAxis}
          onChange={(xAxis) => setColorAreaState({ xAxis })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
          ]}
        />
        <label className="docs-properties-label">y axis</label>
        <SegmentedOptions
          value={colorAreaState.yAxis}
          onChange={(yAxis) => setColorAreaState({ yAxis })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
          ]}
        />
      </section>

      <section className="docs-properties-group">
        <h4>Visualize</h4>
        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.showCheckerboard}
            onChange={(event) =>
              setColorAreaState({ showCheckerboard: event.target.checked })
            }
          />
          Checkerboard
        </label>
        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.showP3Boundary}
            onChange={(event) =>
              setColorAreaState({ showP3Boundary: event.target.checked })
            }
          />
          P3 boundary
        </label>
        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.showSrgbBoundary}
            onChange={(event) =>
              setColorAreaState({ showSrgbBoundary: event.target.checked })
            }
          />
          sRGB boundary
        </label>
        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.showContrastRegion}
            onChange={(event) =>
              setColorAreaState({ showContrastRegion: event.target.checked })
            }
          />
          4.5:1 contrast region
        </label>
      </section>
    </div>
  );
}

export function DocsRightRail({ headings }: { headings: DocsHeading[] }) {
  const { pathname } = useLocation();
  const { activeTab, setActiveTab } = useDocsInspector();
  const supportsProperties = pathname === '/docs/components/color-area';

  return (
    <aside className="docs-right-rail">
      <div
        className="docs-right-tabs"
        role="tablist"
        aria-label="Docs side panels"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'outline'}
          className={activeTab === 'outline' ? 'is-active' : undefined}
          onClick={() => setActiveTab('outline')}
        >
          On this page
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'properties'}
          className={activeTab === 'properties' ? 'is-active' : undefined}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
      </div>

      {activeTab === 'outline' ? (
        <OutlinePanel headings={headings} />
      ) : supportsProperties ? (
        <PropertiesPanel />
      ) : (
        <p className="docs-right-empty">
          No live demo controls are available for this page yet.
        </p>
      )}
    </aside>
  );
}
