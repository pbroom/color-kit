import * as SandpackReact from '@codesandbox/sandpack-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  SandpackCodeEditor as SandpackCodeEditorBase,
  SandpackLayout as SandpackLayoutBase,
  SandpackPreview as SandpackPreviewBase,
  SandpackProvider as SandpackProviderBase,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { githubLight } from '@codesandbox/sandpack-themes';
import { ExternalLink, ListOrdered, RefreshCw, RotateCcw } from 'lucide-react';
import { compressToBase64 } from 'lz-string';
import { githubDarkSandpackTheme } from '../lib/sandpack-themes.js';
import { cn } from '../lib/utils.js';
import {
  planeApiPlaygroundSandboxPackageEntryFile,
  planeApiPlaygroundSandboxPackageEntrySource,
  planeApiPlaygroundSandboxPackageJsonFile,
  planeApiPlaygroundSandboxPackageJsonSource,
} from './plane-api-playground.source.js';
import { useTheme, type ResolvedTheme } from './theme-context.js';

const CORE_SOURCE_PREFIX = '../../../../packages/core/src/';
const CORE_SANDBOX_ROOT = '/color-kit-core';
const CODESANDBOX_DEFINE_URL = 'https://codesandbox.io/api/v1/sandboxes/define';
const DEFAULT_PLAYGROUND_APP_FILE = '/App.js';
const PLAYGROUND_ENTRY_FILE = '/index.tsx';
const PLAYGROUND_PANEL_HEIGHT = 520;

type SandpackCompatProps = {
  children?: ReactNode;
  [prop: string]: unknown;
};

// The vendored Sandpack package exposes React component types that do not
// satisfy this app's React 19 JSX checker, so adapt them at the usage boundary.
const SandpackProvider =
  SandpackProviderBase as unknown as ComponentType<SandpackCompatProps>;
const SandpackLayout =
  SandpackLayoutBase as unknown as ComponentType<SandpackCompatProps>;
const SandpackCodeEditor =
  SandpackCodeEditorBase as unknown as ComponentType<SandpackCompatProps>;
const SandpackPreview =
  SandpackPreviewBase as unknown as ComponentType<SandpackCompatProps>;
const SandpackFileTabs = (
  SandpackReact as unknown as {
    FileTabs: ComponentType<SandpackCompatProps>;
  }
).FileTabs;

interface SandpackFileDescriptor {
  code: string;
  hidden?: boolean;
}

type SandpackFileValue = string | SandpackFileDescriptor;

const rawCoreSourceFiles = import.meta.glob(
  [
    '../../../../packages/core/src/compute/types.ts',
    '../../../../packages/core/src/contrast/index.ts',
    '../../../../packages/core/src/conversion/*.ts',
    '../../../../packages/core/src/gamut/index.ts',
    '../../../../packages/core/src/hct/index.ts',
    '../../../../packages/core/src/plane/compile.ts',
    '../../../../packages/core/src/plane/gamut-region.ts',
    '../../../../packages/core/src/plane/index.ts',
    '../../../../packages/core/src/plane/operations.ts',
    '../../../../packages/core/src/plane/plane.ts',
    '../../../../packages/core/src/plane/query.ts',
    '../../../../packages/core/src/plane/trace.ts',
    '../../../../packages/core/src/plane/transforms.ts',
    '../../../../packages/core/src/plane/types.ts',
    '../../../../packages/core/src/scale/index.ts',
    '../../../../packages/core/src/types.ts',
    '../../../../packages/core/src/utils/*.ts',
  ],
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
function createPlaygroundStyles(resolvedTheme: ResolvedTheme): string {
  const isDark = resolvedTheme === 'dark';
  const background = isDark ? '#0a0a0a' : '#ffffff';
  const text = isDark ? '#e6edf3' : '#1f2328';
  const border = isDark ? '#222' : '#d0d7de';
  const pathFill = isDark
    ? 'oklch(82.8% 0.111 230.318 / 0.08)'
    : 'oklch(74.6% 0.16 232.661 / 0.08)';
  const pathStroke = isDark ? 'oklch(68.5% 0.169 237.323)' : '#2563eb';

  return `:root {
  color-scheme: ${resolvedTheme};
  font-family:
    Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  background: ${background};
  color: ${text};
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
  width: 300px;
  height: 300px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 0 0 0.5px ${border};
  user-select: none;
}

svg path {
  stroke-width: 0.5px;
  fill: ${pathFill};
  stroke: ${pathStroke};
}
`;
}
function createPlaygroundEntry(appFile: string): string {
  return `import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import App from '.${appFile}';

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);`;
}
const PLAYGROUND_TSCONFIG = JSON.stringify(
  {
    include: ['./**/*'],
    compilerOptions: {
      strict: true,
      esModuleInterop: true,
      lib: ['dom', 'es2015'],
      jsx: 'react-jsx',
      allowJs: true,
      checkJs: false,
    },
  },
  null,
  2,
);

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

function createPlaygroundSupportFiles(
  appFile: string,
  resolvedTheme: ResolvedTheme,
): Record<string, SandpackFileValue> {
  return {
    [PLAYGROUND_ENTRY_FILE]: createPlaygroundEntry(appFile),
    [planeApiPlaygroundSandboxPackageJsonFile]: {
      code: planeApiPlaygroundSandboxPackageJsonSource,
      hidden: true,
    },
    [planeApiPlaygroundSandboxPackageEntryFile]: {
      code: planeApiPlaygroundSandboxPackageEntrySource,
      hidden: true,
    },
    '/public/index.html': PLAYGROUND_INDEX_HTML,
    '/styles.css': createPlaygroundStyles(resolvedTheme),
    '/tsconfig.json': PLAYGROUND_TSCONFIG,
    ...Object.fromEntries(
      Object.entries(coreSourceBySandboxPath).map(([filePath, code]) => [
        filePath,
        {
          code: rewriteCoreSourceImports(code, filePath),
          hidden: true,
        },
      ]),
    ),
  };
}

function createPlaygroundFiles(
  source: string,
  appFile: string,
  resolvedTheme: ResolvedTheme,
): Record<string, SandpackFileValue> {
  return {
    [appFile]: source,
    ...createPlaygroundSupportFiles(appFile, resolvedTheme),
  };
}

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

function PlaygroundToolbarButton({
  icon,
  label,
  onClick,
  pressed = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed || undefined}
      onClick={onClick}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center text-(--sp-colors-clickable) transition-colors duration-150 ease-out motion-reduce:transition-none',
        'hover:bg-(--sp-colors-surface2) hover:text-(--sp-colors-hover)',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-(--sp-colors-accent)',
        pressed && 'bg-(--sp-colors-surface2) text-(--sp-colors-hover)',
      )}
    >
      {icon}
    </button>
  );
}

function PlaneApiPlaygroundToolbar({
  onRefresh,
  showLineNumbers,
  onToggleLineNumbers,
}: {
  onRefresh: () => void;
  showLineNumbers: boolean;
  onToggleLineNumbers: () => void;
}) {
  const { sandpack } = useSandpack();

  const handleResetCode = useCallback(() => {
    sandpack.resetAllFiles();
    onRefresh();
  }, [onRefresh, sandpack]);

  const handleOpenSandbox = useCallback(() => {
    openInCodeSandbox(
      sandpack.files as Record<string, SandpackFileValue>,
      sandpack.environment ?? 'create-react-app',
      sandpack.activeFile,
    );
  }, [sandpack.activeFile, sandpack.environment, sandpack.files]);

  return (
    <div className="flex shrink-0 items-stretch [background:var(--sp-colors-surface1)]">
      <PlaygroundToolbarButton
        icon={<RefreshCw className="size-4" />}
        label="Refresh preview"
        onClick={onRefresh}
      />
      <PlaygroundToolbarButton
        icon={<RotateCcw className="size-4" />}
        label="Reset code"
        onClick={handleResetCode}
      />
      <PlaygroundToolbarButton
        icon={<ListOrdered className="size-4" />}
        label={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
        onClick={onToggleLineNumbers}
        pressed={showLineNumbers}
      />
      <PlaygroundToolbarButton
        icon={<ExternalLink className="size-4" />}
        label="Open in CodeSandbox"
        onClick={handleOpenSandbox}
      />
    </div>
  );
}

function PlaneApiPlaygroundEditor({
  showLineNumbers,
  panelHeight,
}: {
  showLineNumbers: boolean;
  panelHeight: number;
}) {
  const { sandpack } = useSandpack();
  const activeFileUniqueId = useId();

  return (
    <div
      className="sp-stack sp-editor flex min-w-0 flex-1 flex-col overflow-hidden [background:var(--sp-colors-surface1)]"
      style={{ height: panelHeight }}
    >
      <div className="flex min-w-0 items-stretch border-b border-(--sp-colors-surface2) [background:var(--sp-colors-surface1)]">
        <SandpackFileTabs
          activeFileUniqueId={activeFileUniqueId}
          className="min-w-0 flex-1 overflow-hidden border-b-0 bg-transparent"
        />
      </div>
      <div
        id={`${sandpack.activeFile}-${activeFileUniqueId}-tab-panel`}
        role="tabpanel"
        aria-labelledby={`${sandpack.activeFile}-${activeFileUniqueId}-tab`}
        className="min-h-0 flex-1"
      >
        <SandpackCodeEditor
          className="h-full min-h-0"
          showInlineErrors
          showLineNumbers={showLineNumbers}
          showRunButton={false}
          showTabs={false}
          style={{ height: '100%' }}
          wrapContent
        />
      </div>
    </div>
  );
}

function PlaneApiPlaygroundPreview({
  refreshNonce,
  onRefresh,
  showLineNumbers,
  onToggleLineNumbers,
  panelHeight,
}: {
  refreshNonce: number;
  onRefresh: () => void;
  showLineNumbers: boolean;
  onToggleLineNumbers: () => void;
  panelHeight: number;
}) {
  return (
    <div
      className="sp-stack sp-preview flex min-w-0 flex-1 flex-col overflow-hidden [background:var(--sp-colors-surface1)]"
      style={{ height: panelHeight }}
    >
      <div className="flex min-w-0 items-stretch justify-end border-b border-(--sp-colors-surface2) [background:var(--sp-colors-surface1)]">
        <PlaneApiPlaygroundToolbar
          onRefresh={onRefresh}
          showLineNumbers={showLineNumbers}
          onToggleLineNumbers={onToggleLineNumbers}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SandpackPreview
          key={refreshNonce}
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showSandpackErrorOverlay
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}

export default function PlaneApiPlaygroundSandpack({
  source,
  instanceId = SANDBOX_INSTANCE_ID,
  appFile = DEFAULT_PLAYGROUND_APP_FILE,
  panelHeight = PLAYGROUND_PANEL_HEIGHT,
}: {
  source: string;
  instanceId?: string;
  appFile?: string;
  panelHeight?: number;
}) {
  const { resolvedTheme } = useTheme();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const files = useMemo(
    () => createPlaygroundFiles(source, appFile, resolvedTheme),
    [appFile, resolvedTheme, source],
  );
  const handleRefresh = useCallback(
    () => setRefreshNonce((value) => value + 1),
    [],
  );
  const handleToggleLineNumbers = useCallback(
    () => setShowLineNumbers((value) => !value),
    [],
  );

  return (
    <SandpackProvider
      key={`plane-api-playground-${instanceId}`}
      template="react-ts"
      customSetup={{
        dependencies: {
          react: '18.2.0',
          'react-dom': '18.2.0',
          '@material/material-color-utilities': '^0.3.0',
        },
      }}
      theme={resolvedTheme === 'dark' ? githubDarkSandpackTheme : githubLight}
      files={files}
      options={{
        activeFile: appFile,
        visibleFiles: [appFile, '/public/index.html', '/styles.css'],
        autorun: true,
        bundlerTimeOut: 120000,
        initMode: 'immediate',
        recompileDelay: 300,
        recompileMode: 'delayed',
      }}
    >
      <SandpackLayout
        className="w-full min-w-0"
        style={{ minHeight: panelHeight }}
      >
        <PlaneApiPlaygroundEditor
          showLineNumbers={showLineNumbers}
          panelHeight={panelHeight}
        />
        <PlaneApiPlaygroundPreview
          refreshNonce={refreshNonce}
          onRefresh={handleRefresh}
          showLineNumbers={showLineNumbers}
          onToggleLineNumbers={handleToggleLineNumbers}
          panelHeight={panelHeight}
        />
      </SandpackLayout>
      <SandpackAutoRun />
    </SandpackProvider>
  );
}
