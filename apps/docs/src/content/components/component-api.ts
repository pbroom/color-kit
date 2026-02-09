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
      description: 'Initial value used in uncontrolled mode.',
    },
    {
      name: 'color',
      type: 'Color',
      description: 'Controlled color value for external state management.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
      description: 'Called every time shared color state changes.',
    },
  ],
  colorArea: [
    {
      name: 'channels',
      type: "{ x: 'l' | 'c' | 'h'; y: 'l' | 'c' | 'h' }",
      defaultValue: "{ x: 'c', y: 'l' }",
      description: 'Maps horizontal and vertical movement to OKLCH channels.',
    },
    {
      name: 'xRange',
      type: '[number, number]',
      description: 'Optional channel range override for the X axis.',
    },
    {
      name: 'yRange',
      type: '[number, number]',
      description: 'Optional channel range override for the Y axis.',
    },
    {
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
      description: 'Standalone change handler when not using context.',
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
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
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
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
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
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
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
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
    },
    {
      name: 'onChange',
      type: '(color: Color) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  colorDisplay: [
    {
      name: 'color',
      type: 'Color',
      description: 'Standalone value when not using ColorProvider context.',
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
