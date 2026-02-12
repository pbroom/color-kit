import type { ApiTableRow } from '@/components/api-table';

interface ComponentApiDocs {
  colorProvider: ApiTableRow[];
  colorArea: ApiTableRow[];
  colorWheel: ApiTableRow[];
  colorDial: ApiTableRow[];
  colorSlider: ApiTableRow[];
  hueDial: ApiTableRow[];
  hueSlider: ApiTableRow[];
  alphaSlider: ApiTableRow[];
  swatch: ApiTableRow[];
  swatchGroup: ApiTableRow[];
  colorInput: ApiTableRow[];
  colorDisplay: ApiTableRow[];
  contrastBadge: ApiTableRow[];
}

export const componentApiDocs: ComponentApiDocs = {
  colorProvider: [
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Components that should read and update shared color state.',
    },
    {
      name: 'defaultColor',
      type: 'string | Color',
      defaultValue: '"oklch(0.6 0.2 250 / 1)"',
      description: 'Initial requested color used in uncontrolled mode.',
    },
    {
      name: 'state',
      type: 'ColorState',
      description: 'Controlled requested/displayed state value.',
    },
    {
      name: 'onChange',
      type: '(event: ColorUpdateEvent) => void',
      description: 'Called every time shared state changes.',
    },
    {
      name: 'defaultGamut',
      type: "'srgb' | 'display-p3'",
      defaultValue: "'display-p3'",
      description: 'Initial display target used in uncontrolled mode.',
    },
    {
      name: 'defaultView',
      type: "'oklch' | 'oklab' | 'rgb' | 'hex' | 'hsl' | 'hsv'",
      defaultValue: "'oklch'",
      description: 'Initial view model metadata used in uncontrolled mode.',
    },
  ],
  colorArea: [
    {
      name: 'axes',
      type: "{ x: { channel: 'l' | 'c' | 'h'; range?: [number, number] }; y: { channel: 'l' | 'c' | 'h'; range?: [number, number] } }",
      defaultValue: "{ x: { channel: 'l' }, y: { channel: 'c' } }",
      description:
        'Maps horizontal and vertical movement with explicit axis descriptors.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
    {
      name: 'performanceProfile',
      type: "'auto' | 'quality' | 'balanced' | 'performance'",
      defaultValue: "'auto'",
      description:
        'Controls adaptive quality behavior and runtime prioritization during drag interactions.',
    },
    {
      name: 'maxUpdateHz',
      type: 'number',
      defaultValue: '60',
      description:
        'Upper bound for pointer-driven update cadence. Lower values reduce state churn under load.',
    },
    {
      name: 'dragEpsilon',
      type: 'number',
      defaultValue: '0.0005',
      description:
        'Minimum normalized movement delta required before committing another pointer update.',
    },
    {
      name: 'onInteractionFrame',
      type: '(stats: ColorAreaInteractionFrameStats) => void',
      description:
        'Receives per-frame interaction diagnostics (frame cost, long-task flag, adaptive quality level).',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Compose primitives such as Background, ColorPlane, Thumb, Layer, Line, and Point.',
    },
  ],
  colorWheel: [
    {
      name: 'chromaRange',
      type: '[number, number]',
      defaultValue: '[0, 0.4]',
      description:
        'Radial chroma range, where center maps to min and outer edge maps to max.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
    {
      name: 'source',
      type: "'requested' | 'displayed'",
      defaultValue: "'displayed'",
      description:
        'Visual metadata source. Geometry always follows requested state.',
    },
    {
      name: 'displayGamut',
      type: "'srgb' | 'display-p3'",
      description:
        'Display target for displayed-source metadata. Falls back to provider gamut.',
    },
    {
      name: 'maxUpdateHz',
      type: 'number',
      defaultValue: '60',
      description:
        'Upper bound for pointer-driven update cadence. Lower values reduce update churn.',
    },
    {
      name: 'dragEpsilon',
      type: 'number',
      defaultValue: '0.0005',
      description:
        'Minimum normalized pointer delta required before another update commits.',
    },
    {
      name: 'hueStep',
      type: 'number',
      defaultValue: '1',
      description: 'Keyboard hue step in degrees for left/right arrows.',
    },
    {
      name: 'shiftHueStep',
      type: 'number',
      defaultValue: '10',
      description: 'Keyboard hue step in degrees while Shift is held.',
    },
    {
      name: 'chromaStepRatio',
      type: 'number',
      defaultValue: '0.01',
      description:
        'Keyboard chroma step ratio (range span multiplier) for up/down arrows.',
    },
    {
      name: 'shiftChromaStepRatio',
      type: 'number',
      defaultValue: '0.1',
      description:
        'Keyboard chroma step ratio while Shift is held for larger jumps.',
    },
  ],
  colorSlider: [
    {
      name: 'channel',
      type: "'l' | 'c' | 'h' | 'alpha'",
      description: 'Required channel controlled by the slider thumb.',
    },
    {
      name: 'range',
      type: '[number, number]',
      description: 'Optional channel range override.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      defaultValue: "'horizontal'",
      description: 'Slider direction and keyboard semantics.',
    },
    {
      name: 'dragEpsilon',
      type: 'number',
      defaultValue: '0.0005',
      description:
        'Minimum normalized movement required before another pointer update is committed.',
    },
    {
      name: 'maxPointerRate',
      type: 'number',
      defaultValue: '60',
      description:
        'Upper bound for pointer update frequency while dragging (updates/second).',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  colorDial: [
    {
      name: 'channel',
      type: "'l' | 'c' | 'h' | 'alpha'",
      description: 'Required channel controlled by the radial dial.',
    },
    {
      name: 'range',
      type: '[number, number]',
      description: 'Optional channel range override.',
    },
    {
      name: 'startAngle',
      type: 'number',
      defaultValue: '-135',
      description: 'Arc start angle in degrees.',
    },
    {
      name: 'endAngle',
      type: 'number',
      defaultValue: '135',
      description: 'Arc end angle in degrees.',
    },
    {
      name: 'wrap',
      type: 'boolean',
      defaultValue: "channel === 'h'",
      description: 'Wraps values across range boundaries during keyboard edits.',
    },
    {
      name: 'maxUpdateHz',
      type: 'number',
      defaultValue: '60',
      description:
        'Upper bound for pointer-driven update cadence to reduce churn under load.',
    },
    {
      name: 'dragEpsilon',
      type: 'number',
      defaultValue: '0.0005',
      description:
        'Minimum normalized pointer delta required before committing another update.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  hueDial: [
    {
      name: 'startAngle',
      type: 'number',
      defaultValue: '0',
      description: 'Arc start angle in degrees.',
    },
    {
      name: 'endAngle',
      type: 'number',
      defaultValue: '360',
      description: 'Arc end angle in degrees.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone hue change handler when not using context.',
    },
  ],
  hueSlider: [
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      defaultValue: "'horizontal'",
      description: 'Direction for the hue track.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone hue change handler when not using context.',
    },
  ],
  alphaSlider: [
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      defaultValue: "'horizontal'",
      description: 'Direction for the alpha track.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone opacity change handler when not using context.',
    },
  ],
  swatch: [
    {
      name: 'color',
      type: 'Color',
      description: 'Required swatch color value.',
    },
    {
      name: 'isSelected',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Marks this swatch as selected for styling and a11y.',
    },
    {
      name: 'onSelect',
      type: '(color: Color) => void',
      description: 'Makes the swatch interactive when provided.',
    },
  ],
  swatchGroup: [
    {
      name: 'colors',
      type: 'Color[]',
      description: 'Required collection of swatch values.',
    },
    {
      name: 'value',
      type: 'Color',
      description: 'Controlled selected value.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
      description: 'Controlled selection handler.',
    },
    {
      name: 'columns',
      type: 'number',
      description: 'Optional grid hint via the --columns CSS custom property.',
    },
  ],
  colorInput: [
    {
      name: 'format',
      type: "'hex' | 'rgb' | 'hsl' | 'oklch'",
      defaultValue: "'hex'",
      description: 'String format used for display and parsing.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  colorDisplay: [
    {
      name: 'requested',
      type: 'Color',
      description:
        'Standalone requested value when not using ColorProvider context.',
    },
    {
      name: 'gamut',
      type: "'srgb' | 'display-p3'",
      defaultValue: "'display-p3'",
      description: 'Display target used in standalone mode.',
    },
  ],
  contrastBadge: [
    {
      name: 'foreground',
      type: 'Color',
      description: 'Required text/foreground color.',
    },
    {
      name: 'background',
      type: 'Color',
      description: 'Required background color.',
    },
    {
      name: 'level',
      type: "'AA' | 'AAA'",
      defaultValue: "'AA'",
      description: 'Conformance level used for pass/fail state.',
    },
  ],
};
