import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  COLOR_PLANE_MULTI_INPUT_FIELDS,
  ColorApi,
  ColorArea,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  DEFAULT_MULTI_INPUT_CONFIG,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  MultiInputControl,
  PanelSection,
  PropertyFieldTooltip,
  SegmentedField,
  Separator,
  ToggleField,
  alternateAxis,
  getOklchSliderRail,
  normalizeAxes,
  parsePrimitiveExpression,
  useColor,
  type ColorAreaAxes,
  type ColorAreaChannel,
  type ColorAreaPerformanceProfile,
  type MultiInputFieldId,
} from '../shared.js';
import type { LabPageDescriptor } from '../types.js';

function useColorPlaneLabPageController() {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.24 28)',
    defaultGamut: 'display-p3',
  });
  const [axisState, setAxisState] = useState<{
    x: ColorAreaChannel;
    y: ColorAreaChannel;
  }>({
    x: 'l',
    y: 'c',
  });
  const [checkerboard, setCheckerboard] = useState(false);
  const [repeatEdgePixels, setRepeatEdgePixels] = useState(false);
  const [showFallbackPoints, setShowFallbackPoints] = useState(false);
  const [showP3Boundary, setShowP3Boundary] = useState(false);
  const [showSrgbBoundary, setShowSrgbBoundary] = useState(false);
  const [performanceProfile, setPerformanceProfile] =
    useState<ColorAreaPerformanceProfile>('auto');

  const channels = useMemo(
    () => normalizeAxes(axisState.x, axisState.y),
    [axisState.x, axisState.y],
  );
  const axes = useMemo<ColorAreaAxes>(
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
    [channels.x, channels.y],
  );
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const colorPlaneMultiInputValues = useMemo<Record<MultiInputFieldId, number>>(
    () => ({
      l: color.requested.l,
      c: color.requested.c,
      h: color.requested.h,
      a: color.requested.alpha,
    }),
    [color.requested],
  );
  const setColorPlaneMultiInputFieldValue = useCallback(
    (field: MultiInputFieldId, value: number) => {
      color.setChannel(field === 'a' ? 'alpha' : field, value);
    },
    [color],
  );
  const setAxis = useCallback((axis: 'x' | 'y', channel: ColorAreaChannel) => {
    setAxisState((current) => {
      if (axis === 'x') {
        return channel === current.y
          ? { x: channel, y: alternateAxis(channel) }
          : { ...current, x: channel };
      }

      return channel === current.x
        ? { x: alternateAxis(channel), y: channel }
        : { ...current, y: channel };
    });
  }, []);

  return {
    axes,
    axisState,
    checkerboard,
    color,
    colorPlaneMultiInputValues,
    hueRail,
    performanceProfile,
    repeatEdgePixels,
    setAxis,
    setCheckerboard,
    setColorPlaneMultiInputFieldValue,
    setPerformanceProfile,
    setRepeatEdgePixels,
    setShowFallbackPoints,
    setShowP3Boundary,
    setShowSrgbBoundary,
    showFallbackPoints,
    showP3Boundary,
    showSrgbBoundary,
  };
}

type ColorPlaneLabPageController = ReturnType<
  typeof useColorPlaneLabPageController
>;

function renderColorPlanePreview(controller: ColorPlaneLabPageController) {
  return (
    <div className="relative size-[300px]">
      <ColorArea
        className="ck-color-area overflow-hidden rounded-none border border-white/10 bg-[#0c0c0d] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] [&_[data-color-area-thumb]]:hidden"
        style={{ width: 300, height: 300 }}
        axes={controller.axes}
        requested={controller.color.requested}
        onChangeRequested={controller.color.setRequested}
        performanceProfile={controller.performanceProfile}
      >
        {controller.checkerboard ? <Background checkerboard /> : null}
        <ColorPlane
          edgeBehavior={controller.repeatEdgePixels ? 'clamp' : 'transparent'}
        />
        {controller.showP3Boundary ? (
          <GamutBoundaryLayer
            gamut="display-p3"
            steps={128}
            pathProps={{
              fill: 'none',
              stroke: '#ff3b30',
              strokeWidth: 0.45,
              strokeLinejoin: 'miter',
              strokeMiterlimit: 6,
            }}
          />
        ) : null}
        {controller.showSrgbBoundary ? (
          <GamutBoundaryLayer
            gamut="srgb"
            steps={128}
            pathProps={{
              fill: 'none',
              stroke: 'rgba(255,255,255,0.88)',
              strokeWidth: 0.45,
              strokeDasharray: '1.4 1',
              strokeLinejoin: 'miter',
              strokeMiterlimit: 6,
            }}
          />
        ) : null}
        {controller.showFallbackPoints ? (
          <FallbackPointsLayer
            showP3
            showSrgb={controller.color.activeGamut === 'srgb'}
          />
        ) : null}
      </ColorArea>
    </div>
  );
}

function renderColorPlaneProperties(controller: ColorPlaneLabPageController) {
  return (
    <>
      <PanelSection title="Color" description="Drive the current sample color.">
        <div className="w-full min-w-0 max-w-full space-y-3">
          <PropertyFieldTooltip label="Hex">
            <div className="w-full min-w-0 max-w-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                Hex
              </p>
              <ColorStringInput
                format="hex"
                className="ck-input w-full min-w-0 max-w-full"
                requested={controller.color.requested}
                onChangeRequested={controller.color.setRequested}
                aria-label="Hex color input"
              />
            </div>
          </PropertyFieldTooltip>

          <PropertyFieldTooltip label="Hue">
            <div className="w-full min-w-0 max-w-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                Hue
              </p>
              <ColorSlider
                channel="h"
                className="ck-slider ck-slider-v2 w-full min-w-0 max-w-full"
                data-color-space={controller.hueRail.colorSpace}
                requested={controller.color.requested}
                onChangeRequested={controller.color.setRequested}
                style={controller.hueRail.style}
              />
            </div>
          </PropertyFieldTooltip>

          <MultiInputControl
            values={controller.colorPlaneMultiInputValues}
            config={DEFAULT_MULTI_INPUT_CONFIG}
            fields={COLOR_PLANE_MULTI_INPUT_FIELDS}
            onFieldChange={controller.setColorPlaneMultiInputFieldValue}
            parseExpression={parsePrimitiveExpression}
            showLeadingLabels
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Plane"
        description="Change the displayed gamut and the axes mapped into the square."
      >
        <div className="space-y-3">
          <SegmentedField
            label="Preview gamut"
            value={controller.color.activeGamut}
            onChange={(next) =>
              controller.color.setActiveGamut(next, 'programmatic')
            }
            options={[
              { value: 'display-p3', label: 'P3' },
              { value: 'srgb', label: 'sRGB' },
            ]}
          />
          <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-3">
            <SegmentedField
              label="X axis"
              value={controller.axisState.x}
              onChange={(next) => controller.setAxis('x', next)}
              options={[
                { value: 'l', label: 'L' },
                { value: 'c', label: 'C' },
                { value: 'h', label: 'H' },
              ]}
            />
            <SegmentedField
              label="Y axis"
              value={controller.axisState.y}
              onChange={(next) => controller.setAxis('y', next)}
              options={[
                { value: 'l', label: 'L' },
                { value: 'c', label: 'C' },
                { value: 'h', label: 'H' },
              ]}
            />
          </div>
          <ToggleField
            label="Repeat edge pixels"
            checked={controller.repeatEdgePixels}
            onChange={controller.setRepeatEdgePixels}
          />
          <ToggleField
            label="Checkerboard background"
            checked={controller.checkerboard}
            onChange={controller.setCheckerboard}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Overlays"
        description="Optional helpers for reading the active gamut geometry."
      >
        <div className="space-y-3">
          <ToggleField
            label="Display P3 boundary"
            checked={controller.showP3Boundary}
            onChange={controller.setShowP3Boundary}
          />
          <ToggleField
            label="sRGB boundary"
            checked={controller.showSrgbBoundary}
            onChange={controller.setShowSrgbBoundary}
          />
          <ToggleField
            label="Fallback points"
            checked={controller.showFallbackPoints}
            onChange={controller.setShowFallbackPoints}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Rendering"
        description="Tune how aggressively the area optimizes pointer updates."
      >
        <SegmentedField
          label="Performance profile"
          value={controller.performanceProfile}
          onChange={controller.setPerformanceProfile}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'quality', label: 'Quality' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'performance', label: 'Perf' },
          ]}
        />
      </PanelSection>
    </>
  );
}

export const colorPlaneLabPage: LabPageDescriptor<
  'plane',
  ColorPlaneLabPageController
> = {
  key: 'plane',
  label: 'ColorPlane',
  useController: useColorPlaneLabPageController,
  renderPreview: renderColorPlanePreview,
  renderProperties: renderColorPlaneProperties,
};

export type { ColorPlaneLabPageController };
