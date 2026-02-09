'use client';

import { forwardRef, useMemo, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { contrastRatio, meetsAA, meetsAAA } from '@color-kit/core';

export interface ContrastBadgeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
  /** Foreground (text) color */
  foreground: Color;
  /** Background color */
  background: Color;
  /**
   * Whether to evaluate for large text (>= 18pt or 14pt bold).
   * Large text has lower contrast requirements.
   * @default false
   */
  largeText?: boolean;
}

export type WcagLevel = 'AAA' | 'AA' | 'Fail';

function getWcagLevel(fg: Color, bg: Color, largeText: boolean): WcagLevel {
  if (meetsAAA(fg, bg, largeText)) return 'AAA';
  if (meetsAA(fg, bg, largeText)) return 'AA';
  return 'Fail';
}

/**
 * Displays the contrast ratio between two colors with WCAG compliance level.
 *
 * Renders as a plain `<div>` — completely unstyled.
 * Use data attributes and CSS to style it.
 *
 * Data attributes:
 * - `[data-contrast-badge]` — always present
 * - `[data-ratio]` — the contrast ratio (e.g. "4.52")
 * - `[data-level]` — WCAG level: "AAA", "AA", or "Fail"
 * - `[data-large-text]` — present when evaluating for large text
 *
 * Children receive the ratio and level as render content:
 * `{ratio}:1 {level}`
 */
export const ContrastBadge = forwardRef<HTMLDivElement, ContrastBadgeProps>(
  function ContrastBadge(
    { foreground, background, largeText = false, children, ...props },
    ref,
  ) {
    const ratio = useMemo(
      () => contrastRatio(foreground, background),
      [foreground, background],
    );

    const level = useMemo(
      () => getWcagLevel(foreground, background, largeText),
      [foreground, background, largeText],
    );

    const ratioText = ratio.toFixed(2);

    return (
      <div
        {...props}
        ref={ref}
        data-contrast-badge=""
        data-ratio={ratioText}
        data-level={level}
        data-large-text={largeText || undefined}
        role="status"
        aria-label={
          props['aria-label'] ?? `Contrast ratio ${ratioText}:1, WCAG ${level}`
        }
      >
        {children ?? `${ratioText}:1 ${level}`}
      </div>
    );
  },
);
