import { parse, toCss, toP3Gamut, toSrgbGamut } from '@color-kit/core';
import {
  Background,
  ChromaBandLayer,
  ChromaMarkers,
  ColorApi,
  ColorArea,
  ColorDial,
  ColorPlane,
  ColorDisplay,
  ColorInput,
  ColorStringInput,
  ColorProvider,
  ColorSlider,
  ColorWheel,
  ContrastRegionLayer,
  ContrastBadge,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  HueDial,
  Swatch,
  SwatchGroup,
  useColorContext,
  type ColorAreaChannel,
  type ColorAreaAxes,
  type ColorAreaInteractionFrameStats,
  type ColorSliderChannel,
  useColor,
} from '@color-kit/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  useOptionalDocsInspector,
  type ColorAreaInspectorState,
} from './docs-inspector-context.js';

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

const WHEEL_GRADIENT =
  'radial-gradient(circle at center, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 12%, rgba(255, 255, 255, 0) 68%), conic-gradient(from 0deg, #ff304f 0deg, #ff912a 48deg, #efe034 96deg, #2ddb70 144deg, #00d9d9 192deg, #2d8fff 240deg, #845bff 288deg, #ff3cc2 336deg, #ff304f 360deg)';

const DIAL_RING_BACKGROUND =
  'conic-gradient(from 0deg, #ff0040, #ffa500, #f7f700, #00c950, #00b7ff, #364dff, #ff00b7, #ff0040)';
const FIGMA_DOT_PATTERN = {
  opacityPercent: 14,
  dotSize: 1,
  dotGap: 4,
} as const;
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

type SliderRailStyle = CSSProperties & {
  '--ck-slider-gradient-active': string;
  '--ck-slider-gradient-srgb': string;
  '--ck-slider-fallback-color': string;
  '--ck-slider-rail-start-active': string;
  '--ck-slider-rail-start-srgb': string;
  '--ck-slider-rail-end-active': string;
  '--ck-slider-rail-end-srgb': string;
  '--ck-slider-thumb-fill-active': string;
  '--ck-slider-thumb-fill-srgb': string;
};

function getOklchSliderRail(
  channel: ColorSliderChannel,
  requested: ReturnType<typeof parse>,
  gamut: 'display-p3' | 'srgb',
): { colorSpace: 'display-p3' | 'srgb'; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel);
  const gradient = ColorApi.getSliderGradientStyles({
    model: 'oklch',
    channel,
    range,
    baseColor: requested,
    colorSpace: gamut,
  });
  const startStop = gradient.stops[0];
  const endStop = gradient.stops[gradient.stops.length - 1] ?? startStop;
  const thumbNorm = ColorApi.getColorSliderThumbPosition(
    requested,
    channel,
    range,
  );
  const thumbColor = ColorApi.colorFromColorSliderPosition(
    requested,
    channel,
    thumbNorm,
    range,
  );
  const thumbFillSrgb = toCss(toSrgbGamut(thumbColor), 'rgb');
  const thumbFillActive =
    gradient.colorSpace === 'display-p3'
      ? toCss(toP3Gamut(thumbColor), 'p3')
      : thumbFillSrgb;
  const railStartSrgb = startStop?.srgbCss ?? gradient.srgbBackgroundColor;
  const railEndSrgb = endStop?.srgbCss ?? railStartSrgb;
  const railStartActive = startStop?.activeCss ?? railStartSrgb;
  const railEndActive = endStop?.activeCss ?? railEndSrgb;

  return {
    colorSpace: gradient.colorSpace,
    style: {
      '--ck-slider-gradient-active': gradient.activeBackgroundImage,
      '--ck-slider-gradient-srgb': gradient.srgbBackgroundImage,
      '--ck-slider-fallback-color': gradient.srgbBackgroundColor,
      '--ck-slider-rail-start-active': railStartActive,
      '--ck-slider-rail-start-srgb': railStartSrgb,
      '--ck-slider-rail-end-active': railEndActive,
      '--ck-slider-rail-end-srgb': railEndSrgb,
      '--ck-slider-thumb-fill-active': thumbFillActive,
      '--ck-slider-thumb-fill-srgb': thumbFillSrgb,
    },
  };
}

function strokeDasharray(
  style: 'solid' | 'dashed' | 'dots',
): string | undefined {
  if (style === 'solid') return undefined;
  if (style === 'dashed') return '1.35 1.05';
  return '0.15 1';
}

function strokePathProps(
  control: { style: 'solid' | 'dashed' | 'dots'; width: 0.25 | 0.5 | 1 },
  stroke: string,
) {
  return {
    fill: 'none' as const,
    stroke,
    strokeWidth: control.width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeDasharray: strokeDasharray(control.style),
  };
}

const COLOR_AREA_LINE_STEPS = 128;
const COLOR_AREA_CONTRAST_STEPS = 72;

function ColorAreaDemoScene({
  inspectorState,
  axes,
  onInteractionFrame,
}: {
  inspectorState: ColorAreaInspectorState | null;
  axes: ColorAreaAxes;
  onInteractionFrame: (stats: ColorAreaInteractionFrameStats) => void;
}) {
  const color = useColorContext();

  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const scene = inspectorState ?? {
    gamut: color.activeGamut,
    repeatEdgePixels: true,
    background: {
      checkerboard: true,
      outOfP3: { color: '#1f1f1f', opacityPercent: 0 },
      outOfSrgb: { color: '#1f1f1f', opacityPercent: 0 },
    },
    visualize: {
      p3Fallback: true,
      srgbFallback: true,
      p3Boundary: { enabled: false, style: 'solid', width: 0.25 as const },
      srgbBoundary: { enabled: false, style: 'dashed', width: 0.25 as const },
      patternOverlay: {
        enabled: false,
        style: 'dots',
        opacityPercent: FIGMA_DOT_PATTERN.opacityPercent,
        dotSize: FIGMA_DOT_PATTERN.dotSize,
        dotGap: FIGMA_DOT_PATTERN.dotGap,
      },
    },
    chromaBand: {
      mode: 'closest' as const,
      p3: { enabled: false, style: 'solid', width: 0.25 as const },
      srgb: { enabled: false, style: 'dashed', width: 0.25 as const },
    },
    contrast: {
      lines: {
        aa3: { enabled: false, style: 'solid', width: 0.25 as const },
        aa45: { enabled: false, style: 'dashed', width: 0.25 as const },
        aa7: { enabled: false, style: 'dashed', width: 0.25 as const },
      },
      regions: {
        aa3: {
          enabled: false,
          style: 'dots',
          opacityPercent: FIGMA_DOT_PATTERN.opacityPercent,
        },
        aa45: {
          enabled: false,
          style: 'dots',
          opacityPercent: FIGMA_DOT_PATTERN.opacityPercent,
        },
        aa7: {
          enabled: false,
          style: 'dots',
          opacityPercent: FIGMA_DOT_PATTERN.opacityPercent,
        },
      },
    },
  };

  const colorPlaneOutOfGamut = {
    repeatEdgePixels: scene.repeatEdgePixels,
    outOfP3FillColor: scene.background.outOfP3.color,
    outOfP3FillOpacity: scene.background.outOfP3.opacityPercent / 100,
    outOfSrgbFillColor: scene.background.outOfSrgb.color,
    outOfSrgbFillOpacity: scene.background.outOfSrgb.opacityPercent / 100,
    dotPatternOpacity: scene.visualize.patternOverlay.enabled
      ? scene.visualize.patternOverlay.opacityPercent / 100
      : 0,
    dotPatternSize: scene.visualize.patternOverlay.dotSize,
    dotPatternGap: scene.visualize.patternOverlay.dotGap,
  };

  return (
    <>
      <ColorArea
        className="ck-color-area"
        axes={axes}
        performanceProfile="auto"
        onInteractionFrame={onInteractionFrame}
      >
        <Background checkerboard={scene.background.checkerboard} />
        <ColorPlane renderer="auto" outOfGamut={colorPlaneOutOfGamut} />

        {scene.visualize.p3Boundary.enabled && (
          <GamutBoundaryLayer
            gamut="display-p3"
            steps={COLOR_AREA_LINE_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.visualize.p3Boundary, '#40f5d2')}
          />
        )}
        {scene.visualize.srgbBoundary.enabled && (
          <GamutBoundaryLayer
            gamut="srgb"
            steps={COLOR_AREA_LINE_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.visualize.srgbBoundary, '#ffd447')}
          />
        )}

        {scene.chromaBand.p3.enabled && (
          <ChromaBandLayer
            gamut="display-p3"
            mode={scene.chromaBand.mode}
            steps={COLOR_AREA_LINE_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.chromaBand.p3, '#9e8cff')}
          />
        )}
        {scene.chromaBand.srgb.enabled && (
          <ChromaBandLayer
            gamut="srgb"
            mode={scene.chromaBand.mode}
            steps={COLOR_AREA_LINE_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.chromaBand.srgb, '#ffe06b')}
          />
        )}

        {scene.contrast.lines.aa3.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={3}
            lightnessSteps={COLOR_AREA_CONTRAST_STEPS}
            chromaSteps={COLOR_AREA_CONTRAST_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.contrast.lines.aa3, '#bcd6ff')}
          />
        )}
        {scene.contrast.lines.aa45.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={4.5}
            lightnessSteps={COLOR_AREA_CONTRAST_STEPS}
            chromaSteps={COLOR_AREA_CONTRAST_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.contrast.lines.aa45, '#c0e1ff')}
          />
        )}
        {scene.contrast.lines.aa7.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={7}
            lightnessSteps={COLOR_AREA_CONTRAST_STEPS}
            chromaSteps={COLOR_AREA_CONTRAST_STEPS}
            quality="auto"
            pathProps={strokePathProps(scene.contrast.lines.aa7, '#d5e7ff')}
          />
        )}

        {scene.contrast.regions.aa3.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={3}
            renderMode="region"
            lightnessSteps={28}
            chromaSteps={28}
            quality="auto"
            regionFillColor="#7ca4ff"
            regionFillOpacity={0.12}
            regionDotOpacity={scene.contrast.regions.aa3.opacityPercent / 100}
            regionDotSize={FIGMA_DOT_PATTERN.dotSize}
            regionDotGap={FIGMA_DOT_PATTERN.dotGap}
          />
        )}
        {scene.contrast.regions.aa45.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={4.5}
            renderMode="region"
            lightnessSteps={28}
            chromaSteps={28}
            quality="auto"
            regionFillColor="#c0e1ff"
            regionFillOpacity={0.14}
            regionDotOpacity={scene.contrast.regions.aa45.opacityPercent / 100}
            regionDotSize={FIGMA_DOT_PATTERN.dotSize}
            regionDotGap={FIGMA_DOT_PATTERN.dotGap}
          />
        )}
        {scene.contrast.regions.aa7.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={7}
            renderMode="region"
            lightnessSteps={28}
            chromaSteps={28}
            quality="auto"
            regionFillColor="#dceaff"
            regionFillOpacity={0.16}
            regionDotOpacity={scene.contrast.regions.aa7.opacityPercent / 100}
            regionDotSize={FIGMA_DOT_PATTERN.dotSize}
            regionDotGap={FIGMA_DOT_PATTERN.dotGap}
          />
        )}
        <FallbackPointsLayer
          showP3={scene.visualize.p3Fallback}
          showSrgb={scene.visualize.srgbFallback}
        />
      </ColorArea>
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <div className="ck-row">
        <ColorStringInput className="ck-input" format="oklch" />
        <ColorDisplay className="ck-color-display" />
      </div>
    </>
  );
}

function ColorProviderDemoContent() {
  const color = useColorContext();
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorArea className="ck-color-area">
        <Background checkerboard />
        <ColorPlane />
      </ColorArea>
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <ColorSlider
        channel="alpha"
        className="ck-slider ck-slider-v2"
        data-color-space={alphaRail.colorSpace}
        style={alphaRail.style}
      />
      <div className="ck-row">
        <ColorStringInput className="ck-input" />
        <ColorDisplay className="ck-color-display" />
      </div>
    </div>
  );
}

export function ColorProviderDemo() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <ColorProviderDemoContent />
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
  const setColorAreaColorState =
    inspectorDriven && inspector ? inspector.setColorAreaColorState : null;

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
      {state && setColorAreaColorState ? (
        <ColorProvider
          state={state.colorState}
          onChange={(event) => setColorAreaColorState(event.next)}
        >
          <ColorAreaDemoScene
            axes={axes}
            inspectorState={state}
            onInteractionFrame={handleInteractionFrame}
          />
        </ColorProvider>
      ) : (
        <ColorProvider defaultColor="#2563eb" defaultGamut="display-p3">
          <ColorAreaDemoScene
            axes={axes}
            inspectorState={null}
            onInteractionFrame={handleInteractionFrame}
          />
        </ColorProvider>
      )}
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

  const sliderRail = useMemo(
    () => getOklchSliderRail(channel, color.requested, color.activeGamut),
    [channel, color.activeGamut, color.requested],
  );
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorSlider
        channel={channel}
        className="ck-slider ck-slider-v2"
        data-color-space={sliderRail.colorSpace}
        requested={color.requested}
        onChangeRequested={color.setRequested}
        style={sliderRail.style}
      >
        {channel === 'c' ? <ChromaMarkers /> : null}
      </ColorSlider>
      <ColorInput
        model="oklch"
        channel={channel}
        className="ck-input"
        requested={color.requested}
        onChangeRequested={color.setRequested}
      />
      <ColorDisplay
        className="ck-color-display"
        requested={color.requested}
        gamut={color.activeGamut}
      />
      {inspectorDriven ? (
        <>
          <ColorSlider
            channel="h"
            className="ck-slider ck-slider-v2"
            data-color-space={hueRail.colorSpace}
            requested={color.requested}
            onChangeRequested={color.setRequested}
            style={hueRail.style}
          />
          <ColorSlider
            channel="alpha"
            className="ck-slider ck-slider-v2"
            data-color-space={alphaRail.colorSpace}
            requested={color.requested}
            onChangeRequested={color.setRequested}
            style={alphaRail.style}
          />
        </>
      ) : null}
    </div>
  );
}

export function ColorDialDemo() {
  return (
    <ColorProvider defaultColor="#8b5cf6">
      <div className="ck-demo-stack">
        <ColorDial
          channel="h"
          className="ck-dial"
          style={{ background: DIAL_RING_BACKGROUND }}
        />
        <div className="ck-row">
          <ColorDisplay className="ck-color-display" />
          <ColorInput model="oklch" channel="h" className="ck-input" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function HueDialDemo() {
  return (
    <ColorProvider defaultColor="#ef4444">
      <div className="ck-demo-stack">
        <HueDial
          className="ck-dial"
          style={{ background: DIAL_RING_BACKGROUND }}
        />
        <div className="ck-row">
          <ColorDisplay className="ck-color-display" />
          <ColorInput model="oklch" channel="h" className="ck-input" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function ColorWheelDemo() {
  return (
    <ColorProvider defaultColor="oklch(0.62 0.26 220)">
      <div className="ck-demo-stack">
        <ColorWheel
          className="ck-wheel"
          style={{ background: WHEEL_GRADIENT }}
        />
        <div className="ck-row">
          <ColorStringInput format="oklch" className="ck-input" />
          <ColorDisplay className="ck-color-display" />
        </div>
      </div>
    </ColorProvider>
  );
}

function ColorSliderHueDemoContent() {
  const color = useColorContext();
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <div className="ck-row">
        <ColorDisplay className="ck-color-display" />
        <ColorStringInput className="ck-input" />
      </div>
    </div>
  );
}

export function ColorSliderHueDemo() {
  return (
    <ColorProvider defaultColor="#ef4444">
      <ColorSliderHueDemoContent />
    </ColorProvider>
  );
}

function ColorSliderAlphaDemoContent() {
  const color = useColorContext();
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorDisplay className="ck-color-display ck-checker" />
      <ColorSlider
        channel="alpha"
        className="ck-slider ck-slider-v2"
        data-color-space={alphaRail.colorSpace}
        style={alphaRail.style}
      />
      <ColorInput model="oklch" channel="alpha" className="ck-input" />
    </div>
  );
}

export function ColorSliderAlphaDemo() {
  return (
    <ColorProvider defaultColor="oklch(0.72 0.2 220 / 0.65)">
      <ColorSliderAlphaDemoContent />
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
      <ColorStringInput
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
  const inputModel = state?.model ?? 'oklch';
  const inputChannel = state?.channel ?? 'h';
  const inputGamut = state?.gamut;
  const setInputGamut = colorState.setActiveGamut;

  useEffect(() => {
    if (!inputGamut) return;
    setInputGamut(inputGamut, 'programmatic');
  }, [inputGamut, setInputGamut]);

  const primaryInput =
    inputModel === 'rgb' ? (
      <ColorInput
        className="ck-input"
        model="rgb"
        channel={
          inputChannel === 'r' ||
          inputChannel === 'g' ||
          inputChannel === 'b' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'r'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    ) : inputModel === 'hsl' ? (
      <ColorInput
        className="ck-input"
        model="hsl"
        channel={
          inputChannel === 'h' ||
          inputChannel === 's' ||
          inputChannel === 'l' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'h'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    ) : (
      <ColorInput
        className="ck-input"
        model="oklch"
        channel={
          inputChannel === 'l' ||
          inputChannel === 'c' ||
          inputChannel === 'h' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'h'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    );

  return (
    <div className="ck-demo-stack">
      {primaryInput}
      <ColorStringInput
        className="ck-input"
        format="oklch"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Legacy string input"
      />
      <ColorDisplay
        className="ck-color-display"
        requested={colorState.requested}
        gamut={state?.gamut ?? 'display-p3'}
      />
    </div>
  );
}

export function ColorStringInputDemo() {
  const colorState = useColor({ defaultColor: '#6366f1' });

  return (
    <div className="ck-demo-stack">
      <ColorStringInput
        className="ck-input"
        format="hex"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Hex string input"
      />
      <ColorStringInput
        className="ck-input"
        format="oklch"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="OKLCH string input"
      />
      <ColorDisplay
        className="ck-color-display"
        requested={colorState.requested}
        gamut={colorState.activeGamut}
      />
    </div>
  );
}

function ColorDisplayDemoContent() {
  const color = useColorContext();
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorDisplay className="ck-color-display" />
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <ColorSlider
        channel="alpha"
        className="ck-slider ck-slider-v2"
        data-color-space={alphaRail.colorSpace}
        style={alphaRail.style}
      />
    </div>
  );
}

export function ColorDisplayDemo() {
  return (
    <ColorProvider defaultColor="#10b981">
      <ColorDisplayDemoContent />
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
        <ColorStringInput
          className="ck-input"
          format="hex"
          requested={foreground.requested}
          onChangeRequested={foreground.setRequested}
          aria-label="Foreground color"
        />
        <ColorStringInput
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
