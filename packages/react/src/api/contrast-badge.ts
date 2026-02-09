import type { Color } from '@color-kit/core';
import { contrastRatio, meetsAA, meetsAAA } from '@color-kit/core';

export interface ContrastBadgeSummary {
  ratio: number;
  ratioText: string;
  passesAA: boolean;
  passesAAA: boolean;
  passes: boolean;
  levelLabel: string;
}

export function getContrastBadgeSummary(
  foreground: Color,
  background: Color,
  level: 'AA' | 'AAA' = 'AA',
): ContrastBadgeSummary {
  const ratio = contrastRatio(foreground, background);
  const passesAA = meetsAA(foreground, background);
  const passesAAA = meetsAAA(foreground, background);
  const passes = level === 'AAA' ? passesAAA : passesAA;
  const ratioText = `${ratio.toFixed(1)}:1`;

  const levelLabel =
    level === 'AAA'
      ? `WCAG AAA: ${passesAAA ? 'pass' : 'fail'}`
      : `WCAG AA: ${passesAA ? 'pass' : 'fail'}`;

  return {
    ratio,
    ratioText,
    passesAA,
    passesAAA,
    passes,
    levelLabel,
  };
}
