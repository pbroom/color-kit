import { Sandpack } from '@codesandbox/sandpack-react';
import { githubLight, sandpackDark } from '@codesandbox/sandpack-themes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import coreBundleRaw from '@/lib/color-kit-core-sandpack.js?raw';
import { parseQuickStartSource } from '@/lib/quick-start-source';
import quickStartHtmlSourceRaw from './plane-api-quick-start.demo.html?raw';
import quickStartTsxSourceRaw from './plane-api-quick-start.demo.tsx?raw';
import {
  type DocsCodeLanguage,
  useDocsCodePreference,
} from './docs-code-preference-context.js';
import { useTheme } from './theme-context.js';

function isDocsCodeLanguage(value: string): value is DocsCodeLanguage {
  return value === 'html' || value === 'tsx';
}

function extractModuleScriptCode(html: string): string {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(
      'plane-api-quick-start.demo.html must include a <script type="module"> block.',
    );
  }

  return match[1]
    .split('\n')
    .map((line) => line.replace(/^ {6}/, ''))
    .join('\n')
    .trim();
}

const parsedHtmlSource = parseQuickStartSource(quickStartHtmlSourceRaw, {
  sourceName: 'plane-api-quick-start.demo.html',
});
const parsedTsxSource = parseQuickStartSource(quickStartTsxSourceRaw, {
  sourceName: 'plane-api-quick-start.demo.tsx',
});

const htmlModuleCode = extractModuleScriptCode(parsedHtmlSource.full);
const htmlIndexCode = parsedHtmlSource.full.replace(
  /<script type="module">[\s\S]*?<\/script>/,
  '<script type="module" src="./index.js"></script>',
);

if (htmlIndexCode === parsedHtmlSource.full) {
  throw new Error(
    'plane-api-quick-start.demo.html must include an inline <script type="module"> block for Sandpack extraction.',
  );
}

const CORE_PACKAGE_JSON = JSON.stringify({
  name: '@color-kit/core',
  main: './index.js',
});

const sandpackSharedFiles = {
  '/node_modules/@color-kit/core/package.json': {
    code: CORE_PACKAGE_JSON,
    hidden: true,
  },
  '/node_modules/@color-kit/core/index.js': {
    code: coreBundleRaw,
    hidden: true,
  },
} as const;

const htmlSandpackFiles = {
  '/index.html': htmlIndexCode,
  '/index.js': htmlModuleCode,
  ...sandpackSharedFiles,
};

const tsxSandpackFiles = {
  '/App.tsx': parsedTsxSource.full,
  ...sandpackSharedFiles,
};

export function PlaneQuickStartSandpack() {
  const { preferredLanguage, setPreferredLanguage } = useDocsCodePreference();
  const { resolvedTheme } = useTheme();
  const sandpackTheme = resolvedTheme === 'dark' ? sandpackDark : githubLight;

  return (
    <div className="not-prose my-6">
      <div className="ck-docs-sandpack-wrap">
        <Tabs
          value={preferredLanguage}
          onValueChange={(value) => {
            if (isDocsCodeLanguage(value)) {
              setPreferredLanguage(value);
            }
          }}
          className="ck-docs-sandpack-tabs"
        >
          <TabsList className="ck-docs-sandpack-tabs-list">
            <TabsTrigger value="html" className="ck-docs-sandpack-tabs-trigger">
              html
            </TabsTrigger>
            <TabsTrigger value="tsx" className="ck-docs-sandpack-tabs-trigger">
              tsx
            </TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="mt-0">
            <Sandpack
              key={`plane-quick-start-html-${resolvedTheme}`}
              className="ck-docs-sandpack-instance"
              template="vanilla"
              theme={sandpackTheme}
              files={htmlSandpackFiles}
              options={{
                activeFile: '/index.html',
                visibleFiles: ['/index.html', '/index.js'],
                bundlerURL: 'https://sandpack-bundler.codesandbox.io',
                bundlerTimeOut: 120000,
                initMode: 'immediate',
                recompileMode: 'delayed',
                recompileDelay: 400,
                showNavigator: false,
                showRefreshButton: true,
                showLineNumbers: true,
                showInlineErrors: true,
                showTabs: true,
                wrapContent: true,
                editorHeight: 460,
                editorWidthPercentage: 56,
                resizablePanels: false,
              }}
            />
          </TabsContent>

          <TabsContent value="tsx" className="mt-0">
            <Sandpack
              key={`plane-quick-start-tsx-${resolvedTheme}`}
              className="ck-docs-sandpack-instance"
              template="react-ts"
              theme={sandpackTheme}
              files={tsxSandpackFiles}
              options={{
                activeFile: '/App.tsx',
                visibleFiles: ['/App.tsx'],
                bundlerURL: 'https://sandpack-bundler.codesandbox.io',
                bundlerTimeOut: 120000,
                initMode: 'immediate',
                recompileMode: 'delayed',
                recompileDelay: 400,
                showNavigator: false,
                showRefreshButton: true,
                showLineNumbers: true,
                showInlineErrors: true,
                showTabs: true,
                wrapContent: true,
                editorHeight: 460,
                editorWidthPercentage: 56,
                resizablePanels: false,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
