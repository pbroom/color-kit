/**
 * Design tokens for the docs site, generated into `tokens.css` with color-kit.
 *
 * The chrome is achromatic: every neutral sits at OKLCH chroma 0, so a swatch
 * placed on any surface reads true. The only hue is one display-p3 accent,
 * reserved for focus and the current location. sRGB fallbacks come from
 * `toSrgbGamut` + `toCss`; displays that report `(color-gamut: p3)` get the
 * exact `display-p3` value from `toP3Gamut`.
 *
 * Regenerate with `pnpm --filter @color-kit/docs tokens`. `tokens.test.ts`
 * fails when `tokens.css` drifts from this file or a contrast pair regresses.
 */
import {
  inSrgbGamut,
  toCss,
  toP3Gamut,
  toSrgbGamut,
  type Color,
} from 'color-kit';

export type ThemeName = 'light' | 'dark';

function oklch(l: number, c = 0, h = 0): Color {
  return { l, c, h, alpha: 1 };
}

/**
 * OKLCH lightness of the achromatic ramp `--gray-0` … `--gray-12`.
 * Step 0 is the canvas and 12 is the strongest ink, in both themes.
 */
export const GRAY_LIGHTNESS: Record<ThemeName, readonly number[]> = {
  light: [
    0.995, 0.979, 0.963, 0.944, 0.92, 0.885, 0.79, 0.69, 0.6, 0.53, 0.45, 0.32,
    0.2,
  ],
  dark: [
    0.17, 0.195, 0.222, 0.25, 0.28, 0.315, 0.4, 0.5, 0.6, 0.7, 0.78, 0.88,
    0.965,
  ],
};

/** The single accent: a display-p3 violet, used for focus and "you are here". */
export const ACCENT: Record<ThemeName, Color> = {
  light: oklch(0.63, 0.25, 285),
  dark: oklch(0.7, 0.2, 285),
};

/** Semantic aliases. Components only read these, never raw ramp steps. */
export const SEMANTIC_COLORS = {
  '--bg': 'var(--gray-0)',
  '--bg-subtle': 'var(--gray-1)',
  '--bg-hover': 'var(--gray-2)',
  '--bg-active': 'var(--gray-3)',
  '--line': 'var(--gray-4)',
  '--line-strong': 'var(--gray-5)',
  '--control': 'var(--gray-8)',
  '--fg': 'var(--gray-12)',
  '--fg-2': 'var(--gray-11)',
  '--fg-3': 'var(--gray-10)',
  '--fg-4': 'var(--gray-9)',
  '--accent': 'var(--accent-color)',
  '--focus-ring-color': 'var(--accent-color)',
  '--code-bg': 'var(--gray-1)',
  // Shiki CSS-variables theme: one highlighted HTML output serves both themes.
  // Syntax is ink weight, not hue, so color in code samples is always data.
  '--shiki-foreground': 'var(--gray-12)',
  '--shiki-background': 'var(--gray-1)',
  '--shiki-token-keyword': 'var(--gray-12)',
  '--shiki-token-function': 'var(--gray-12)',
  '--shiki-token-constant': 'var(--gray-11)',
  '--shiki-token-parameter': 'var(--gray-11)',
  '--shiki-token-string': 'var(--gray-10)',
  '--shiki-token-string-expression': 'var(--gray-10)',
  '--shiki-token-punctuation': 'var(--gray-10)',
  '--shiki-token-link': 'var(--gray-11)',
  '--shiki-token-comment': 'var(--gray-9)',
} as const;

export type SemanticColor = keyof typeof SEMANTIC_COLORS;

/**
 * Every foreground/background pairing the UI actually renders, with the WCAG
 * 2 minimum it must meet: 4.5 for text, 3 for UI (control borders, focus ring,
 * the accent marker). `tokens.test.ts` measures each with `contrastRatio`.
 */
export const CONTRAST_PAIRS: ReadonlyArray<{
  fg: SemanticColor;
  bg: SemanticColor;
  min: 4.5 | 3;
}> = [
  ...(['--fg', '--fg-2', '--fg-3'] as const).flatMap((fg) =>
    (['--bg', '--bg-subtle', '--bg-hover', '--bg-active'] as const).map(
      (bg) => ({ fg, bg, min: 4.5 as const }),
    ),
  ),
  { fg: '--fg-4', bg: '--bg', min: 4.5 },
  { fg: '--fg-4', bg: '--bg-subtle', min: 4.5 },
  { fg: '--fg-4', bg: '--bg-hover', min: 4.5 },
  { fg: '--shiki-token-comment', bg: '--code-bg', min: 4.5 },
  { fg: '--shiki-token-string', bg: '--code-bg', min: 4.5 },
  { fg: '--shiki-foreground', bg: '--code-bg', min: 4.5 },
  { fg: '--control', bg: '--bg', min: 3 },
  { fg: '--control', bg: '--bg-subtle', min: 3 },
  { fg: '--accent', bg: '--bg', min: 3 },
  { fg: '--accent', bg: '--bg-subtle', min: 3 },
  { fg: '--accent', bg: '--bg-active', min: 3 },
  { fg: '--focus-ring-color', bg: '--bg', min: 3 },
];

/** Resolve a semantic token to its OKLCH color in a theme. */
export function resolveToken(name: string, theme: ThemeName): Color {
  const value: string | undefined =
    SEMANTIC_COLORS[name as SemanticColor] ?? `var(${name})`;
  const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (!ref) {
    throw new Error(`Token ${name} is not a color reference`);
  }
  if (ref === '--accent-color') {
    return ACCENT[theme];
  }
  const step = /^--gray-(\d+)$/.exec(ref)?.[1];
  if (step == null) {
    return resolveToken(ref, theme);
  }
  return oklch(GRAY_LIGHTNESS[theme][Number(step)]!);
}

const TYPE_AND_LAYOUT: Record<string, string> = {
  '--font-sans':
    "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  '--font-mono':
    "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  // Type scale 13 / 15 / 17 / 22 / 30 / 48.
  '--text-1': '0.8125rem',
  '--text-2': '0.9375rem',
  '--text-3': '1.0625rem',
  '--text-4': '1.375rem',
  '--text-5': '1.875rem',
  '--text-6': '3rem',
  '--leading-body': '1.6',
  '--leading-code': '1.55',
  '--leading-tight': '1.25',
  '--leading-display': '1.04',
  '--tracking-display': '-0.025em',
  '--tracking-heading': '-0.012em',
  // 4 px spacing scale.
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '20px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--space-10': '40px',
  '--space-12': '48px',
  '--space-16': '64px',
  '--space-24': '96px',
  '--radius': '6px',
  '--hairline': '1px',
  // Grid.
  '--header-h': '52px',
  '--nav-w': '248px',
  '--prose-w': '680px',
  '--wide-w': '920px',
  '--outline-w': '200px',
  // Focus ring.
  '--focus-ring-width': '2px',
  '--focus-ring-offset': '2px',
  '--focus-ring': 'var(--focus-ring-width) solid var(--focus-ring-color)',
  // Motion. Collapsed to 0 under prefers-reduced-motion.
  '--ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  '--duration-1': '120ms',
  '--duration-2': '200ms',
  '--duration-3': '280ms',
};

function srgbCss(color: Color): string {
  return toCss(toSrgbGamut(color), 'hex');
}

function themeColorDeclarations(theme: ThemeName): string[] {
  const lines = GRAY_LIGHTNESS[theme].map(
    (l, step) => `--gray-${step}: ${srgbCss(oklch(l))};`,
  );
  lines.push(`--accent-color: ${srgbCss(ACCENT[theme])};`);
  return lines;
}

function p3Overrides(theme: ThemeName): string[] {
  const color = ACCENT[theme];
  if (inSrgbGamut(color)) {
    return [];
  }
  return [`--accent-color: ${toCss(toP3Gamut(color), 'display-p3')};`];
}

function rule(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}`;
}

function media(query: string, rules: string[]): string {
  const body = rules
    .map((r) =>
      r
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    )
    .join('\n');
  return `@media ${query} {\n${body}\n}`;
}

const DARK_SELECTOR = ":root[data-theme='dark']";
// No-JS fallback: follow the OS until the pre-paint script sets data-theme.
const DARK_SYSTEM_SELECTOR = ':root:not([data-theme])';

/** Render `tokens.css`. Pure and deterministic; the test diffs it. */
export function renderTokensCss(): string {
  const semantic = Object.entries(SEMANTIC_COLORS).map(
    ([name, value]) => `${name}: ${value};`,
  );
  const scale = Object.entries(TYPE_AND_LAYOUT).map(
    ([name, value]) => `${name}: ${value};`,
  );
  const dark = ['color-scheme: dark;', ...themeColorDeclarations('dark')];
  const parts = [
    '/* Generated by src/styles/tokens.ts. Do not edit; run `pnpm --filter @color-kit/docs tokens`. */',
    rule(':root', [
      'color-scheme: light;',
      ...themeColorDeclarations('light'),
      ...semantic,
      ...scale,
    ]),
    rule(DARK_SELECTOR, dark),
    media('(prefers-color-scheme: dark)', [rule(DARK_SYSTEM_SELECTOR, dark)]),
  ];
  const lightP3 = p3Overrides('light');
  const darkP3 = p3Overrides('dark');
  const p3Rules: string[] = [];
  if (lightP3.length > 0) p3Rules.push(rule(':root', lightP3));
  if (darkP3.length > 0) p3Rules.push(rule(DARK_SELECTOR, darkP3));
  if (p3Rules.length > 0) parts.push(media('(color-gamut: p3)', p3Rules));
  if (darkP3.length > 0) {
    parts.push(
      media('(color-gamut: p3) and (prefers-color-scheme: dark)', [
        rule(DARK_SYSTEM_SELECTOR, darkP3),
      ]),
    );
  }
  parts.push(
    media('(prefers-reduced-motion: reduce)', [
      rule(':root', [
        '--duration-1: 0ms;',
        '--duration-2: 0ms;',
        '--duration-3: 0ms;',
      ]),
    ]),
  );
  return `${parts.join('\n\n')}\n`;
}
