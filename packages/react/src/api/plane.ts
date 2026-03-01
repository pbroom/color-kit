import type { Color, GamutTarget } from '@color-kit/core';
import {
  colorToPlane,
  createPlaneQuery,
  planeToColor,
  type PlaneChromaBandQuery,
  type PlaneContrastRegionQuery,
  type PlaneDefinition,
  type PlaneFallbackPointQuery,
  type PlaneGamutBoundaryQuery,
  type PlanePoint,
  type ResolvedPlaneDefinition,
  resolvePlaneDefinition,
} from '@color-kit/core';
import type { ResolvedColorAreaAxes } from './color-area.js';

export interface ColorAreaPlanePoint {
  x: number;
  y: number;
}

export interface ColorAreaPlaneBoundaryPoint extends ColorAreaPlanePoint {
  l: number;
  c: number;
}

export interface ColorAreaPlaneFallbackPoint extends ColorAreaPlanePoint {
  color: Color;
  gamut: GamutTarget;
}

function toPlaneDefinition(
  axes: ResolvedColorAreaAxes,
  reference: Color,
): ResolvedPlaneDefinition {
  return resolvePlaneDefinition({
    model: 'oklch',
    x: {
      channel: axes.x.channel,
      range: axes.x.range,
    },
    y: {
      channel: axes.y.channel,
      range: axes.y.range,
    },
    fixed: {
      l: reference.l,
      c: reference.c,
      h: reference.h,
      alpha: reference.alpha,
    },
  });
}

function planeToUiPoint(point: PlanePoint): ColorAreaPlanePoint {
  return {
    x: point.x,
    y: 1 - point.y,
  };
}

function uiToPlanePoint(point: ColorAreaPlanePoint): PlanePoint {
  return {
    x: point.x,
    y: 1 - point.y,
  };
}

export function createColorAreaPlane(
  axes: ResolvedColorAreaAxes,
  reference: Color,
): PlaneDefinition {
  return {
    model: 'oklch',
    x: {
      channel: axes.x.channel,
      range: axes.x.range,
    },
    y: {
      channel: axes.y.channel,
      range: axes.y.range,
    },
    fixed: {
      l: reference.l,
      c: reference.c,
      h: reference.h,
      alpha: reference.alpha,
    },
  };
}

export function getColorAreaPlaneThumbPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
  reference: Color = color,
): ColorAreaPlanePoint {
  const plane = toPlaneDefinition(axes, reference);
  return planeToUiPoint(colorToPlane(plane, color));
}

export function colorFromColorAreaPlanePosition(
  point: ColorAreaPlanePoint,
  axes: ResolvedColorAreaAxes,
  reference: Color,
): Color {
  const plane = toPlaneDefinition(axes, reference);
  return planeToColor(plane, uiToPlanePoint(point));
}

export function getColorAreaPlaneGamutBoundaryPoints(
  reference: Color,
  axes: ResolvedColorAreaAxes,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): ColorAreaPlaneBoundaryPoint[] {
  const plane = toPlaneDefinition(axes, reference);
  const boundary = createPlaneQuery(plane).gamutBoundary(query);
  return boundary.points.map((point) => {
    const uiPoint = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: uiPoint.x,
      y: uiPoint.y,
    };
  });
}

export function getColorAreaPlaneContrastRegionPaths(
  reference: Color,
  axes: ResolvedColorAreaAxes,
  query: Omit<PlaneContrastRegionQuery, 'kind'>,
): ColorAreaPlaneBoundaryPoint[][] {
  const plane = toPlaneDefinition(axes, reference);
  const region = createPlaneQuery(plane).contrastRegion(query);
  return region.paths.map((path) =>
    path.map((point) => {
      const uiPoint = planeToUiPoint(point);
      return {
        l: point.l,
        c: point.c,
        x: uiPoint.x,
        y: uiPoint.y,
      };
    }),
  );
}

export function getColorAreaPlaneChromaBandPoints(
  reference: Color,
  axes: ResolvedColorAreaAxes,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): ColorAreaPlaneBoundaryPoint[] {
  const plane = toPlaneDefinition(axes, reference);
  const band = createPlaneQuery(plane).chromaBand(query);
  return band.points.map((point) => {
    const uiPoint = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: uiPoint.x,
      y: uiPoint.y,
    };
  });
}

export function getColorAreaPlaneFallbackPoint(
  axes: ResolvedColorAreaAxes,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): ColorAreaPlaneFallbackPoint {
  const plane = toPlaneDefinition(axes, query.color);
  const fallback = createPlaneQuery(plane).fallbackPoint(query);
  const uiPoint = planeToUiPoint(fallback.point);
  return {
    x: uiPoint.x,
    y: uiPoint.y,
    color: fallback.point.color,
    gamut: fallback.gamut,
  };
}
