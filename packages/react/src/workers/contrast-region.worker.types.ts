import type { Color } from '@color-kit/core';
import type {
  ColorAreaContrastRegionOptions,
  ColorAreaContrastRegionPoint,
  ResolvedColorAreaAxes,
} from '../api/color-area.js';

export interface ContrastRegionWorkerRequest {
  id: number;
  reference: Color;
  hue: number;
  axes: ResolvedColorAreaAxes;
  options: ColorAreaContrastRegionOptions;
}

export interface ContrastRegionWorkerResponse {
  id: number;
  paths: ColorAreaContrastRegionPoint[][];
  error?: string;
}
