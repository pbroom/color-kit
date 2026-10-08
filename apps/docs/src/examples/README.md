# Docs examples

Every example on the site is a real file in this folder, written the way a
user would write it: it imports `color-kit`, `color-kit/plane`,
`color-kit/react` and so on (resolved to package source), and it is
type-checked, linted and tested with the site. Pages show the file itself, so
the code on the page is the code that ran.

```
src/examples/<entry>/<name>.tsx   live example: default-exports a component
src/examples/<entry>/<name>.ts    snippet: top-level statements with // →
```

`<entry>` is the API entry the example teaches: `core`, `plane`, `interop`,
`compute`, `hct`, `driver`, `react`, or `guides` for cross-cutting recipes.

## Live examples

Default-export one component. Render it with its source:

```mdx
import QuickStart from '@/examples/plane/quick-start';
import * as quickStart from '@/examples/plane/quick-start.tsx?highlighted';

<Example of={QuickStart} source={quickStart} />
```

`?highlighted` turns the file into build-time Shiki HTML (`default`), plus
`code` and `filename`; no highlighter ships to the browser. `<Example>` also
accepts `title`, `minHeight` (reserve space for a canvas), `breakout={false}`
and `collapseAfter` (lines shown before "Show all", default 28).

Examples must prerender: nothing in render may touch `window`, `document` or
canvas. Put that work in effects, and use `useSyncExternalStore` with a
server snapshot for media queries. `examples.test.tsx` renders every default
export to a string to enforce this.

## `// →` results

In a snippet file, end a top-level statement with `// →` (or put `// →` on
the next line). The build runs the file in Node against color-kit source and
writes the value into the comment, so results are computed, never typed:

```ts
import { inSrgbGamut, parse, toHex, toSrgbGamut } from 'color-kit';

const requested = parse('oklch(0.62 0.23 285)');
inSrgbGamut(requested); // →
toHex(toSrgbGamut(requested)); // →
```

renders as

```ts
inSrgbGamut(requested); // → false
toHex(toSrgbGamut(requested)); // → '#7f68ff'
```

- Mark expression statements (the value shown is the expression's) or a
  single `const name = …` (the value shown is `name`). Anything else is a
  build error.
- Values print as JS literals. Numbers round to 4 decimals; a result that was
  rounded gets a leading `≈`. Arrays show their first 6 items.
- A result that would push the line past 80 columns moves to its own line
  below the statement.
- Text after the arrow is overwritten, so a stale hand-written value cannot
  survive a build.
- Show a snippet with `<CodeBlock html={html} code={code} filename={filename} />`
  from a `?highlighted` import. Snippets are not imported as modules; ESLint
  allows bare expressions in `src/examples/**/*.ts` for this reason.

The implementation is `plugins/eval-example.ts`, called from
`plugins/highlight.ts`.

## Build-time values: `?build`

`import value from './file.ts?build'` runs `file.ts` in Node at build time and
inlines its exports as JSON. The home hero uses it for its first frame
(`src/components/hero/initial-frame.ts`), so the prerendered SVG and the
hydrating client read identical data while `color-kit/plane` loads lazily.
Exports must be JSON-serializable; cast the import to the producer's type.
