import { parse, toCss, toP3Gamut, toSrgbGamut } from '@color-kit/core';
import {
  Background,
  ChromaBandLayer,
  ChromaMarkers,
  ColorApi,
  ColorArea,
  ColorPlane,
  ColorInput,
  ColorStringInput,
  Color,
  ColorSlider,
  ContrastRegionLayer,
  ContrastRegionFill,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  OutOfGamutLayer,
  useColorContext,
  type ColorAreaChannel,
  type ColorAreaAxes,
  type ColorAreaInteractionFrameStats,
  type ColorUpdateEvent,
  type ContrastRegionLayerMetrics,
  type ColorSliderChannel,
  type SliderHueGradientMode,
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
import { COLOR_AREA_DOT_PATTERN } from './color-area-dot-pattern.js';

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
  hueGradientMode?: SliderHueGradientMode,
): { colorSpace: 'display-p3' | 'srgb'; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel);
  const gradient = ColorApi.getSliderGradientStyles({
    model: 'oklch',
    channel,
    range,
    baseColor: requested,
    colorSpace: gamut,
    hueGradientMode,
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

function DemoDisplaySwatch({
  requested,
  gamut,
  className,
}: {
  requested: ReturnType<typeof parse>;
  gamut: 'display-p3' | 'srgb';
  className?: string;
}) {
  const srgbBackground = toCss(toSrgbGamut(requested), 'rgb');
  const activeBackground =
    gamut === 'display-p3' ? toCss(toP3Gamut(requested), 'p3') : srgbBackground;
  return (
    <div
      className={className}
      style={{
        backgroundColor: srgbBackground,
        background: activeBackground,
      }}
    />
  );
}

function ContextDisplaySwatch({ className }: { className?: string }) {
  const color = useColorContext();
  return (
    <DemoDisplaySwatch
      className={className}
      requested={color.requested}
      gamut={color.activeGamut}
    />
  );
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

function gamutBoundaryPathProps(
  control: { style: 'solid' | 'dashed' | 'dots'; width: 0.25 | 0.5 | 1 },
  stroke: string,
) {
  return {
    ...strokePathProps(control, stroke),
    // Preserve sharp boundary cusps; round joins visually shave apexes.
    strokeLinejoin: 'miter' as const,
    strokeMiterlimit: 6,
  };
}

function pathPointProps(fill: string) {
  return {
    r: 0.72,
    fill,
    stroke: 'rgba(9,12,18,0.76)',
    strokeWidth: 0.18,
  };
}

const COLOR_AREA_LINE_STEPS = 128;
const COLOR_AREA_CONTRAST_STEPS = 72;

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio)),
  );
  return sorted[index];
}

interface ColorAreaPerfSummary {
  sampleCount: number;
  frameP95Ms: number;
  updateP95Ms: number;
  droppedRate: number;
  longTaskRate: number;
}

interface ContrastMetricSample {
  key: string;
  ts: number;
  source: 'sync' | 'worker';
  requestId: number;
  computeTimeMs: number;
  pathCount: number;
  pointCount: number;
  lightnessSteps: number;
  chromaSteps: number;
  quality: 'high' | 'medium' | 'low';
  isDragging: boolean;
}

function summarizePerfFrames(
  frames: Array<ColorAreaInteractionFrameStats & { ts: number }>,
): ColorAreaPerfSummary {
  if (frames.length === 0) {
    return {
      sampleCount: 0,
      frameP95Ms: 0,
      updateP95Ms: 0,
      droppedRate: 0,
      longTaskRate: 0,
    };
  }

  const frameTimes = frames.map((frame) => frame.frameTimeMs);
  const updateTimes = frames.map((frame) => frame.updateDurationMs);
  const droppedFrames = frames.filter((frame) => frame.droppedFrame).length;
  const longTasks = frames.filter((frame) => frame.longTask).length;

  return {
    sampleCount: frames.length,
    frameP95Ms: percentile(frameTimes, 0.95),
    updateP95Ms: percentile(updateTimes, 0.95),
    droppedRate: droppedFrames / frames.length,
    longTaskRate: longTasks / frames.length,
  };
}

function contrastMetricLabel(key: string): string {
  switch (key) {
    case 'line-aa3':
      return 'Line 3:1';
    case 'line-aa45':
      return 'Line 4.5:1';
    case 'line-aaa7':
      return 'Line 7:1';
    case 'region-aa3':
      return 'Region 3:1';
    case 'region-aa45':
      return 'Region 4.5:1';
    case 'region-aaa7':
      return 'Region 7:1';
    default:
      return key;
  }
}

function ColorAreaDemoScene({
  inspectorState,
  axes,
  onInteractionFrame,
  onContrastMetrics,
}: {
  inspectorState: ColorAreaInspectorState | null;
  axes: ColorAreaAxes;
  onInteractionFrame: (stats: ColorAreaInteractionFrameStats) => void;
  onContrastMetrics?: (
    key: string,
    metrics: ContrastRegionLayerMetrics,
  ) => void;
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
      vectorPoints: false,
      p3Boundary: { enabled: false, style: 'solid', width: 0.25 as const },
      srgbBoundary: { enabled: false, style: 'dashed', width: 0.25 as const },
      patternOverlay: {
        enabled: false,
        style: 'dots',
        opacityPercent: COLOR_AREA_DOT_PATTERN.opacityPercent,
        dotSize: COLOR_AREA_DOT_PATTERN.dotSize,
        dotGap: COLOR_AREA_DOT_PATTERN.dotGap,
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
        aaa7: { enabled: false, style: 'dashed', width: 0.25 as const },
      },
      regions: {
        aa3: {
          enabled: false,
          style: 'dots',
          opacityPercent: COLOR_AREA_DOT_PATTERN.opacityPercent,
        },
        aa45: {
          enabled: false,
          style: 'dots',
          opacityPercent: COLOR_AREA_DOT_PATTERN.opacityPercent,
        },
        aaa7: {
          enabled: false,
          style: 'dots',
          opacityPercent: COLOR_AREA_DOT_PATTERN.opacityPercent,
        },
      },
    },
    tuning: {
      performanceProfile: 'auto' as const,
      layerQuality: 'auto' as const,
      lineSteps: COLOR_AREA_LINE_STEPS,
      contrastSteps: COLOR_AREA_CONTRAST_STEPS,
      contrastEdgeInterpolation: 'linear' as const,
      simplifyTolerance: undefined,
      lineSamplingMode: 'adaptive' as const,
      contrastSamplingMode: 'adaptive' as const,
    },
  };
  const lineSteps = scene.tuning.lineSteps;
  const contrastSteps = scene.tuning.contrastSteps;
  const layerQuality = scene.tuning.layerQuality;
  const contrastEdgeInterpolation = scene.tuning.contrastEdgeInterpolation;
  const simplifyTolerance = scene.tuning.simplifyTolerance;
  const lineSamplingMode = scene.tuning.lineSamplingMode ?? 'adaptive';
  const contrastSamplingMode = scene.tuning.contrastSamplingMode ?? 'adaptive';
  const cornerRadius =
    'cornerRadius' in scene.tuning ? scene.tuning.cornerRadius : undefined;
  const showPathPoints = scene.visualize.vectorPoints;

  const colorPlaneEdgeBehavior = scene.repeatEdgePixels
    ? 'clamp'
    : 'transparent';
  const patternOverlayOpacity = scene.visualize.patternOverlay.enabled
    ? scene.visualize.patternOverlay.opacityPercent / 100
    : 0;
  const outOfGamutLayerProps = {
    outOfP3FillColor: scene.background.outOfP3.color,
    outOfP3FillOpacity: scene.background.outOfP3.opacityPercent / 100,
    outOfSrgbFillColor: scene.background.outOfSrgb.color,
    outOfSrgbFillOpacity: scene.background.outOfSrgb.opacityPercent / 100,
    dotPatternOpacity: patternOverlayOpacity,
    dotPatternSize: scene.visualize.patternOverlay.dotSize,
    dotPatternGap: scene.visualize.patternOverlay.dotGap,
  };

  return (
    <>
      <ColorArea
        className="ck-color-area"
        axes={axes}
        performanceProfile={scene.tuning.performanceProfile}
        onInteractionFrame={onInteractionFrame}
      >
        <Background checkerboard={scene.background.checkerboard} />
        <ColorPlane renderer="auto" edgeBehavior={colorPlaneEdgeBehavior} />
        <OutOfGamutLayer {...outOfGamutLayerProps} />

        {scene.visualize.p3Boundary.enabled && (
          <GamutBoundaryLayer
            gamut="display-p3"
            steps={lineSteps}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={lineSamplingMode}
            cornerRadius={cornerRadius}
            pathProps={gamutBoundaryPathProps(
              scene.visualize.p3Boundary,
              '#40f5d2',
            )}
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#40f5d2')}
          />
        )}
        {scene.visualize.srgbBoundary.enabled && (
          <GamutBoundaryLayer
            gamut="srgb"
            steps={lineSteps}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={lineSamplingMode}
            cornerRadius={cornerRadius}
            pathProps={gamutBoundaryPathProps(
              scene.visualize.srgbBoundary,
              '#ffd447',
            )}
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#ffd447')}
          />
        )}

        {scene.chromaBand.p3.enabled && (
          <ChromaBandLayer
            gamut="display-p3"
            mode={scene.chromaBand.mode}
            steps={lineSteps}
            quality={layerQuality}
            samplingMode={lineSamplingMode}
            pathProps={gamutBoundaryPathProps(scene.chromaBand.p3, '#9e8cff')}
          />
        )}
        {scene.chromaBand.srgb.enabled && (
          <ChromaBandLayer
            gamut="srgb"
            mode={scene.chromaBand.mode}
            steps={lineSteps}
            quality={layerQuality}
            samplingMode={lineSamplingMode}
            pathProps={gamutBoundaryPathProps(scene.chromaBand.srgb, '#ffe06b')}
          />
        )}

        {scene.contrast.lines.aa3.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={3}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('line-aa3', metrics)
            }
            pathProps={gamutBoundaryPathProps(
              scene.contrast.lines.aa3,
              '#bcd6ff',
            )}
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#bcd6ff')}
          />
        )}
        {scene.contrast.lines.aa45.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={4.5}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('line-aa45', metrics)
            }
            pathProps={gamutBoundaryPathProps(
              scene.contrast.lines.aa45,
              '#c0e1ff',
            )}
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#c0e1ff')}
          />
        )}
        {scene.contrast.lines.aaa7.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={7}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('line-aaa7', metrics)
            }
            pathProps={gamutBoundaryPathProps(
              scene.contrast.lines.aaa7,
              '#d5e7ff',
            )}
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#d5e7ff')}
          />
        )}

        {scene.contrast.regions.aa3.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={3}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('region-aa3', metrics)
            }
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#7ca4ff')}
          >
            <ContrastRegionFill
              fillColor="#7ca4ff"
              fillOpacity={0.12}
              dotOpacity={scene.contrast.regions.aa3.opacityPercent / 100}
              dotSize={COLOR_AREA_DOT_PATTERN.dotSize}
              dotGap={COLOR_AREA_DOT_PATTERN.dotGap}
            />
          </ContrastRegionLayer>
        )}
        {scene.contrast.regions.aa45.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={4.5}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('region-aa45', metrics)
            }
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#c0e1ff')}
          >
            <ContrastRegionFill
              fillColor="#c0e1ff"
              fillOpacity={0.14}
              dotOpacity={scene.contrast.regions.aa45.opacityPercent / 100}
              dotSize={COLOR_AREA_DOT_PATTERN.dotSize}
              dotGap={COLOR_AREA_DOT_PATTERN.dotGap}
            />
          </ContrastRegionLayer>
        )}
        {scene.contrast.regions.aaa7.enabled && (
          <ContrastRegionLayer
            gamut={scene.gamut}
            threshold={7}
            lightnessSteps={contrastSteps}
            chromaSteps={contrastSteps}
            edgeInterpolation={contrastEdgeInterpolation}
            quality={layerQuality}
            simplifyTolerance={simplifyTolerance}
            samplingMode={contrastSamplingMode}
            cornerRadius={cornerRadius}
            onMetrics={(metrics: ContrastRegionLayerMetrics) =>
              onContrastMetrics?.('region-aaa7', metrics)
            }
            showPathPoints={showPathPoints}
            pointProps={pathPointProps('#dceaff')}
          >
            <ContrastRegionFill
              fillColor="#dceaff"
              fillOpacity={0.16}
              dotOpacity={scene.contrast.regions.aaa7.opacityPercent / 100}
              dotSize={COLOR_AREA_DOT_PATTERN.dotSize}
              dotGap={COLOR_AREA_DOT_PATTERN.dotGap}
            />
          </ContrastRegionLayer>
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
        <ContextDisplaySwatch className="ck-color-display" />
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
        <ContextDisplaySwatch className="ck-color-display" />
      </div>
    </div>
  );
}

export function ColorProviderDemo() {
  return (
    <Color defaultColor="#3b82f6">
      <ColorProviderDemoContent />
    </Color>
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
  const [perfSummary, setPerfSummary] = useState<ColorAreaPerfSummary>(() =>
    summarizePerfFrames([]),
  );
  const [contrastMetrics, setContrastMetrics] = useState<
    ContrastMetricSample[]
  >([]);
  const perfFramesRef = useRef<
    Array<ColorAreaInteractionFrameStats & { ts: number }>
  >([]);
  const contrastMetricsRef = useRef<Record<string, ContrastMetricSample>>({});
  const perfUiUpdateTsRef = useRef(0);
  const perfSummaryUpdateTsRef = useRef(0);
  const contrastMetricsUpdateTsRef = useRef(0);
  const handleInteractionFrame = useCallback(
    (stats: ColorAreaInteractionFrameStats) => {
      const now = Date.now();
      perfFramesRef.current.push({
        ...stats,
        ts: now,
      });
      if (perfFramesRef.current.length > 240) {
        perfFramesRef.current.shift();
      }

      if (now - perfUiUpdateTsRef.current >= 120) {
        perfUiUpdateTsRef.current = now;
        setPerfFrame(stats);
      }
      if (now - perfSummaryUpdateTsRef.current >= 220) {
        perfSummaryUpdateTsRef.current = now;
        setPerfSummary(summarizePerfFrames(perfFramesRef.current));
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
  const handleContrastMetrics = useCallback(
    (key: string, metrics: ContrastRegionLayerMetrics) => {
      const now = Date.now();
      contrastMetricsRef.current[key] = {
        ...metrics,
        key,
        ts: now,
      };

      if (now - contrastMetricsUpdateTsRef.current >= 160) {
        contrastMetricsUpdateTsRef.current = now;
        setContrastMetrics(
          Object.values(contrastMetricsRef.current).sort((a, b) =>
            a.key.localeCompare(b.key),
          ),
        );
      }
    },
    [],
  );

  return (
    <div className="ck-demo-stack">
      {state && setColorAreaColorState ? (
        <Color
          state={state.colorState}
          onChange={(event: ColorUpdateEvent) =>
            setColorAreaColorState(event.next)
          }
        >
          <ColorAreaDemoScene
            axes={axes}
            inspectorState={state}
            onInteractionFrame={handleInteractionFrame}
            onContrastMetrics={handleContrastMetrics}
          />
        </Color>
      ) : (
        <Color defaultColor="#2563eb" defaultGamut="display-p3">
          <ColorAreaDemoScene
            axes={axes}
            inspectorState={null}
            onInteractionFrame={handleInteractionFrame}
            onContrastMetrics={handleContrastMetrics}
          />
        </Color>
      )}
      <div className="ck-caption ck-perf-caption">
        <div>
          Profile: {state?.tuning.performanceProfile ?? 'auto'} · Overlay:{' '}
          {state?.tuning.layerQuality ?? 'auto'} · Interp:{' '}
          {state?.tuning.contrastEdgeInterpolation ?? 'linear'}
        </div>
        <div>
          Quality: {perfFrame?.qualityLevel ?? 'high'} · frame p95{' '}
          {perfSummary.sampleCount > 0
            ? `${perfSummary.frameP95Ms.toFixed(2)}ms`
            : '--'}{' '}
          · update p95{' '}
          {perfSummary.sampleCount > 0
            ? `${perfSummary.updateP95Ms.toFixed(2)}ms`
            : '--'}{' '}
          · dropped {(perfSummary.droppedRate * 100).toFixed(1)}% · long{' '}
          {(perfSummary.longTaskRate * 100).toFixed(1)}% · coalesced{' '}
          {perfFrame?.coalescedCount ?? 0}
        </div>
        {contrastMetrics.length > 0 ? (
          <div className="ck-perf-list">
            {contrastMetrics.map((metric) => (
              <span key={metric.key} className="ck-perf-pill">
                {contrastMetricLabel(metric.key)} {metric.quality}{' '}
                {metric.lightnessSteps}x{metric.chromaSteps} ·{' '}
                {metric.source === 'worker' ? 'worker' : 'sync'}{' '}
                {metric.computeTimeMs.toFixed(2)}ms · {metric.pathCount} paths /{' '}
                {metric.pointCount} pts
              </span>
            ))}
          </div>
        ) : null}
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
      <DemoDisplaySwatch
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
        <ContextDisplaySwatch className="ck-color-display" />
        <ColorStringInput className="ck-input" />
      </div>
    </div>
  );
}

export function ColorSliderHueDemo() {
  return (
    <Color defaultColor="#ef4444">
      <ColorSliderHueDemoContent />
    </Color>
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
      <ContextDisplaySwatch className="ck-color-display ck-checker" />
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
    <Color defaultColor="oklch(0.72 0.2 220 / 0.65)">
      <ColorSliderAlphaDemoContent />
    </Color>
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
      <DemoDisplaySwatch
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
      <DemoDisplaySwatch
        className="ck-color-display"
        requested={colorState.requested}
        gamut={colorState.activeGamut}
      />
    </div>
  );
}
