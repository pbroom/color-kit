import { SegmentedOptions } from '../docs-properties-panel-controls.js';
import { useDocsInspector } from '../docs-inspector-context.js';

export function ColorSliderPropertiesPanel() {
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
