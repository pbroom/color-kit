import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from './code-block.js';
import {
  type DocsCodeLanguage,
  useDocsCodePreference,
} from './docs-code-preference-context.js';
import { getPlaneQuickStartSources } from './plane-api-demos.js';

const QUICK_START_SOURCES = getPlaneQuickStartSources();

function isDocsCodeLanguage(value: string): value is DocsCodeLanguage {
  return value === 'html' || value === 'tsx';
}

export function PlaneQuickStartSnippet() {
  const { preferredLanguage, setPreferredLanguage } = useDocsCodePreference();
  const [isExpanded, setIsExpanded] = useState(false);

  const htmlCanExpand =
    QUICK_START_SOURCES.html.full !== QUICK_START_SOURCES.html.compact;
  const tsxCanExpand =
    QUICK_START_SOURCES.tsx.full !== QUICK_START_SOURCES.tsx.compact;
  const canExpand = preferredLanguage === 'html' ? htmlCanExpand : tsxCanExpand;

  return (
    <div className="not-prose my-6 rounded-xl border border-border/70 bg-card/40 p-3">
      <Tabs
        value={preferredLanguage}
        onValueChange={(value) => {
          if (isDocsCodeLanguage(value)) {
            setPreferredLanguage(value);
          }
        }}
        className="gap-2"
      >
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-8">
            <TabsTrigger value="html" className="h-6 px-2 text-xs">
              html
            </TabsTrigger>
            <TabsTrigger value="tsx" className="h-6 px-2 text-xs">
              tsx
            </TabsTrigger>
          </TabsList>

          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? 'Show less' : 'View full code'}
            </Button>
          ) : null}
        </div>

        <TabsContent value="html" className="mt-0">
          <CodeBlock
            code={
              isExpanded
                ? QUICK_START_SOURCES.html.full
                : QUICK_START_SOURCES.html.compact
            }
            language="html"
            className="my-0"
          />
        </TabsContent>
        <TabsContent value="tsx" className="mt-0">
          <CodeBlock
            code={
              isExpanded
                ? QUICK_START_SOURCES.tsx.full
                : QUICK_START_SOURCES.tsx.compact
            }
            language="tsx"
            className="my-0"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
