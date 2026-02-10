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
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div className="docs-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={`${label}: ${option.label}`}
          aria-pressed={value === option.value}
          className={value === option.value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorAreaPropertiesPanel() {
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
          aria-label="Select color area demo scenario"
        >
          {colorAreaDemos.map((demo) => (
            <option key={demo.id} value={demo.id}>
              {demo.label}
            </option>
          ))}
        </select>
        <div className="docs-demo-pagination">
          <button
            type="button"
            onClick={() => cycleColorAreaDemo(-1)}
            aria-label="Previous color area scenario"
          >
            &lt;
          </button>
          <span>
            {selectedDemoIndex + 1}/{colorAreaDemos.length}
          </span>
          <button
            type="button"
            onClick={() => cycleColorAreaDemo(1)}
            aria-label="Next color area scenario"
          >
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
          label="Color area gamut"
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
          label="Color area x axis"
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
          label="Color area y axis"
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

function ColorSliderPropertiesPanel() {
  const { colorSliderState, setColorSliderState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Channel</h4>
        <SegmentedOptions
          value={colorSliderState.channel}
          onChange={(channel) => setColorSliderState({ channel })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
            { value: 'alpha', label: 'A' },
          ]}
          label="Color slider channel"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Output gamut</h4>
        <SegmentedOptions
          value={colorSliderState.gamut}
          onChange={(gamut) => setColorSliderState({ gamut })}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
          label="Color slider gamut"
        />
      </section>
    </div>
  );
}

function ColorInputPropertiesPanel() {
  const { colorInputState, setColorInputState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Input format</h4>
        <SegmentedOptions
          value={colorInputState.format}
          onChange={(format) => setColorInputState({ format })}
          options={[
            { value: 'hex', label: 'hex' },
            { value: 'rgb', label: 'rgb' },
            { value: 'hsl', label: 'hsl' },
            { value: 'oklch', label: 'oklch' },
          ]}
          label="Color input format"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Output gamut</h4>
        <SegmentedOptions
          value={colorInputState.gamut}
          onChange={(gamut) => setColorInputState({ gamut })}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
          label="Color input gamut"
        />
      </section>
    </div>
  );
}

function SwatchGroupPropertiesPanel() {
  const { swatchGroupState, setSwatchGroupState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Palette</h4>
        <SegmentedOptions
          value={swatchGroupState.palette}
          onChange={(palette) => setSwatchGroupState({ palette })}
          options={[
            { value: 'spectrum', label: 'Spectrum' },
            { value: 'nature', label: 'Nature' },
            { value: 'neon', label: 'Neon' },
          ]}
          label="Swatch group palette"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Columns</h4>
        <SegmentedOptions
          value={String(swatchGroupState.columns)}
          onChange={(columns) =>
            setSwatchGroupState({ columns: Number(columns) as 3 | 4 | 5 })
          }
          options={[
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' },
          ]}
          label="Swatch group columns"
        />
      </section>
    </div>
  );
}

function ContrastBadgePropertiesPanel() {
  const { contrastBadgeState, setContrastBadgeState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Preset</h4>
        <SegmentedOptions
          value={contrastBadgeState.preset}
          onChange={(preset) => setContrastBadgeState({ preset })}
          options={[
            { value: 'interface', label: 'Interface' },
            { value: 'editorial', label: 'Editorial' },
            { value: 'alert', label: 'Alert' },
          ]}
          label="Contrast badge color preset"
        />
      </section>

      <section className="docs-properties-group">
        <h4>WCAG level</h4>
        <SegmentedOptions
          value={contrastBadgeState.level}
          onChange={(level) => setContrastBadgeState({ level })}
          options={[
            { value: 'AA', label: 'AA' },
            { value: 'AAA', label: 'AAA' },
          ]}
          label="Contrast badge level"
        />
      </section>
    </div>
  );
}

const PROPERTIES_PANELS = {
  '/docs/components/color-area': ColorAreaPropertiesPanel,
  '/docs/components/color-slider': ColorSliderPropertiesPanel,
  '/docs/components/color-input': ColorInputPropertiesPanel,
  '/docs/components/swatch-group': SwatchGroupPropertiesPanel,
  '/docs/components/contrast-badge': ContrastBadgePropertiesPanel,
} as const;

export function DocsRightRail({ headings }: { headings: DocsHeading[] }) {
  const { pathname } = useLocation();
  const { activeTab, setActiveTab } = useDocsInspector();
  const PropertiesPanel =
    PROPERTIES_PANELS[pathname as keyof typeof PROPERTIES_PANELS];

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
      ) : PropertiesPanel ? (
        <PropertiesPanel />
      ) : (
        <p className="docs-right-empty">
          No live demo controls are available for this page yet.
        </p>
      )}
    </aside>
  );
}
