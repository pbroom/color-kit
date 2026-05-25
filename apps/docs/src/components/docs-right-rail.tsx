import { useLocation } from 'react-router';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useDocsInspector } from './docs-inspector-context.js';
import {
  DocsPropertiesPanel,
  hasDocsPropertiesPanel,
} from './docs-right-rail-panels.js';

export interface DocsHeading {
  id: string;
  title: string;
  level: 2 | 3;
}

function OutlinePanel({ headings }: { headings: DocsHeading[] }) {
  if (headings.length === 0) {
    return (
      <p className="docs-right-empty">
        This page does not expose section headings yet.
      </p>
    );
  }

  return (
    <nav className="docs-outline-nav" aria-label="On this page">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={
            heading.level === 3
              ? 'docs-outline-link nested'
              : 'docs-outline-link'
          }
        >
          {heading.title}
        </a>
      ))}
    </nav>
  );
}

export function DocsRightRail({
  headings,
  className,
}: {
  headings: DocsHeading[];
  className?: string;
}) {
  const { pathname } = useLocation();
  const { activeTab, setActiveTab } = useDocsInspector();
  const hasPropertiesPanel = hasDocsPropertiesPanel(pathname);

  return (
    <aside className={cn('docs-right-rail ck-rightrail-panel', className)}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="p-3 pb-0">
          <Tabs
            value={activeTab}
            onValueChange={(next) => {
              if (next === 'outline' || next === 'properties') {
                setActiveTab(next);
              }
            }}
            className="w-full"
          >
            <TabsList
              className="flex h-auto min-h-9 w-full min-w-0 items-stretch gap-0.5 rounded-lg p-1"
              aria-label="Docs side panels"
            >
              <TabsTrigger
                value="outline"
                title="On this page"
                className="min-h-9 min-w-0 flex-1 gap-0 whitespace-normal px-1 py-1.5 text-center text-xs font-medium leading-snug"
              >
                On this page
              </TabsTrigger>
              <TabsTrigger
                value="properties"
                title="Properties"
                className="min-h-9 min-w-0 flex-1 gap-0 whitespace-normal px-1 py-1.5 text-center text-xs font-medium leading-snug"
              >
                Properties
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="ck-rightrail-scroll min-h-0 p-0">
          <ScrollArea className="h-full">
            <div className="ck-rightrail-content">
              {activeTab === 'outline' ? (
                <OutlinePanel headings={headings} />
              ) : hasPropertiesPanel ? (
                <DocsPropertiesPanel pathname={pathname} />
              ) : (
                <p className="docs-right-empty">
                  No live demo controls are available for this page yet.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </aside>
  );
}
