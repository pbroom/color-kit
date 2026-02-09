import { forwardRef, useMemo, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { contrastRatio, meetsAA, meetsAAA } from '@color-kit/core';

export interface ContrastBadgeProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'> {
  /** Text/foreground color */
  foreground: Color;
  /** Background color */
  background: Color;
  /**
   * WCAG conformance level to check.
   * @default 'AA'
   */
  level?: 'AA' | 'AAA';
}

/**
 * Displays the contrast ratio between two colors with WCAG compliance indicators.
 *
 * Renders as a `<div>` showing the ratio and compliance status.
 * Completely unstyled — use data attributes and CSS to style it.
 *
 * Data attributes:
 * - `[data-contrast-badge]` — always present
 * - `[data-ratio]` — contrast ratio (2 decimal places)
 * - `[data-meets-aa]` — "true" or "false"
 * - `[data-meets-aaa]` — "true" or "false"
 * - `[data-passes]` — present when the selected level passes
 */
export const ContrastBadge = forwardRef<HTMLDivElement, ContrastBadgeProps>(
  function ContrastBadge(
    { foreground, background, level = 'AA', children, ...props },
    ref,
  ) {
    const ratio = useMemo(
      () => contrastRatio(foreground, background),
      [foreground, background],
    );

    const passesAA = useMemo(
      () => meetsAA(foreground, background),
      [foreground, background],
    );

    const passesAAA = useMemo(
      () => meetsAAA(foreground, background),
      [foreground, background],
    );

    const passes = level === 'AAA' ? passesAAA : passesAA;
    const ratioFixed1 = `${ratio.toFixed(1)}:1`;

    const levelLabel = level === 'AAA'
      ? `WCAG AAA: ${passesAAA ? 'pass' : 'fail'}`
      : `WCAG AA: ${passesAA ? 'pass' : 'fail'}`;

    return (
      <div
        {...props}
        ref={ref}
        data-contrast-badge=""
        data-ratio={ratio.toFixed(2)}
        data-meets-aa={String(passesAA)}
        data-meets-aaa={String(passesAAA)}
        data-passes={passes || undefined}
        role="status"
        aria-label={`Contrast ratio: ${ratioFixed1}, ${levelLabel}`}
      >
        {children ?? ratioFixed1}
      </div>
    );
  },
);
