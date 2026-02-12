import type { ComponentType } from 'react';
import type { ApiTableRow } from '@/components/api-table';
import {
  AlphaSliderDemo,
  ColorAreaDemo,
  ColorDisplayDemo,
  ColorInputDemo,
  ColorProviderDemo,
  ColorSliderDemo,
  ColorWheelDemo,
  ContrastBadgeDemo,
  HueSliderDemo,
  SwatchDemo,
  SwatchGroupDemo,
} from '@/components/component-demos';
import { componentApiDocs } from './component-api';

export interface ComponentDocData {
  slug: string;
  title: string;
  summary: string;
  description: string;
  registryName: string;
  demo: ComponentType;
  usage: string;
  helperApis: string[];
  features: string[];
  accessibility: string[];
  props: ApiTableRow[];
  anatomy: string;
  supportsPropertiesPanel?: boolean;
}

type ComponentDocRegistry = Record<string, ComponentDocData>;

const docs: ComponentDocRegistry = {
  'color-provider': {
    slug: 'color-provider',
    title: 'Color Provider',
    summary: 'Shared state host for requested/displayed color workflows.',
    description:
      'Use ColorProvider to coordinate ColorArea, sliders, input fields, and swatches around one canonical requested color state.',
    registryName: 'color-provider',
    demo: ColorProviderDemo,
    usage: `import { ColorProvider, ColorArea, HueSlider, ColorInput } from '@color-kit/react';

export function Picker() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <ColorArea />
      <HueSlider />
      <ColorInput />
    </ColorProvider>
  );
}`,
    helperApis: ['useColor'],
    features: [
      'Single source of truth for requested and displayed color values.',
      'Controlled and uncontrolled mode support.',
      'Gamut and view metadata propagated through context.',
    ],
    accessibility: [
      'Delegates semantics to child primitives while guaranteeing shared state consistency.',
      'Works with keyboard-first control compositions.',
    ],
    props: componentApiDocs.colorProvider,
    anatomy: `<ColorProvider>\n  {children}\n</ColorProvider>`,
  },
  'color-area': {
    slug: 'color-area',
    title: 'Color Area',
    summary: 'Two-dimensional channel plane for advanced color selection.',
    description:
      'ColorArea defines a composable 2D plane where pointer interactions map to requested color intent and child primitives render layers, paths, and markers.',
    registryName: 'color-area',
    demo: ColorAreaDemo,
    usage: `import {
  Background,
  ColorArea,
  ColorPlane,
  ContrastRegionLayer,
  FallbackPointsLayer,
  GamutBoundaryLayer,
} from '@color-kit/react';

<ColorArea axes={{ x: { channel: 'l' }, y: { channel: 'c' } }}>
  <Background checkerboard />
  <ColorPlane />
  <GamutBoundaryLayer gamut="display-p3" />
  <ContrastRegionLayer threshold={4.5} />
  <FallbackPointsLayer />
</ColorArea>;`,
    helperApis: [
      'ColorApi.resolveColorAreaAxes',
      'ColorApi.resolveColorAreaRange',
      'ColorApi.getColorAreaThumbPosition',
      'ColorApi.colorFromColorAreaPosition',
      'ColorApi.colorFromColorAreaKey',
      'ColorApi.getColorAreaGamutBoundaryPoints',
      'ColorApi.getColorAreaContrastRegionPaths',
    ],
    features: [
      'Composable primitive model: ColorArea + ColorPlane + Layer wrappers + Thumb.',
      'UI-plane interaction allows out-of-gamut intent while preserving explicit realized fallbacks.',
      'Built-in wrappers for gamut boundaries, contrast regions, and fallback markers.',
    ],
    accessibility: [
      'Thumb owns slider semantics and keyboard channel movement.',
      'Layer primitives are non-interactive by default so overlays do not intercept input.',
    ],
    props: componentApiDocs.colorArea,
    anatomy: `<ColorArea>\n  <Background />\n  <ColorPlane />\n  <Thumb />\n</ColorArea>`,
    supportsPropertiesPanel: true,
  },
  'color-wheel': {
    slug: 'color-wheel',
    title: 'Color Wheel',
    summary: 'Circular hue/chroma control with requested-value geometry.',
    description:
      'ColorWheel maps angle to hue and radius to chroma while preserving requested intent and exposing displayed-gamut metadata for rendering.',
    registryName: 'color-wheel',
    demo: ColorWheelDemo,
    usage: `import { ColorWheel } from '@color-kit/react';

<ColorWheel />;`,
    helperApis: [
      'ColorApi.resolveColorWheelChromaRange',
      'ColorApi.getColorWheelThumbPosition',
      'ColorApi.normalizeColorWheelPointer',
      'ColorApi.colorFromColorWheelPosition',
      'ColorApi.colorFromColorWheelKey',
    ],
    features: [
      'Angle-driven hue and radius-driven chroma editing in one primitive.',
      'Requested geometry remains stable across gamut target changes.',
      'Standalone mode and ColorProvider context mode share the same behavior.',
    ],
    accessibility: [
      'Uses slider semantics with keyboard support for hue and chroma edits.',
      'Exposes hue/chroma state via `aria-valuetext` for assistive technologies.',
    ],
    props: componentApiDocs.colorWheel,
    anatomy: `<ColorWheel>\n  <div data-color-wheel-thumb />\n</ColorWheel>`,
  },
  'color-slider': {
    slug: 'color-slider',
    title: 'Color Slider',
    summary: 'Single-axis channel control for `l`, `c`, `h`, and `alpha`.',
    description:
      'ColorSlider is the generic primitive for horizontal or vertical channel manipulation across models.',
    registryName: 'color-slider',
    demo: ColorSliderDemo,
    usage: `import { ColorSlider } from '@color-kit/react';

<ColorSlider channel="h" />;`,
    helperApis: [
      'ColorApi.resolveColorSliderRange',
      'ColorApi.getColorSliderThumbPosition',
      'ColorApi.normalizeColorSliderPointer',
      'ColorApi.colorFromColorSliderPosition',
      'ColorApi.colorFromColorSliderKey',
    ],
    features: [
      'Orientation-aware keyboard and pointer interactions.',
      'Shared requested state contract with ColorProvider or standalone props.',
      'Customizable channel ranges for bounded workflows.',
    ],
    accessibility: [
      'Uses `role="slider"` with keyboard arrow support.',
      'Exposes current channel value through ARIA attributes.',
    ],
    props: componentApiDocs.colorSlider,
    anatomy: `<ColorSlider>\n  <div data-color-slider-thumb />\n</ColorSlider>`,
    supportsPropertiesPanel: true,
  },
  'hue-slider': {
    slug: 'hue-slider',
    title: 'Hue Slider',
    summary: 'Specialized hue channel primitive built on ColorSlider.',
    description:
      'HueSlider wraps ColorSlider with hue defaults so teams can drop in hue control quickly.',
    registryName: 'hue-slider',
    demo: HueSliderDemo,
    usage: `import { HueSlider } from '@color-kit/react';

<HueSlider />;`,
    helperApis: ['ColorApi.colorFromColorSliderPosition'],
    features: [
      'Thin wrapper around ColorSlider tuned for hue workflows.',
      'Works in standalone mode or within ColorProvider.',
      'Orientation support for compact and vertical layouts.',
    ],
    accessibility: [
      'Keyboard and pointer behavior inherited from ColorSlider.',
      'Consistent slider semantics for assistive technologies.',
    ],
    props: componentApiDocs.hueSlider,
    anatomy: `<HueSlider>\n  <div data-color-slider-thumb />\n</HueSlider>`,
  },
  'alpha-slider': {
    slug: 'alpha-slider',
    title: 'Alpha Slider',
    summary: 'Opacity channel primitive for transparent color workflows.',
    description:
      'AlphaSlider wraps ColorSlider for alpha control while preserving requested color intent.',
    registryName: 'alpha-slider',
    demo: AlphaSliderDemo,
    usage: `import { AlphaSlider } from '@color-kit/react';

<AlphaSlider />;`,
    helperApis: ['ColorApi.colorFromColorSliderPosition'],
    features: [
      'Dedicated alpha channel abstraction for readability.',
      'Composes with ColorDisplay and checkerboard surfaces.',
      'Supports horizontal and vertical layouts.',
    ],
    accessibility: [
      'Slider semantics with keyboard control inherited from ColorSlider.',
      'Clear ARIA values for opacity adjustments.',
    ],
    props: componentApiDocs.alphaSlider,
    anatomy: `<AlphaSlider>\n  <div data-color-slider-thumb />\n</AlphaSlider>`,
  },
  swatch: {
    slug: 'swatch',
    title: 'Swatch',
    summary: 'Selectable color tile primitive.',
    description:
      'Swatch renders a single color target with selected and interactive states for palette UIs.',
    registryName: 'swatch',
    demo: SwatchDemo,
    usage: `import { Swatch } from '@color-kit/react';

<Swatch color={{ l: 0.7, c: 0.18, h: 250, alpha: 1 }} />;`,
    helperApis: [],
    features: [
      'Simple interactive hook (`onSelect`) for palette logic.',
      'Selection metadata for styling and a11y states.',
      'Works with ColorProvider-driven and standalone values.',
    ],
    accessibility: [
      'Supports option/listbox usage patterns in composed collections.',
      'Selection state can be announced via `aria-selected`.',
    ],
    props: componentApiDocs.swatch,
    anatomy: `<Swatch data-swatch />`,
  },
  'swatch-group': {
    slug: 'swatch-group',
    title: 'Swatch Group',
    summary: 'Grid primitive for selectable swatch collections.',
    description:
      'SwatchGroup manages keyboard-friendly swatch collections with controlled or provider-backed selection.',
    registryName: 'swatch-group',
    demo: SwatchGroupDemo,
    usage: `import { SwatchGroup } from '@color-kit/react';

<SwatchGroup colors={[{ l: 0.8, c: 0.15, h: 120, alpha: 1 }]} />;`,
    helperApis: [],
    features: [
      'Collection-level selection with optional controlled value.',
      'Grid layout hinting through `columns`.',
      'Composable with surrounding provider state and inputs.',
    ],
    accessibility: [
      'Grid/listbox-friendly keyboard navigation patterns.',
      'Selected option state exposed for assistive tools.',
    ],
    props: componentApiDocs.swatchGroup,
    anatomy: `<SwatchGroup>\n  <Swatch />\n</SwatchGroup>`,
    supportsPropertiesPanel: true,
  },
  'color-input': {
    slug: 'color-input',
    title: 'Color Input',
    summary: 'Text input bridge for typed color formats.',
    description:
      'ColorInput maps typed values (hex/rgb/hsl/oklch) to requested state while preserving intent metadata.',
    registryName: 'color-input',
    demo: ColorInputDemo,
    usage: `import { ColorInput } from '@color-kit/react';

<ColorInput format="oklch" />;`,
    helperApis: [
      'ColorApi.formatColorInputValue',
      'ColorApi.parseColorInputValue',
    ],
    features: [
      'Supports multiple formats with deterministic parsing.',
      'Works standalone or via ColorProvider context.',
      'Great for precision entry and copy-paste workflows.',
    ],
    accessibility: [
      'Native text input semantics with full keyboard behavior.',
      'Supports explicit labeling for screen-reader clarity.',
    ],
    props: componentApiDocs.colorInput,
    anatomy: `<ColorInput />`,
    supportsPropertiesPanel: true,
  },
  'color-display': {
    slug: 'color-display',
    title: 'Color Display',
    summary: 'Rendered swatch surface for mapped output color.',
    description:
      'ColorDisplay visualizes the active displayed color with deterministic fallback behavior for sRGB and Display-P3.',
    registryName: 'color-display',
    demo: ColorDisplayDemo,
    usage: `import { ColorDisplay } from '@color-kit/react';

<ColorDisplay gamut="display-p3" />;`,
    helperApis: [
      'ColorApi.getColorDisplayStyles',
      'ColorApi.getColorDisplayHex',
    ],
    features: [
      'P3-first rendering path with sRGB-safe fallback.',
      'Standalone requested prop or provider-aware usage.',
      'Pairs with sliders and input controls for live previews.',
    ],
    accessibility: [
      'Can be annotated with labels and surrounding text to avoid color-only signals.',
      'Supports deterministic metadata for a11y descriptions.',
    ],
    props: componentApiDocs.colorDisplay,
    anatomy: `<ColorDisplay data-color-display />`,
  },
  'contrast-badge': {
    slug: 'contrast-badge',
    title: 'Contrast Badge',
    summary: 'WCAG contrast helper for foreground/background pairs.',
    description:
      'ContrastBadge evaluates contrast ratios and surfaces conformance status for AA/AAA targets.',
    registryName: 'contrast-badge',
    demo: ContrastBadgeDemo,
    usage: `import { ContrastBadge } from '@color-kit/react';

<ContrastBadge foreground={fg} background={bg} level="AA" />;`,
    helperApis: ['ColorApi.getContrastBadgeSummary'],
    features: [
      'Live contrast status for AA and AAA checks.',
      'Intended for design-tool validation surfaces.',
      'Composable with custom badges and status treatments.',
    ],
    accessibility: [
      'Emits readable pass/fail text rather than color-only indicators.',
      'Can be paired with semantic status regions for announcements.',
    ],
    props: componentApiDocs.contrastBadge,
    anatomy: `<ContrastBadge />`,
    supportsPropertiesPanel: true,
  },
};

export function getComponentDoc(slug: string): ComponentDocData | undefined {
  return docs[slug];
}
