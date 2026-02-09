import { forwardRef, useMemo, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { getContrastBadgeSummary } from './api/contrast-badge.js';

export interface ContrastBadgeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
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
    const summary = useMemo(
      () => getContrastBadgeSummary(foreground, background, level),
      [foreground, background, level],
    );

    return (
      <div
        {...props}
        ref={ref}
        data-contrast-badge=""
        data-ratio={summary.ratio.toFixed(2)}
        data-meets-aa={String(summary.passesAA)}
        data-meets-aaa={String(summary.passesAAA)}
        data-passes={summary.passes || undefined}
        role="status"
        aria-label={`Contrast ratio: ${summary.ratioText}, ${summary.levelLabel}`}
      >
        {children ?? summary.ratioText}
      </div>
    );
  },
);
