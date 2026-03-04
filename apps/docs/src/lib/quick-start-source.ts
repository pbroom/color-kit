export const QUICK_START_SNIPPET_DIRECTIVES = {
  compactStart: '@ck-snippet-compact-start',
  compactEnd: '@ck-snippet-compact-end',
  hideStart: '@ck-snippet-hide-start',
  hideEnd: '@ck-snippet-hide-end',
} as const;

type QuickStartDirective = keyof typeof QUICK_START_SNIPPET_DIRECTIVES;

export interface ParsedQuickStartSource {
  compact: string;
  full: string;
  executable: string;
}

interface ParseQuickStartSourceOptions {
  sourceName?: string;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === '') {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === '') {
    end -= 1;
  }

  return lines.slice(start, end);
}

function normalizeSnippetText(lines: string[]): string {
  return trimBlankEdges(lines).join('\n');
}

function readDirective(line: string): QuickStartDirective | null {
  if (line.includes(QUICK_START_SNIPPET_DIRECTIVES.compactStart)) {
    return 'compactStart';
  }
  if (line.includes(QUICK_START_SNIPPET_DIRECTIVES.compactEnd)) {
    return 'compactEnd';
  }
  if (line.includes(QUICK_START_SNIPPET_DIRECTIVES.hideStart)) {
    return 'hideStart';
  }
  if (line.includes(QUICK_START_SNIPPET_DIRECTIVES.hideEnd)) {
    return 'hideEnd';
  }
  return null;
}

function directiveToken(kind: QuickStartDirective): string {
  return QUICK_START_SNIPPET_DIRECTIVES[kind];
}

function formatDirectiveError(
  sourceName: string,
  lineNumber: number,
  message: string,
): Error {
  return new Error(`${sourceName}:${lineNumber} ${message}`);
}

export function parseQuickStartSource(
  source: string,
  { sourceName = 'quick-start source' }: ParseQuickStartSourceOptions = {},
): ParsedQuickStartSource {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const executableLines: string[] = [];
  const fullLines: string[] = [];
  const compactLines: string[] = [];

  let hideDepth = 0;
  let compactDepth = 0;
  let hasCompactDirectives = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const directive = readDirective(line);

    if (directive) {
      switch (directive) {
        case 'compactStart':
          hasCompactDirectives = true;
          compactDepth += 1;
          break;
        case 'compactEnd':
          hasCompactDirectives = true;
          if (compactDepth === 0) {
            throw formatDirectiveError(
              sourceName,
              lineNumber,
              `unexpected "${directiveToken(directive)}" without a matching start marker`,
            );
          }
          compactDepth -= 1;
          break;
        case 'hideStart':
          hideDepth += 1;
          break;
        case 'hideEnd':
          if (hideDepth === 0) {
            throw formatDirectiveError(
              sourceName,
              lineNumber,
              `unexpected "${directiveToken(directive)}" without a matching start marker`,
            );
          }
          hideDepth -= 1;
          break;
        default: {
          const _exhaustive: never = directive;
          throw formatDirectiveError(
            sourceName,
            lineNumber,
            `unsupported directive "${String(_exhaustive)}"`,
          );
        }
      }

      return;
    }

    executableLines.push(line);

    if (hideDepth > 0) {
      return;
    }

    fullLines.push(line);
    if (compactDepth > 0) {
      compactLines.push(line);
    }
  });

  if (compactDepth > 0) {
    throw formatDirectiveError(
      sourceName,
      lines.length,
      `missing "${directiveToken('compactEnd')}" marker`,
    );
  }

  if (hideDepth > 0) {
    throw formatDirectiveError(
      sourceName,
      lines.length,
      `missing "${directiveToken('hideEnd')}" marker`,
    );
  }

  const full = normalizeSnippetText(fullLines);
  const compact = hasCompactDirectives
    ? normalizeSnippetText(compactLines)
    : full;
  const executable = normalizeSnippetText(executableLines);

  return {
    compact: compact || full,
    full,
    executable,
  };
}
