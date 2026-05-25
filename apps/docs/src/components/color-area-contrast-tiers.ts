import type { ContrastMetric } from 'color-kit';

export type ColorAreaContrastTierKey = 'aa3' | 'aa45' | 'aaa7';

export interface ColorAreaContrastTier {
  key: ColorAreaContrastTierKey;
  wcagThreshold: number;
  apcaThreshold: number;
  wcagLabel: string;
  apcaLabel: string;
  lineStroke: string;
  regionFill: string;
  regionFillOpacity: number;
}

export const COLOR_AREA_CONTRAST_TIERS = [
  {
    key: 'aa3',
    wcagThreshold: 3,
    apcaThreshold: 0.3,
    wcagLabel: '3:1 (AA)',
    apcaLabel: '0.30 Lc (UI)',
    lineStroke: '#bcd6ff',
    regionFill: '#7ca4ff',
    regionFillOpacity: 0.12,
  },
  {
    key: 'aa45',
    wcagThreshold: 4.5,
    apcaThreshold: 0.45,
    wcagLabel: '4.5:1 (AA)',
    apcaLabel: '0.45 Lc (Large)',
    lineStroke: '#c0e1ff',
    regionFill: '#c0e1ff',
    regionFillOpacity: 0.14,
  },
  {
    key: 'aaa7',
    wcagThreshold: 7,
    apcaThreshold: 0.6,
    wcagLabel: '7:1 (AAA)',
    apcaLabel: '0.60 Lc (Body)',
    lineStroke: '#d5e7ff',
    regionFill: '#dceaff',
    regionFillOpacity: 0.16,
  },
] as const satisfies readonly ColorAreaContrastTier[];

export function resolveColorAreaContrastThreshold(
  metric: ContrastMetric,
  tier: ColorAreaContrastTier,
): number {
  return metric === 'apca' ? tier.apcaThreshold : tier.wcagThreshold;
}

export function getColorAreaContrastTierLabel(
  metric: ContrastMetric,
  tier: ColorAreaContrastTier,
): string {
  return metric === 'apca' ? tier.apcaLabel : tier.wcagLabel;
}
