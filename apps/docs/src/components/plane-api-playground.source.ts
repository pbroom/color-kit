import demoSourceRaw from './plane-api-playground.demo.tsx?raw';

const SNIPPET_START = '@ck-snippet-start';
const SNIPPET_END = '@ck-snippet-end';

interface ParsedPlaygroundSource {
  full: string;
  snippet: string;
}

const SANDBOX_PACKAGE_ROOT = '/node_modules/color-kit';
const SANDBOX_PACKAGE_ENTRY = '../../color-kit-core/index.ts' as const;

export const planeApiPlaygroundSandboxPackageJsonFile = `${SANDBOX_PACKAGE_ROOT}/package.json`;
export const planeApiPlaygroundSandboxPackageJsonSource = JSON.stringify(
  {
    name: 'color-kit',
    private: true,
    type: 'module',
    main: './index.js',
    module: './index.js',
    exports: {
      '.': {
        default: './index.js',
      },
      './core': {
        default: './index.js',
      },
    },
  },
  null,
  2,
);
export const planeApiPlaygroundSandboxPackageEntryFile = `${SANDBOX_PACKAGE_ROOT}/index.js`;
export const planeApiPlaygroundSandboxPackageEntrySource = `export * from '${SANDBOX_PACKAGE_ENTRY}';`;

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

export const planeApiPlaygroundSource = parsedPlaygroundSource.full;
export const planeApiQuickStartSnippet = parsedPlaygroundSource.snippet;
