import { SegmentedOptions } from '../docs-properties-panel-controls.js';
import {
  useDocsInspector,
  type ColorInputDemoChannel,
} from '../docs-inspector-context.js';

export function ColorInputPropertiesPanel() {
  const { colorInputState, setColorInputState } = useDocsInspector();
  const channelOptions: Array<{ value: ColorInputDemoChannel; label: string }> =
    colorInputState.model === 'rgb'
      ? [
          { value: 'r', label: 'R' },
          { value: 'g', label: 'G' },
          { value: 'b', label: 'B' },
          { value: 'alpha', label: 'A' },
        ]
      : colorInputState.model === 'hsl'
        ? [
            { value: 'h', label: 'H' },
            { value: 's', label: 'S' },
            { value: 'l', label: 'L' },
            { value: 'alpha', label: 'A' },
          ]
        : [
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
            { value: 'alpha', label: 'A' },
          ];

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Input model</h4>
        <SegmentedOptions
          value={colorInputState.model}
          onChange={(model) => setColorInputState({ model })}
          options={[
            { value: 'oklch', label: 'oklch' },
            { value: 'rgb', label: 'rgb' },
            { value: 'hsl', label: 'hsl' },
          ]}
          label="Color input model"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Input channel</h4>
        <SegmentedOptions
          value={colorInputState.channel}
          onChange={(channel) => setColorInputState({ channel })}
          options={channelOptions}
          label="Color input channel"
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
