import { useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * `<CodeBlock>`: a source listing with an optional filename tab and a copy
 * button. No line numbers.
 *
 * Contract:
 * - Prefer `html`: build-time Shiki output from a `?highlighted` import
 *   (`import html, { code } from './demo.tsx?highlighted'`) or any HTML
 *   produced with the CSS-variables theme in `plugins/shiki-theme.ts`. One
 *   HTML string serves light and dark; colors come from `--shiki-*` tokens.
 * - `code` alone renders unhighlighted (no highlighter ships to the client).
 *   When both are given, `code` is what Copy copies.
 * - `children` is how MDX fenced blocks arrive: the MDX `pre` mapping wraps
 *   rehype-shiki's `<pre>` and passes `filename` from ```` ```ts title="x.ts" ````.
 * - `breakout` widens the block from the 680 px prose column to 920 px.
 * - Copy reads the rendered text at click time, so it always matches what
 *   is shown.
 */
export interface CodeBlockProps {
  html?: string;
  code?: string;
  /** Shown in the tab, e.g. `linear-mix.ts`. */
  filename?: string;
  /** Language id, used for the label when there is no filename. */
  lang?: string;
  breakout?: boolean;
  children?: ReactNode;
  className?: string;
}

const LANG_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  bash: 'Shell',
  sh: 'Shell',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
};

export function CodeBlock({
  html,
  code,
  filename,
  lang,
  breakout,
  children,
  className,
}: CodeBlockProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const label = filename ?? (lang ? LANG_LABELS[lang] : undefined);

  const copy = () => {
    const text = code ?? bodyRef.current?.textContent ?? '';
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  let body: ReactNode = children;
  if (html) {
    body = <div dangerouslySetInnerHTML={{ __html: html }} />;
  } else if (code != null && children == null) {
    body = (
      <pre className="shiki" tabIndex={0}>
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <figure
      className={['code-block', breakout ? 'breakout' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-bare={label ? undefined : ''}
    >
      <div className="code-block__bar" data-pagefind-ignore="">
        {label ? <span className="code-block__name">{label}</span> : null}
        <button type="button" className="code-block__copy" onClick={copy}>
          {copied ? (
            <Check aria-hidden="true" size={14} strokeWidth={2} />
          ) : (
            <Copy aria-hidden="true" size={14} strokeWidth={1.75} />
          )}
          <span className="visually-hidden">Copy code</span>
          <span className="code-block__copied" aria-live="polite">
            {copied ? 'Copied' : ''}
          </span>
        </button>
      </div>
      <div ref={bodyRef} className="code-block__body">
        {body}
      </div>
    </figure>
  );
}
