import type { ShikiTransformer, ThemeRegistrationRaw } from 'shiki';

/**
 * A Shiki theme whose colors are CSS custom properties, so a single
 * highlighted HTML output serves both the light and dark themes. Shiki
 * normalizes theme colors, so the theme uses placeholder hex values that
 * `cssVariablesColorReplacements` swaps for `var(--shiki-…)` on output.
 * The variables themselves are defined in `src/styles/tokens.ts`.
 */
const VARIABLES = [
  'foreground',
  'background',
  'token-keyword',
  'token-function',
  'token-constant',
  'token-parameter',
  'token-string',
  'token-string-expression',
  'token-punctuation',
  'token-link',
  'token-comment',
] as const;

type Variable = (typeof VARIABLES)[number];

const placeholder = Object.fromEntries(
  VARIABLES.map((name, index) => [
    name,
    `#0000${(index + 1).toString(16).padStart(2, '0')}`,
  ]),
) as Record<Variable, string>;

export const cssVariablesColorReplacements: Record<string, string> =
  Object.fromEntries(
    VARIABLES.map((name) => [placeholder[name], `var(--shiki-${name})`]),
  );

export const cssVariablesTheme: ThemeRegistrationRaw = {
  name: 'color-kit-css-variables',
  type: 'light',
  colors: {
    'editor.foreground': placeholder.foreground,
    'editor.background': placeholder.background,
  },
  settings: [
    {
      settings: {
        foreground: placeholder.foreground,
        background: placeholder.background,
      },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: placeholder['token-comment'] },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'storage.modifier',
        'keyword.operator.new',
        'keyword.control',
        'variable.language',
      ],
      settings: { foreground: placeholder['token-keyword'] },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'meta.function-call',
        'entity.name.type',
        'entity.name.class',
        'support.class',
        'entity.other.inherited-class',
        'entity.name.tag',
        'support.class.component',
      ],
      settings: { foreground: placeholder['token-function'] },
    },
    {
      scope: [
        'constant',
        'constant.numeric',
        'constant.language',
        'variable.other.constant',
        'support.constant',
        'support.type.property-name',
        'meta.object-literal.key',
        'entity.other.attribute-name',
      ],
      settings: { foreground: placeholder['token-constant'] },
    },
    {
      scope: ['variable.parameter'],
      settings: { foreground: placeholder['token-parameter'] },
    },
    {
      scope: ['string', 'string.quoted', 'markup.inline.raw'],
      settings: { foreground: placeholder['token-string'] },
    },
    {
      scope: [
        'string.template',
        'string.regexp',
        'punctuation.definition.template-expression',
      ],
      settings: { foreground: placeholder['token-string-expression'] },
    },
    {
      scope: [
        'punctuation',
        'meta.brace',
        'keyword.operator',
        'punctuation.separator',
        'punctuation.terminator',
      ],
      settings: { foreground: placeholder['token-punctuation'] },
    },
    {
      scope: ['markup.underline.link', 'string.other.link'],
      settings: { foreground: placeholder['token-link'] },
    },
  ],
};

/**
 * Carries fenced-code metadata onto the `<pre>`: `data-lang`, plus
 * `data-title` from a `title="file.ts"` meta string. The MDX `pre` renderer
 * reads both to draw the filename tab.
 */
export const codeMetaTransformer: ShikiTransformer = {
  name: 'color-kit:code-meta',
  pre(node) {
    node.properties['data-lang'] = this.options.lang;
    const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw;
    const title = raw ? /title="([^"]+)"/.exec(raw)?.[1] : undefined;
    if (title) {
      node.properties['data-title'] = title;
    }
    // Surfaces come from tokens, not inline theme colors.
    delete node.properties.style;
  },
};
