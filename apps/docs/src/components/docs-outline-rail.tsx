import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

export function DocsOutlineRail({
  headings,
  className,
}: {
  headings: DocsHeading[];
  className?: string;
}) {
  return (
    <aside className={cn('docs-right-rail ck-rightrail-panel', className)}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            On this page
          </p>
        </div>
        <div className="ck-rightrail-scroll min-h-0 p-0">
          <ScrollArea className="h-full">
            <div className="ck-rightrail-content">
              <OutlinePanel headings={headings} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </aside>
  );
}
