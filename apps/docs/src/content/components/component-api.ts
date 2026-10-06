import type { ApiTableRow } from '@/components/api-table';

interface ComponentApiDocs {
  color: ApiTableRow[];
  colorArea: ApiTableRow[];
  colorSlider: ApiTableRow[];
  colorInput: ApiTableRow[];
  colorStringInput: ApiTableRow[];
}

export const componentApiDocs: ComponentApiDocs = {
  color: [
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
      description:
        'Called synchronously inside the update that changed shared state (before React re-renders), in both controlled and uncontrolled modes. Never called for no-op updates; several updates in one tick compose.',
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
      description: 'Standalone value when not using Color context.',
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
        'Skip pointer updates when the normalized movement on both axes is not larger than this delta.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description:
        'Disables pointer and keyboard interaction. The thumb gets `aria-disabled` and leaves the tab order; root and thumb get `data-disabled`.',
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
        'Compose primitives such as Background, ColorPlane, ChromaBandLayer, GamutBoundaryLayer, ContrastRegionLayer, Thumb, Layer, Line, and Point.',
    },
    {
      name: 'Thumb.stepRatio / largeStepRatio',
      type: 'number / number',
      defaultValue: '0.01 / 0.1',
      description:
        'Keyboard steps as a ratio of the axis range. Arrows use `stepRatio`; Shift+Arrow and PageUp/PageDown use `largeStepRatio`.',
    },
    {
      name: 'Thumb.getValueText',
      type: '(color: Color, axes: ResolvedColorAreaAxes) => string',
      description:
        'Formats `aria-valuetext`. Defaults to both axes with channel names and units, e.g. "Lightness 60%, Chroma 0.2".',
    },
    {
      name: 'ColorPlane.edgeBehavior',
      type: "'transparent' | 'clamp'",
      defaultValue: "'transparent'",
      description:
        'Controls displayed-source out-of-gamut edge treatment. `transparent` keeps out-of-gamut pixels clear; `clamp` extends the gradient with nearest in-gamut edge values.',
    },
    {
      name: 'OutOfGamutLayer',
      type: '{ outOfP3FillColor?: string; outOfP3FillOpacity?: number; outOfSrgbFillColor?: string; outOfSrgbFillOpacity?: number; dotPatternOpacity?: number; dotPatternSize?: number; dotPatternGap?: number }',
      description:
        'Composable raster layer for out-of-P3/out-of-sRGB fills and optional dot pattern overlay.',
    },
    {
      name: 'ChromaBandLayer.mode',
      type: "'closest' | 'percentage'",
      defaultValue: "'closest'",
      description:
        'Band interpolation strategy. `closest` maps to clamped chroma and `percentage` maps to proportional chroma.',
    },
    {
      name: 'ContrastRegionLayer children / ContrastRegionFill',
      type: 'ReactNode / ContrastRegionFillProps',
      description:
        'Use ContrastRegionFill as a child of ContrastRegionLayer for filled region and optional dot pattern; omit children for contour lines only.',
    },
    {
      name: 'ContrastRegionLayer.lightnessSteps / chromaSteps / hybridMaxDepth / hybridErrorTolerance',
      type: 'number / number / number / number',
      defaultValue: '12 / 16 / 3 at high quality (2 medium, 1 low) / 0.003',
      description:
        'Contrast-region solver settings, tuned for interactive use: about 0.25 ms per region with fills that match the contrast check to within 0.02% of the plane on average. Steps scale with quality. The legacy samplingMode, edgeInterpolation, adaptiveBaseSteps, and adaptiveMaxDepth props were removed.',
    },
    {
      name: 'GamutBoundaryLayer.showPathPoints / pointProps',
      type: 'boolean / SVGAttributes<SVGCircleElement>',
      defaultValue: 'false / undefined',
      description:
        'Optional sampled vertex overlay for the boundary path. Useful for visualizing the exact polyline points used to build the SVG.',
    },
    {
      name: 'ContrastRegionLayer.showPathPoints / pointProps',
      type: 'boolean / SVGAttributes<SVGCircleElement>',
      defaultValue: 'false / undefined',
      description:
        'Optional sampled vertex overlay for each computed contrast contour.',
    },
    {
      name: 'GamutBoundaryLayer.points / ChromaBandLayer.points',
      type: 'LinePoint[]',
      description:
        'Optional external precomputed points (for example from Plane API) used instead of internal sampling.',
    },
    {
      name: 'ContrastRegionLayer.paths',
      type: 'ColorAreaContrastRegionPoint[][]',
      description:
        'Optional external precomputed contour paths (for example from Plane API) used instead of internal sampling.',
    },
    {
      name: 'FallbackPointsLayer.p3Point / srgbPoint',
      type: '{ x: number; y: number; color?: Color }',
      description:
        'Optional external fallback marker positions and colors for plane-driven overlays.',
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
        'Skip pointer updates when the normalized movement is not larger than this delta.',
    },
    {
      name: 'maxUpdateHz',
      type: 'number',
      defaultValue: '60',
      description:
        'Upper bound for pointer-driven updates while dragging (updates/second). Shared with ColorArea via the driver drag controller.',
    },
    {
      name: 'stepRatio / largeStepRatio',
      type: 'number / number',
      defaultValue: '0.01 / 0.1',
      description:
        'Keyboard steps as a ratio of the range. Arrows use `stepRatio`; Shift+Arrow and PageUp/PageDown use `largeStepRatio`. Home/End jump to the range ends.',
    },
    {
      name: 'wrap',
      type: 'boolean',
      defaultValue: "true for 'h', false otherwise",
      description:
        'Wrap keyboard steps around the range ends instead of clamping.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description:
        'Disables pointer and keyboard interaction, sets `aria-disabled` and `data-disabled`, and removes the slider from the tab order.',
    },
    {
      name: 'getValueText',
      type: '(value: number, channel: ColorSliderChannel) => string',
      description:
        'Formats `aria-valuetext`. Defaults to a readable value such as "Hue 213°", "Lightness 60%", or "Opacity 50%".',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using Color context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  colorInput: [
    {
      name: 'model',
      type: "'oklch' | 'rgb' | 'hsl'",
      description: 'Required channel model for numeric editing.',
    },
    {
      name: 'channel',
      type: "'l' | 'c' | 'h' | 'alpha' | 'r' | 'g' | 'b' | 's'",
      description: 'Required model channel edited by the input.',
    },
    {
      name: 'range',
      type: '[number, number]',
      description: 'Optional channel range override.',
    },
    {
      name: 'wrap',
      type: 'boolean',
      defaultValue: "model hue channels default to 'true'",
      description: 'Wraps channel values across range boundaries.',
    },
    {
      name: 'step / fineStep / coarseStep / pageStep',
      type: 'number',
      description:
        'Keyboard and scrub step controls for default, Option/Alt, Shift, and Page keys.',
    },
    {
      name: 'allowExpressions',
      type: 'boolean',
      defaultValue: 'true',
      description:
        'Enables Figma-style expression parsing (for example +10, *1.1).',
    },
    {
      name: 'commitOnBlur',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Commits the current draft on blur when valid.',
    },
    {
      name: 'scrubHandleSize / scrubPixelsPerStep / maxScrubRate',
      type: 'number',
      description: 'Controls left-edge scrubbing geometry and update cadence.',
    },
    {
      name: 'precision',
      type: 'number',
      description: 'Optional formatted output precision override.',
    },
    {
      name: 'onInvalidCommit',
      type: '(draft: string) => void',
      description: 'Called when Enter/blur commit fails validation.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using Color context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
  colorStringInput: [
    {
      name: 'format',
      type: "'hex' | 'rgb' | 'hsl' | 'oklch'",
      defaultValue: "'hex'",
      description: 'String format used for display and parsing.',
    },
    {
      name: 'onInvalidCommit',
      type: '(draft: string) => void',
      description: 'Called when Enter/blur commit receives invalid text.',
    },
    {
      name: 'requested',
      type: 'Color',
      description: 'Standalone value when not using Color context.',
    },
    {
      name: 'onChangeRequested',
      type: '(requested: Color, options?: SetRequestedOptions) => void',
      description: 'Standalone change handler when not using context.',
    },
  ],
};
