declare module '*.mdx' {
  import type { ComponentType, JSX } from 'react';

  /** YAML frontmatter, exported by remark-mdx-frontmatter. */
  export const frontmatter: Record<string, unknown>;
  const MDXContent: (props: {
    components?: Record<string, ComponentType<never>>;
  }) => JSX.Element;
  export default MDXContent;
}

/** `plugins/highlight.ts`: build-time Shiki HTML for a source file. */
declare module '*?highlighted' {
  /** `<pre class="shiki">…` in the CSS-variables theme. */
  const html: string;
  export default html;
  /** The raw source, line endings normalized and trailing space trimmed. */
  export const code: string;
  /** Shiki language id inferred from the extension. */
  export const lang: string;
  /** Basename, for the code block tab. */
  export const filename: string;
}
