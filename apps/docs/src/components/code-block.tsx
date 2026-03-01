import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-context';

type CodeBlockLanguage =
  | 'bash'
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'json'
  | 'md'
  | 'mdx'
  | 'text';

interface CodeBlockProps {
  code: string;
  language?: CodeBlockLanguage;
  label?: string;
  className?: string;
}

const SHIKI_THEME_BY_MODE = {
  light: 'github-light',
  dark: 'github-dark-default',
} as const;

type CodeHighlighter = {
  codeToHtml: (
    code: string,
    options: { lang: 'bash' | 'ts' | 'tsx'; theme: string },
  ) => string;
};

let highlighterPromise: Promise<CodeHighlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/langs/bash'),
      import('@shikijs/langs/ts'),
      import('@shikijs/langs/tsx'),
      import('@shikijs/themes/github-dark-default'),
      import('@shikijs/themes/github-light'),
    ]).then(
      ([
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        { default: bash },
        { default: ts },
        { default: tsx },
        { default: githubDarkDefault },
        { default: githubLight },
      ]) =>
        createHighlighterCore({
          themes: [githubLight, githubDarkDefault],
          langs: [bash, ts, tsx],
          engine: createJavaScriptRegexEngine(),
        }),
    );
  }

  return highlighterPromise;
}

function normalizeLanguage(language: CodeBlockLanguage): 'bash' | 'ts' | 'tsx' {
  switch (language) {
    case 'bash':
      return 'bash';
    case 'tsx':
    case 'jsx':
    case 'mdx':
      return 'tsx';
    default:
      return 'ts';
  }
}

export function CodeBlock({
  code,
  language = 'text',
  label,
  className,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const requestKey = `${resolvedTheme}:${language}:${code}`;
  const [html, setHtml] = useState<string | null>(null);
  const [renderedFor, setRenderedFor] = useState(requestKey);

  useEffect(() => {
    let cancelled = false;

    const highlight = async () => {
      try {
        const highlighter = await getHighlighter();
        const nextHtml = highlighter.codeToHtml(code, {
          lang: normalizeLanguage(language),
          theme: SHIKI_THEME_BY_MODE[resolvedTheme],
        });
        if (!cancelled) {
          setHtml(nextHtml);
          setRenderedFor(requestKey);
        }
      } catch {
        if (!cancelled) {
          setHtml(null);
          setRenderedFor(requestKey);
        }
      }
    };

    void highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language, resolvedTheme, requestKey]);

  return (
    <div className={cn('docs-code-block not-prose my-6', className)}>
      {label ? <p className="docs-code-label">{label}</p> : null}
      {html && renderedFor === requestKey ? (
        <div
          className="docs-shiki-block"
          // HTML comes from Shiki and only renders trusted local snippets.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="m-0 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-sm">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
