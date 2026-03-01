import { parse } from '@color-kit/core';
import {
  Background,
  Color,
  ColorApi,
  ColorArea,
  ColorPlane,
  ContrastRegionFill,
  ContrastRegionLayer,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  useColorContext,
} from '@color-kit/react';
import { useMemo } from 'react';

const DEFAULT_COLOR = parse('#3b82f6');
const PLANE_AXES = ColorApi.resolveColorAreaAxes({
  x: { channel: 'l' },
  y: { channel: 'c' },
});

function PlaneDrivenArea() {
  const color = useColorContext();

  const p3Boundary = useMemo(
    () =>
      ColorApi.getColorAreaGamutBoundaryPoints(color.requested.h, PLANE_AXES, {
        gamut: 'display-p3',
        samplingMode: 'adaptive',
        steps: 72,
      }),
    [color.requested],
  );

  const aa45Region = useMemo(
    () =>
      ColorApi.getColorAreaContrastRegionPaths(
        parse('#ffffff'),
        color.requested.h,
        PLANE_AXES,
        {
          threshold: 4.5,
          gamut: color.activeGamut,
          samplingMode: 'adaptive',
          lightnessSteps: 64,
          chromaSteps: 64,
        },
      ),
    [color.activeGamut, color.requested],
  );

  const p3Fallback = useMemo(
    () =>
      ColorApi.getColorAreaFallbackPoint(PLANE_AXES, {
        color: color.requested,
        gamut: 'display-p3',
      }),
    [color.requested],
  );

  const srgbFallback = useMemo(
    () =>
      ColorApi.getColorAreaFallbackPoint(PLANE_AXES, {
        color: color.requested,
        gamut: 'srgb',
      }),
    [color.requested],
  );

  return (
    <ColorArea axes={PLANE_AXES} className="ck-color-area">
      <Background checkerboard />
      <ColorPlane edgeBehavior="clamp" />
      <GamutBoundaryLayer
        points={p3Boundary}
        pathProps={{
          fill: 'none',
          stroke: '#44f1d5',
          strokeWidth: 0.55,
          strokeLinejoin: 'miter',
        }}
      />
      <ContrastRegionLayer
        paths={aa45Region}
        pathProps={{
          fill: 'none',
          stroke: '#9cc0ff',
          strokeWidth: 0.45,
        }}
      >
        <ContrastRegionFill
          fillColor="#b7d4ff"
          fillOpacity={0.12}
          dotOpacity={0.16}
        />
      </ContrastRegionLayer>
      <FallbackPointsLayer
        p3Point={p3Fallback}
        srgbPoint={srgbFallback}
        showP3
        showSrgb
      />
    </ColorArea>
  );
}

export function PlaneLayerIntegrationDemo() {
  return (
    <Color defaultColor={DEFAULT_COLOR}>
      <PlaneDrivenArea />
    </Color>
  );
}
