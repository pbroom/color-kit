import type { ApiTableRow } from '@/components/api-table';

interface ComponentApiDocs {
  colorProvider: ApiTableRow[];
  colorArea: ApiTableRow[];
  colorSlider: ApiTableRow[];
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
      defaultValue: "{ x: { channel: 'c' }, y: { channel: 'l' } }",
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
      name: 'children',
      type: 'ReactNode',
      description:
        'Compose primitives such as Background, ColorPlane, Thumb, Layer, Line, and Point.',
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
