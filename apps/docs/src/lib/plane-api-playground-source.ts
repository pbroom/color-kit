import demoSourceRaw from '@/components/plane-api-playground.demo.tsx?raw';

const SNIPPET_START = '@ck-snippet-start';
const SNIPPET_END = '@ck-snippet-end';

interface ParsedPlaygroundSource {
  full: string;
  snippet: string;
}

const CORE_IMPORT_PATTERN = /(['"])@color-kit\/core\1/;
const SANDBOX_CORE_IMPORT = "'./color-kit-core/index.ts'";

function trimBlankEdges(text: string): string {
  return text.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
}

function parsePlaygroundSource(source: string): ParsedPlaygroundSource {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const fullLines: string[] = [];
  const snippetLines: string[] = [];

  let snippetOpen = false;
  let sawSnippetStart = false;
  let sawSnippetEnd = false;

  for (const line of lines) {
    if (line.includes(SNIPPET_START)) {
      if (sawSnippetStart) {
        throw new Error(
          'plane-api-playground.demo.tsx contains multiple snippet start markers.',
        );
      }
      sawSnippetStart = true;
      snippetOpen = true;
      continue;
    }

    if (line.includes(SNIPPET_END)) {
      if (!snippetOpen) {
        throw new Error(
          'plane-api-playground.demo.tsx is missing a matching snippet start marker.',
        );
      }
      sawSnippetEnd = true;
      snippetOpen = false;
      continue;
    }

    fullLines.push(line);
    if (snippetOpen) {
      snippetLines.push(line);
    }
  }

  if (!sawSnippetStart || !sawSnippetEnd || snippetOpen) {
    throw new Error(
      'plane-api-playground.demo.tsx must contain one complete snippet marker pair.',
    );
  }

  return {
    full: trimBlankEdges(fullLines.join('\n')),
    snippet: trimBlankEdges(snippetLines.join('\n')),
  };
}

const parsedPlaygroundSource = parsePlaygroundSource(demoSourceRaw);

function toSandpackSource(source: string): string {
  if (!CORE_IMPORT_PATTERN.test(source)) {
    throw new Error(
      'plane-api-playground.demo.tsx must import from @color-kit/core.',
    );
  }

  return source.replace(CORE_IMPORT_PATTERN, SANDBOX_CORE_IMPORT);
}

export const planeApiPlaygroundSource = parsedPlaygroundSource.full;
export const planeApiQuickStartSnippet = parsedPlaygroundSource.snippet;
export const planeApiSandpackSource = toSandpackSource(
  parsedPlaygroundSource.full,
);
