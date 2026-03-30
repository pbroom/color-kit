import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { githubLight, sandpackDark } from '@codesandbox/sandpack-themes';
import { compressToBase64 } from 'lz-string';
import { planeApiSandpackSource } from '@/lib/plane-api-playground-source';
import { useTheme } from './theme-context.js';

const CORE_SOURCE_PREFIX = '../../../../packages/core/src/';
const CORE_SANDBOX_ROOT = '/color-kit-core';
const CODESANDBOX_DEFINE_URL = 'https://codesandbox.io/api/v1/sandboxes/define';

interface SandpackFileDescriptor {
  code: string;
}

type SandpackFileValue = string | SandpackFileDescriptor;

const rawCoreSourceFiles = import.meta.glob(
  '../../../../packages/core/src/**/*.{ts,tsx}',
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
) as Record<string, string>;

function toCoreSandboxPath(modulePath: string): string {
  if (!modulePath.startsWith(CORE_SOURCE_PREFIX)) {
    throw new Error(`Unexpected core source path: ${modulePath}`);
  }

  return `${CORE_SANDBOX_ROOT}/${modulePath.slice(CORE_SOURCE_PREFIX.length)}`;
}

function dirnamePosix(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  return slashIndex <= 0 ? '/' : path.slice(0, slashIndex);
}

function joinPosix(baseDir: string, relativePath: string): string {
  const segments = `${baseDir}/${relativePath}`.split('/');
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return `/${normalized.join('/')}`;
}

const coreSourceBySandboxPath = Object.fromEntries(
  Object.entries(rawCoreSourceFiles).map(([modulePath, code]) => [
    toCoreSandboxPath(modulePath),
    code,
  ]),
);

const coreSandboxPaths = new Set(Object.keys(coreSourceBySandboxPath));
const SANDBOX_INSTANCE_ID = Math.random().toString(36).slice(2);
const PLAYGROUND_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Plane API Playground</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
const PLAYGROUND_STYLES = `:root {
  color-scheme: dark;
  font-family:
    Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  background: #0f1114;
  color: #f5f7fa;
}

#root {
  box-sizing: border-box;
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
}

svg {
  display: block;
  height: auto;
  max-width: 100%;
}`;

function resolveCoreImport(fromFile: string, specifier: string): string {
  const baseDir = dirnamePosix(fromFile);
  const tsCandidate = joinPosix(baseDir, `${specifier}.ts`);
  if (coreSandboxPaths.has(tsCandidate)) {
    return `${specifier}.ts`;
  }

  const tsxCandidate = joinPosix(baseDir, `${specifier}.tsx`);
  if (coreSandboxPaths.has(tsxCandidate)) {
    return `${specifier}.tsx`;
  }

  return `${specifier}.js`;
}

function rewriteCoreSourceImports(source: string, fromFile: string): string {
  return source
    .replace(
      /(from\s+)(['"])(\.{1,2}\/[^'"]+)\.js\2/g,
      (_match, prefix, quote, specifier) =>
        `${prefix}${quote}${resolveCoreImport(fromFile, specifier)}${quote}`,
    )
    .replace(
      /(import\(\s*)(['"])(\.{1,2}\/[^'"]+)\.js\2/g,
      (_match, prefix, quote, specifier) =>
        `${prefix}${quote}${resolveCoreImport(fromFile, specifier)}${quote}`,
    );
}

const PLAYGROUND_FILES = {
  '/App.tsx': planeApiSandpackSource,
  '/public/index.html': PLAYGROUND_INDEX_HTML,
  '/styles.css': PLAYGROUND_STYLES,
  ...Object.fromEntries(
    Object.entries(coreSourceBySandboxPath).map(([filePath, code]) => [
      filePath,
      {
        code: rewriteCoreSourceImports(code, filePath),
        hidden: true,
      },
    ]),
  ),
} as const;

function getFileCode(file: SandpackFileValue | undefined): string {
  if (typeof file === 'string') {
    return file;
  }

  return file?.code ?? '';
}

function toCodeSandboxParameters(
  files: Record<string, SandpackFileValue>,
  environment: string,
): string {
  const normalizedFiles = Object.keys(files).reduce<
    Record<string, { content: string; isBinary: false }>
  >((prev, next) => {
    const fileName = next.replace(/^\//, '');

    return {
      ...prev,
      [fileName]: {
        content: getFileCode(files[next]),
        isBinary: false,
      },
    };
  }, {});

  return compressToBase64(
    JSON.stringify({
      files: normalizedFiles,
      ...(environment ? { template: environment } : {}),
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function openInCodeSandbox(
  files: Record<string, SandpackFileValue>,
  environment: string,
  activeFile: string,
) {
  const form = document.createElement('form');
  form.action = CODESANDBOX_DEFINE_URL;
  form.method = 'POST';
  form.target = '_blank';
  form.style.display = 'none';

  const values = {
    environment: environment === 'node' ? 'server' : environment,
    parameters: toCodeSandboxParameters(files, environment),
    query: new URLSearchParams({
      file: activeFile,
      utm_medium: 'sandpack',
    }).toString(),
  };

  for (const [name, value] of Object.entries(values)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();
}

function SandpackAutoRun() {
  const { sandpack } = useSandpack();
  const hasRequestedRun = useRef(false);

  useEffect(() => {
    if (hasRequestedRun.current) {
      return;
    }

    hasRequestedRun.current = true;
    void sandpack.runSandpack();
  }, [sandpack]);

  return null;
}

function PlaneApiPlaygroundActions({ onRefresh }: { onRefresh: () => void }) {
  const { sandpack } = useSandpack();

  const handleOpenSandbox = useCallback(() => {
    openInCodeSandbox(
      sandpack.files as Record<string, SandpackFileValue>,
      sandpack.environment,
      sandpack.activeFile,
    );
  }, [sandpack.activeFile, sandpack.environment, sandpack.files]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md border border-border/70 bg-card/60 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={onRefresh}
      >
        Refresh
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md border border-border/70 bg-card/60 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={handleOpenSandbox}
      >
        Open Sandbox
      </button>
    </div>
  );
}

function PlaneApiPlaygroundPreview() {
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <SandpackPreview
      key={refreshNonce}
      actionsChildren={
        <PlaneApiPlaygroundActions
          onRefresh={() => setRefreshNonce((value) => value + 1)}
        />
      }
      showNavigator={false}
      showOpenInCodeSandbox={false}
      showRefreshButton={false}
      showSandpackErrorOverlay
      style={{ height: 520 }}
    />
  );
}

export default function PlaneApiPlaygroundSandpack() {
  const { resolvedTheme } = useTheme();

  return (
    <SandpackProvider
      key={`plane-api-playground-${resolvedTheme}-${SANDBOX_INSTANCE_ID}`}
      template="react-ts"
      customSetup={{
        dependencies: {
          react: '18.2.0',
          'react-dom': '18.2.0',
          '@material/material-color-utilities': '^0.3.0',
        },
      }}
      theme={resolvedTheme === 'dark' ? sandpackDark : githubLight}
      files={PLAYGROUND_FILES}
      options={{
        activeFile: '/App.tsx',
        visibleFiles: ['/App.tsx', '/public/index.html', '/styles.css'],
        autorun: true,
        bundlerTimeOut: 120000,
        initMode: 'immediate',
        recompileDelay: 300,
        recompileMode: 'delayed',
      }}
    >
      <SandpackLayout style={{ minHeight: 520 }}>
        <SandpackCodeEditor
          showInlineErrors
          showLineNumbers
          showRunButton={false}
          showTabs
          style={{ height: 520 }}
          wrapContent
        />
        <PlaneApiPlaygroundPreview />
      </SandpackLayout>
      <SandpackAutoRun />
    </SandpackProvider>
  );
}
