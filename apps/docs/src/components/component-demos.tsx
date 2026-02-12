import { parse, toCss } from '@color-kit/core';
import {
  AlphaSlider,
  Background,
  ColorApi,
  ColorArea,
  ColorPlane,
  ColorDisplay,
  ColorInput,
  ColorProvider,
  ColorSlider,
  ContrastRegionLayer,
  ContrastBadge,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  HueSlider,
  Swatch,
  SwatchGroup,
  useColorContext,
  type ColorAreaChannel,
  type ColorAreaAxes,
  type ColorAreaInteractionFrameStats,
  type ColorSliderChannel,
  useColor,
} from '@color-kit/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function normalizeChannels(
  x: ColorAreaChannel,
  y: ColorAreaChannel,
): { x: ColorAreaChannel; y: ColorAreaChannel } {
  if (x !== y) {
    return { x, y };
  }
  return { x, y: y === 'l' ? 'c' : 'l' };
}

function ColorAreaDemoScene({
  axes,
  inspectorGamut,
  showCheckerboard,
  showP3Boundary,
  showSrgbBoundary,
  showContrastRegion,
  onInteractionFrame,
}: {
  axes: ColorAreaAxes;
  inspectorGamut: 'display-p3' | 'srgb' | undefined;
  showCheckerboard: boolean;
  showP3Boundary: boolean;
  showSrgbBoundary: boolean;
  showContrastRegion: boolean;
  onInteractionFrame: (stats: ColorAreaInteractionFrameStats) => void;
}) {
  const color = useColorContext();

  useEffect(() => {
    if (!inspectorGamut) return;
    if (color.state$.activeGamut.peek() === inspectorGamut) return;
    color.setActiveGamut(inspectorGamut, 'programmatic');
  }, [color, inspectorGamut]);

  return (
    <>
      <ColorArea
        className="ck-color-area"
        axes={axes}
        performanceProfile="auto"
        onInteractionFrame={onInteractionFrame}
      >
        <Background checkerboard={showCheckerboard} />
        <ColorPlane renderer="auto" />
        {showP3Boundary && (
          <GamutBoundaryLayer
            gamut="display-p3"
            steps={48}
            quality="auto"
            pathProps={{ className: 'ck-overlay-p3' }}
          />
        )}
        {showSrgbBoundary && (
          <GamutBoundaryLayer
            gamut="srgb"
            steps={48}
            quality="auto"
            pathProps={{ className: 'ck-overlay-srgb' }}
          />
        )}
        {showContrastRegion && (
          <ContrastRegionLayer
            gamut={inspectorGamut}
            threshold={4.5}
            lightnessSteps={28}
            chromaSteps={28}
            quality="auto"
            pathProps={{ className: 'ck-overlay-contrast' }}
          />
        )}
        <FallbackPointsLayer />
      </ColorArea>
      <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
      <div className="ck-row">
        <ColorInput className="ck-input" format="oklch" />
        <ColorDisplay className="ck-color-display" />
      </div>
    </>
  );
}

export function ColorProviderDemo() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <div className="ck-demo-stack">
        <ColorArea className="ck-color-area">
          <Background checkerboard />
          <ColorPlane />
        </ColorArea>
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

  const channels = normalizeChannels(state?.xAxis ?? 'l', state?.yAxis ?? 'c');
  const axes: ColorAreaAxes = useMemo(
    () => ({
      x: {
        channel: channels.x,
        range: ColorApi.resolveColorAreaRange(channels.x),
      },
      y: {
        channel: channels.y,
        range: ColorApi.resolveColorAreaRange(channels.y),
      },
    }),
    [channels],
  );
  const [perfFrame, setPerfFrame] =
    useState<ColorAreaInteractionFrameStats | null>(null);
  const perfUiUpdateTsRef = useRef(0);
  const handleInteractionFrame = useCallback(
    (stats: ColorAreaInteractionFrameStats) => {
      const now = Date.now();
      if (now - perfUiUpdateTsRef.current >= 120) {
        perfUiUpdateTsRef.current = now;
        setPerfFrame(stats);
      }

      if (typeof window !== 'undefined') {
        const target = window as Window & {
          __ckPerfFrames?: Array<
            ColorAreaInteractionFrameStats & { ts: number }
          >;
        };
        if (!target.__ckPerfFrames) {
          target.__ckPerfFrames = [];
        }
        target.__ckPerfFrames.push({
          ...stats,
          ts: now,
        });
        if (target.__ckPerfFrames.length > 2400) {
          target.__ckPerfFrames.shift();
        }
      }
    },
    [],
  );

  return (
    <div className="ck-demo-stack">
      <ColorProvider
        defaultColor="#2563eb"
        defaultGamut={state?.gamut ?? 'display-p3'}
      >
        <ColorAreaDemoScene
          axes={axes}
          inspectorGamut={state?.gamut}
          showCheckerboard={state?.showCheckerboard ?? false}
          showP3Boundary={state?.showP3Boundary ?? false}
          showSrgbBoundary={state?.showSrgbBoundary ?? false}
          showContrastRegion={state?.showContrastRegion ?? false}
          onInteractionFrame={handleInteractionFrame}
        />
      </ColorProvider>
      <div className="ck-caption">
        Perf profile: auto · quality: {perfFrame?.qualityLevel ?? 'high'} ·
        frame {perfFrame ? `${perfFrame.frameTimeMs.toFixed(2)}ms` : '--'} ·
        update {perfFrame ? `${perfFrame.updateDurationMs.toFixed(2)}ms` : '--'}{' '}
        · coalesced {perfFrame?.coalescedCount ?? 0}
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
  const sliderGamutSetterRef = useRef(color.setActiveGamut);

  useEffect(() => {
    sliderGamutSetterRef.current = color.setActiveGamut;
  }, [color.setActiveGamut]);

  useEffect(() => {
    if (!sliderGamut) return;
    if (color.activeGamut === sliderGamut) return;
    sliderGamutSetterRef.current(sliderGamut, 'programmatic');
  }, [sliderGamut, color.activeGamut]);

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
  const foregroundSetterRef = useRef(foreground.setRequested);
  const backgroundSetterRef = useRef(background.setRequested);

  useEffect(() => {
    foregroundSetterRef.current = foreground.setRequested;
  }, [foreground.setRequested]);

  useEffect(() => {
    backgroundSetterRef.current = background.setRequested;
  }, [background.setRequested]);

  useEffect(() => {
    if (!presetKey) return;
    const nextPreset = CONTRAST_PRESETS[presetKey];
    const currentForeground = toCss(foreground.requested, 'hex').toLowerCase();
    const currentBackground = toCss(background.requested, 'hex').toLowerCase();
    const nextForeground = toCss(nextPreset.foreground, 'hex').toLowerCase();
    const nextBackground = toCss(nextPreset.background, 'hex').toLowerCase();

    if (currentForeground !== nextForeground) {
      foregroundSetterRef.current(nextPreset.foreground, {
        interaction: 'programmatic',
      });
    }

    if (currentBackground !== nextBackground) {
      backgroundSetterRef.current(nextPreset.background, {
        interaction: 'programmatic',
      });
    }
  }, [presetKey, foreground.requested, background.requested]);

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
