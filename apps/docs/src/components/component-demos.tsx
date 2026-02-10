import { parse, toCss } from '@color-kit/core';
import {
  AlphaSlider,
  ColorApi,
  ColorArea,
  ColorDisplay,
  ColorInput,
  ColorProvider,
  ColorSlider,
  ContrastBadge,
  HueSlider,
  Swatch,
  SwatchGroup,
  type ColorAreaChannel,
  type ColorSliderChannel,
  useColor,
} from '@color-kit/react';
import { useEffect, useMemo, useState } from 'react';
import { useOptionalDocsInspector } from './docs-inspector-context.js';

const DOC_SWATCHES = [
  '#fb7185',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
].map((value) => parse(value));

const HUE_GRADIENT =
  'linear-gradient(90deg, #ff0040 0%, #ffa500 16%, #f7f700 33%, #00c950 50%, #00b7ff 66%, #364dff 82%, #ff00b7 100%)';

const ALPHA_GRADIENT =
  'linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 1))';

const SATURATION_GRADIENT =
  'linear-gradient(90deg, oklch(0.65 0 255), oklch(0.65 0.34 255))';

const AREA_GRADIENT =
  'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0)), linear-gradient(to right, #ffffff, #3b82f6)';
const CHECKERBOARD_GRADIENT =
  'linear-gradient(45deg, rgba(13, 18, 29, 0.7) 25%, transparent 25%), linear-gradient(-45deg, rgba(13, 18, 29, 0.7) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(13, 18, 29, 0.7) 75%), linear-gradient(-45deg, transparent 75%, rgba(13, 18, 29, 0.7) 75%)';

const SLIDER_GRADIENTS: Record<ColorSliderChannel, string> = {
  l: 'linear-gradient(90deg, #0f172a, #f8fafc)',
  c: SATURATION_GRADIENT,
  h: HUE_GRADIENT,
  alpha: ALPHA_GRADIENT,
};

const SWATCH_GROUP_PALETTES = {
  spectrum: DOC_SWATCHES,
  nature: [
    '#14532d',
    '#166534',
    '#22c55e',
    '#84cc16',
    '#facc15',
    '#78350f',
  ].map((value) => parse(value)),
  neon: ['#ff2e88', '#ff5f1f', '#ffe53b', '#17f9a3', '#00e7ff', '#7a5cff'].map(
    (value) => parse(value),
  ),
} as const;

const CONTRAST_PRESETS = {
  interface: {
    foreground: parse('#111827'),
    background: parse('#f8fafc'),
    sample: 'The quick brown fox jumps over the lazy dog.',
  },
  editorial: {
    foreground: parse('#3f1d0a'),
    background: parse('#ffedd5'),
    sample: 'Typography pairs should remain readable at body sizes.',
  },
  alert: {
    foreground: parse('#fff7ed'),
    background: parse('#7c2d12'),
    sample: 'Warning surfaces need clear, testable readability.',
  },
} as const;

function toSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  return points
    .map((point, index) => {
      const x = (point.x * 100).toFixed(3);
      const y = (point.y * 100).toFixed(3);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function channelRange(channel: ColorAreaChannel): [number, number] {
  return ColorApi.resolveColorAreaRange(channel);
}

function normalizeChannels(
  x: ColorAreaChannel,
  y: ColorAreaChannel,
): { x: ColorAreaChannel; y: ColorAreaChannel } {
  if (x !== y) {
    return { x, y };
  }
  return { x, y: y === 'l' ? 'c' : 'l' };
}

function getAreaBackground(channels: {
  x: ColorAreaChannel;
  y: ColorAreaChannel;
}) {
  if (
    (channels.x === 'c' && channels.y === 'l') ||
    (channels.x === 'l' && channels.y === 'c')
  ) {
    return AREA_GRADIENT;
  }
  if (channels.x === 'h' || channels.y === 'h') {
    return 'linear-gradient(90deg, #ff0052 0%, #ffb347 17%, #f9f871 33%, #41d67e 50%, #36c6ff 67%, #6f7bff 83%, #ff4cb8 100%)';
  }
  return 'linear-gradient(135deg, #111827 0%, #0ea5e9 50%, #f97316 100%)';
}

export function ColorProviderDemo() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <div className="ck-demo-stack">
        <ColorArea
          className="ck-color-area"
          style={{ background: AREA_GRADIENT }}
        />
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <AlphaSlider
          className="ck-slider"
          style={{ background: ALPHA_GRADIENT }}
        />
        <div className="ck-row">
          <ColorInput className="ck-input" />
          <ColorDisplay className="ck-color-display" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function ColorAreaDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state = inspectorDriven && inspector ? inspector.colorAreaState : null;

  const channels = normalizeChannels(state?.xAxis ?? 'c', state?.yAxis ?? 'l');
  const showCheckerboard = state?.showCheckerboard ?? false;
  const xRange = channelRange(channels.x);
  const yRange = channelRange(channels.y);
  const color = useColor({
    defaultColor: '#2563eb',
    defaultGamut: state?.gamut ?? 'display-p3',
  });
  const inspectorGamut = state?.gamut;
  const setColorAreaGamut = color.setActiveGamut;

  useEffect(() => {
    if (!inspectorGamut) return;
    setColorAreaGamut(inspectorGamut, 'programmatic');
  }, [inspectorGamut, setColorAreaGamut]);

  const hue = color.requested.h;
  const boundarySrgb = useMemo(() => {
    if (!state?.showSrgbBoundary) return [];
    return ColorApi.getColorAreaGamutBoundaryPoints(
      hue,
      channels,
      xRange,
      yRange,
      { gamut: 'srgb', steps: 48 },
    );
  }, [state?.showSrgbBoundary, hue, channels, xRange, yRange]);

  const boundaryP3 = useMemo(() => {
    if (!state?.showP3Boundary) return [];
    return ColorApi.getColorAreaGamutBoundaryPoints(
      hue,
      channels,
      xRange,
      yRange,
      { gamut: 'display-p3', steps: 48 },
    );
  }, [state?.showP3Boundary, hue, channels, xRange, yRange]);

  const contrastPaths = useMemo(() => {
    if (!state?.showContrastRegion) return [];
    return ColorApi.getColorAreaContrastRegionPaths(
      color.displayed,
      hue,
      channels,
      xRange,
      yRange,
      {
        gamut: state.gamut,
        threshold: 4.5,
        lightnessSteps: 28,
        chromaSteps: 28,
      },
    );
  }, [
    state?.showContrastRegion,
    state?.gamut,
    color.displayed,
    hue,
    channels,
    xRange,
    yRange,
  ]);

  const p3Path = useMemo(() => toSvgPath(boundaryP3), [boundaryP3]);
  const srgbPath = useMemo(() => toSvgPath(boundarySrgb), [boundarySrgb]);
  const contrastPathData = useMemo(
    () => contrastPaths.map((path) => toSvgPath(path)).filter(Boolean),
    [contrastPaths],
  );
  const areaBackground = useMemo(() => {
    const baseBackground = getAreaBackground(channels);
    if (!showCheckerboard) {
      return {
        backgroundImage: baseBackground,
      };
    }
    return {
      backgroundImage: `${CHECKERBOARD_GRADIENT}, ${baseBackground}`,
      backgroundSize: '16px 16px, 16px 16px, 16px 16px, 16px 16px, auto',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0, 0 0',
    };
  }, [channels, showCheckerboard]);

  return (
    <div className="ck-demo-stack">
      <ColorArea
        className="ck-color-area"
        requested={color.requested}
        onChangeRequested={color.setRequested}
        channels={channels}
        xRange={xRange}
        yRange={yRange}
        style={areaBackground}
      >
        {(state?.showContrastRegion ?? false) && (
          <svg
            className="ck-color-area-overlay"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            {contrastPathData.map((d, index) => (
              <path
                key={`contrast-${index}`}
                d={d}
                className="ck-overlay-contrast"
              />
            ))}
          </svg>
        )}
        <svg
          className="ck-color-area-overlay"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {p3Path ? <path d={p3Path} className="ck-overlay-p3" /> : null}
          {srgbPath ? <path d={srgbPath} className="ck-overlay-srgb" /> : null}
        </svg>
      </ColorArea>
      <HueSlider
        className="ck-slider"
        requested={color.requested}
        onChangeRequested={color.setRequested}
        style={{ background: HUE_GRADIENT }}
      />
      <div className="ck-row">
        <ColorInput
          className="ck-input"
          format="oklch"
          requested={color.requested}
          onChangeRequested={color.setRequested}
        />
        <ColorDisplay
          className="ck-color-display"
          requested={color.requested}
          gamut={color.activeGamut}
        />
      </div>
    </div>
  );
}

export function ColorSliderDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state =
    inspectorDriven && inspector ? inspector.colorSliderState : null;
  const channel = state?.channel ?? 'c';
  const color = useColor({
    defaultColor: '#8b5cf6',
    defaultGamut: state?.gamut ?? 'display-p3',
  });
  const sliderGamut = state?.gamut;
  const setSliderGamut = color.setActiveGamut;

  useEffect(() => {
    if (!sliderGamut) return;
    setSliderGamut(sliderGamut, 'programmatic');
  }, [sliderGamut, setSliderGamut]);

  return (
    <div className="ck-demo-stack">
      <ColorSlider
        channel={channel}
        className="ck-slider"
        requested={color.requested}
        onChangeRequested={color.setRequested}
        style={{ background: SLIDER_GRADIENTS[channel] }}
      />
      <ColorInput
        format="oklch"
        className="ck-input"
        requested={color.requested}
        onChangeRequested={color.setRequested}
      />
      <ColorDisplay
        className="ck-color-display"
        requested={color.requested}
        gamut={color.activeGamut}
      />
    </div>
  );
}

export function HueSliderDemo() {
  return (
    <ColorProvider defaultColor="#ef4444">
      <div className="ck-demo-stack">
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <div className="ck-row">
          <ColorDisplay className="ck-color-display" />
          <ColorInput className="ck-input" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function AlphaSliderDemo() {
  return (
    <ColorProvider defaultColor="oklch(0.72 0.2 220 / 0.65)">
      <div className="ck-demo-stack">
        <ColorDisplay className="ck-color-display ck-checker" />
        <AlphaSlider
          className="ck-slider"
          style={{ background: ALPHA_GRADIENT }}
        />
        <ColorInput format="rgb" className="ck-input" />
      </div>
    </ColorProvider>
  );
}

export function SwatchDemo() {
  const [selectedIndex, setSelectedIndex] = useState(2);

  return (
    <div className="ck-demo-stack">
      <div className="ck-swatch-row" role="listbox" aria-label="Color options">
        {DOC_SWATCHES.map((color, index) => (
          <Swatch
            key={`${index}-${toCss(color, 'hex')}`}
            className="ck-swatch"
            color={color}
            isSelected={selectedIndex === index}
            onSelect={() => setSelectedIndex(index)}
            aria-label={`Select ${toCss(color, 'hex')}`}
            role="option"
            aria-selected={selectedIndex === index}
          />
        ))}
      </div>
      <div className="ck-caption">
        Selected: {toCss(DOC_SWATCHES[selectedIndex], 'hex')}
      </div>
    </div>
  );
}

export function SwatchGroupDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state =
    inspectorDriven && inspector ? inspector.swatchGroupState : null;
  const paletteName = state?.palette ?? 'spectrum';
  const palette = SWATCH_GROUP_PALETTES[paletteName];
  const [selected, setSelected] = useState(palette[0]);

  useEffect(() => {
    setSelected(palette[0]);
  }, [palette]);

  return (
    <div className="ck-demo-stack">
      <SwatchGroup
        colors={palette}
        columns={state?.columns ?? 4}
        value={selected}
        onChange={setSelected}
        className="ck-swatch-grid"
      />
      <ColorInput
        className="ck-input"
        requested={selected}
        onChangeRequested={setSelected}
      />
    </div>
  );
}

export function ColorInputDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state = inspectorDriven && inspector ? inspector.colorInputState : null;
  const colorState = useColor({ defaultColor: '#6366f1' });
  const inputGamut = state?.gamut;
  const setInputGamut = colorState.setActiveGamut;

  useEffect(() => {
    if (!inputGamut) return;
    setInputGamut(inputGamut, 'programmatic');
  }, [inputGamut, setInputGamut]);

  return (
    <div className="ck-demo-stack">
      <ColorInput
        className="ck-input"
        format={state?.format ?? 'hex'}
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary color input"
      />
      <ColorInput
        className="ck-input"
        format="oklch"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="OKLCH reference input"
      />
      <ColorDisplay
        className="ck-color-display"
        requested={colorState.requested}
        gamut={state?.gamut ?? 'display-p3'}
      />
    </div>
  );
}

export function ColorDisplayDemo() {
  return (
    <ColorProvider defaultColor="#10b981">
      <div className="ck-demo-stack">
        <ColorDisplay className="ck-color-display" />
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <AlphaSlider
          className="ck-slider"
          style={{ background: ALPHA_GRADIENT }}
        />
      </div>
    </ColorProvider>
  );
}

export function ContrastBadgeDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state =
    inspectorDriven && inspector ? inspector.contrastBadgeState : null;
  const preset = CONTRAST_PRESETS[state?.preset ?? 'interface'];
  const foreground = useColor({
    defaultColor: toCss(preset.foreground, 'hex'),
  });
  const background = useColor({
    defaultColor: toCss(preset.background, 'hex'),
  });
  const presetKey = state?.preset;
  const setForeground = foreground.setRequested;
  const setBackground = background.setRequested;

  useEffect(() => {
    if (!presetKey) return;
    const nextPreset = CONTRAST_PRESETS[presetKey];
    setForeground(nextPreset.foreground, {
      interaction: 'programmatic',
    });
    setBackground(nextPreset.background, {
      interaction: 'programmatic',
    });
  }, [presetKey, setForeground, setBackground]);

  return (
    <div className="ck-demo-stack">
      <div className="ck-row">
        <ColorInput
          className="ck-input"
          format="hex"
          requested={foreground.requested}
          onChangeRequested={foreground.setRequested}
          aria-label="Foreground color"
        />
        <ColorInput
          className="ck-input"
          format="hex"
          requested={background.requested}
          onChangeRequested={background.setRequested}
          aria-label="Background color"
        />
      </div>
      <div
        className="ck-contrast-sample"
        style={{
          color: toCss(foreground.requested, 'rgb'),
          backgroundColor: toCss(background.requested, 'rgb'),
        }}
      >
        {preset.sample}
      </div>
      <ContrastBadge
        className="ck-contrast-badge"
        foreground={foreground.requested}
        background={background.requested}
        level={state?.level ?? 'AA'}
      />
    </div>
  );
}
