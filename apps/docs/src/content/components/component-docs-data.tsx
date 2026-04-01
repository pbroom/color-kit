import type { ComponentType } from 'react';
import type { ApiTableRow } from '@/components/api-table';
import {
  ColorAreaDemo,
  ColorInputDemo,
  ColorStringInputDemo,
  ColorProviderDemo,
  ColorSliderDemo,
} from '@/components/component-demos';
import { componentApiDocs } from './component-api';

export interface ComponentDocData {
  slug: string;
  title: string;
  summary: string;
  description: string;
  registryName: string;
  demo: ComponentType<{ inspectorDriven?: boolean }>;
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
  color: {
    slug: 'color',
    title: 'Color',
    summary: 'Shared state host for requested/displayed color workflows.',
    description:
      'Use Color to coordinate ColorArea, sliders, and input fields around one canonical requested color state.',
    registryName: 'color',
    demo: ColorProviderDemo,
    usage: `import { Color, ColorArea, ColorSlider, ColorInput } from 'color-kit/react';

export function Picker() {
  return (
    <Color defaultColor="#3b82f6">
      <ColorArea />
      <ColorSlider channel="h" />
      <ColorInput model="oklch" channel="h" />
    </Color>
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
    props: componentApiDocs.color,
    anatomy: `<Color>\n  {children}\n</Color>`,
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
  ContrastRegionFill,
  FallbackPointsLayer,
  GamutBoundaryLayer,
} from 'color-kit/react';

<ColorArea axes={{ x: { channel: 'l' }, y: { channel: 'c' } }}>
  <Background checkerboard />
  <ColorPlane edgeBehavior="clamp" />
  <GamutBoundaryLayer gamut="display-p3" />
  <ContrastRegionLayer threshold={4.5}>
    <ContrastRegionFill fillColor="#c0e1ff" fillOpacity={0.14} />
  </ContrastRegionLayer>
  <FallbackPointsLayer />
</ColorArea>;`,
    helperApis: [
      'ColorApi.resolveColorAreaAxes',
      'ColorApi.resolveColorAreaRange',
      'ColorApi.getColorAreaThumbPosition',
      'ColorApi.colorFromColorAreaPosition',
      'ColorApi.colorFromColorAreaKey',
      'ColorApi.getColorAreaChromaBandPoints',
      'ColorApi.getColorAreaGamutBoundaryPoints',
      'ColorApi.getColorAreaContrastRegionPaths',
      'ColorApi.getColorAreaFallbackPoint',
    ],
    features: [
      'Composable primitive model: ColorArea + ColorPlane + Layer wrappers + Thumb.',
      'UI-plane interaction allows out-of-gamut intent while preserving explicit realized fallbacks.',
      'Built-in wrappers for chroma bands, gamut boundaries, contrast regions, and fallback markers.',
    ],
    accessibility: [
      'Thumb owns slider semantics and keyboard channel movement.',
      'Layer primitives are non-interactive by default so overlays do not intercept input.',
    ],
    props: componentApiDocs.colorArea,
    anatomy: `<ColorArea>\n  <Background />\n  <ColorPlane />\n  <Thumb />\n</ColorArea>`,
    supportsPropertiesPanel: true,
  },
  'color-slider': {
    slug: 'color-slider',
    title: 'Color Slider',
    summary: 'Single-axis channel control for `l`, `c`, `h`, and `alpha`.',
    description:
      'ColorSlider is the generic primitive for horizontal or vertical channel manipulation across models.',
    registryName: 'color-slider',
    demo: ColorSliderDemo,
    usage: `import { ColorSlider } from 'color-kit/react';

<>
  <ColorSlider channel="h" />
  <ColorSlider channel="alpha" />
</>;`,
    helperApis: [
      'ColorApi.resolveColorSliderRange',
      'ColorApi.getColorSliderNormFromValue',
      'ColorApi.getColorSliderThumbPosition',
      'ColorApi.normalizeColorSliderPointer',
      'ColorApi.colorFromColorSliderPosition',
      'ColorApi.colorFromColorSliderKey',
      'ColorApi.sampleSliderGradient',
      'ColorApi.getSliderGradientStyles',
    ],
    features: [
      'Orientation-aware keyboard and pointer interactions.',
      'Shared requested state contract with Color or standalone props.',
      'Use `channel="h"` and `channel="alpha"` for hue/opacity workflows.',
      'Customizable channel ranges for bounded workflows.',
      'Optional child marker primitives for annotated rails.',
      'Model-accurate rail backgrounds via non-UI ColorApi helpers.',
    ],
    accessibility: [
      'Uses `role="slider"` with keyboard arrow support.',
      'Exposes current channel value through ARIA attributes.',
    ],
    props: componentApiDocs.colorSlider,
    anatomy: `<ColorSlider>\n  <div data-color-slider-thumb />\n  <SliderMarker />\n  <ChromaMarkers />\n</ColorSlider>`,
    supportsPropertiesPanel: true,
  },
  'color-input': {
    slug: 'color-input',
    title: 'Color Input',
    summary: 'Channel-aware value input with scrub and expression support.',
    description:
      'ColorInput edits a single channel in oklch/rgb/hsl using typed math expressions, keyboard stepping, and left-edge scrubbing.',
    registryName: 'color-input',
    demo: ColorInputDemo,
    usage: `import { ColorInput } from 'color-kit/react';

<ColorInput model="oklch" channel="h" />;`,
    helperApis: [
      'ColorApi.resolveColorInputRange',
      'ColorApi.resolveColorInputSteps',
      'ColorApi.parseColorInputExpression',
      'ColorApi.colorFromColorInputKey',
    ],
    features: [
      'Model + channel contract for oklch, rgb, and hsl value editing.',
      'Expression parsing (`+10`, `*1.1`, parentheses, `%`) with soft-invalid drafts.',
      'Left-edge scrub dragging with fine/coarse keyboard modifiers.',
    ],
    accessibility: [
      'Spinbutton semantics with `aria-valuemin/max/now` and readable labels.',
      'Keyboard-first stepping (arrows, page keys, Home/End) and select-all on focus.',
    ],
    props: componentApiDocs.colorInput,
    anatomy: `<ColorInput>\n  <div data-color-input-scrub-handle />\n  <input role="spinbutton" />\n</ColorInput>`,
    supportsPropertiesPanel: true,
  },
  'color-string-input': {
    slug: 'color-string-input',
    title: 'Color String Input',
    summary: 'Legacy free-form string entry for full color values.',
    description:
      'ColorStringInput preserves the original hex/rgb/hsl/oklch text parsing workflow while ColorInput focuses on channel editing.',
    registryName: 'color-string-input',
    demo: ColorStringInputDemo,
    usage: `import { ColorStringInput } from 'color-kit/react';

<ColorStringInput format="oklch" />;`,
    helperApis: [
      'ColorApi.formatColorStringInputValue',
      'ColorApi.parseColorStringInputValue',
      'ColorApi.isColorStringInputValueValid',
    ],
    features: [
      'Format-aware string entry (`hex`, `rgb`, `hsl`, `oklch`).',
      'Soft-invalid commit handling via `onInvalidCommit`.',
      'Works standalone or with Color context.',
    ],
    accessibility: [
      'Native textbox semantics with explicit labels.',
      'Escape cancels edits and Enter commits parsed values.',
    ],
    props: componentApiDocs.colorStringInput,
    anatomy: `<ColorStringInput>\n  <input type="text" />\n</ColorStringInput>`,
  },
};

export function getComponentDoc(slug: string): ComponentDocData | undefined {
  return docs[slug];
}
