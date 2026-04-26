import {
  lazy,
  type CSSProperties,
  Suspense,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Github, Menu, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { docsNavigation } from '../content/docs-registry.js';
import {
  DocsInspectorProvider,
  useDocsInspector,
} from './docs-inspector-context.js';
import { DocsOutlineRail, type DocsHeading } from './docs-outline-rail.js';
import { ThemeSwitcher } from './theme-switcher.js';

const DocsRightRail = lazy(() =>
  import('./docs-right-rail.js').then((module) => ({
    default: module.DocsRightRail,
  })),
);

function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function DocsSidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-5">
      {docsNavigation.map((section) => (
        <div key={section.title}>
          <h4 className="ck-nav-section-title">{section.title}</h4>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className="ck-nav-link"
                  data-active={pathname === item.href}
                  onClick={onNavigate}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function readSidebarDefaultOpen(): boolean {
  try {
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
    if (match?.[1] === 'false') {
      return false;
    }
  } catch {
    // ignore
  }
  return true;
}

function DocsSidebarNavConnected({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <DocsSidebarNav
      pathname={pathname}
      onNavigate={() => setOpenMobile(false)}
    />
  );
}

function DocsNavToggleButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle documentation navigation"
      onClick={() => toggleSidebar()}
    >
      <Menu className="size-4" />
    </Button>
  );
}

function DocsLayoutInner() {
  const location = useLocation();
  const [sidebarDefaultOpen] = useState(readSidebarDefaultOpen);
  const [headingsState, setHeadingsState] = useState<{
    pathname: string;
    items: DocsHeading[];
  }>({
    pathname: location.pathname,
    items: [],
  });
  const [panelsSheetOpen, setPanelsSheetOpen] = useState(false);
  const { setActiveTab } = useDocsInspector();
  const supportsPropertiesPanel =
    location.pathname.startsWith('/docs/components/');
  const headings =
    headingsState.pathname === location.pathname ? headingsState.items : [];
  const closeSheetsOnRouteChange = useEffectEvent(() => {
    setPanelsSheetOpen(false);
  });

  useEffect(() => {
    setActiveTab('outline');
  }, [location.pathname, setActiveTab]);

  useEffect(() => {
    closeSheetsOnRouteChange();
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    let contentObserver: MutationObserver | null = null;
    let rootObserver: MutationObserver | null = null;

    const readHeadings = (root: Element) => {
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>('h2, h3'),
      ).filter((node) => node.textContent?.trim());
      const ids = new Map<string, number>();
      const next = nodes.map((node) => {
        const title = node.textContent?.trim() ?? '';
        const base = node.id || slugifyHeading(title);
        const count = ids.get(base) ?? 0;
        ids.set(base, count + 1);
        const id = count > 0 ? `${base}-${count + 1}` : base;
        node.id = id;
        return {
          id,
          title,
          level: node.tagName === 'H3' ? 3 : 2,
        } as DocsHeading;
      });

      if (!cancelled) {
        setHeadingsState({
          pathname: location.pathname,
          items: next,
        });
      }
    };

    const connectToRoot = () => {
      const root = document.querySelector('[data-doc-content]');
      if (!root) {
        return false;
      }
      readHeadings(root);
      contentObserver?.disconnect();
      contentObserver = new MutationObserver(() => {
        readHeadings(root);
      });
      contentObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return true;
    };

    if (!connectToRoot()) {
      rootObserver = new MutationObserver(() => {
        if (connectToRoot()) {
          rootObserver?.disconnect();
          rootObserver = null;
        }
      });
      rootObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      cancelled = true;
      contentObserver?.disconnect();
      rootObserver?.disconnect();
    };
  }, [location.pathname]);

  return (
    <SidebarProvider
      defaultOpen={sidebarDefaultOpen}
      style={
        {
          '--sidebar-width': '260px',
        } as CSSProperties
      }
      className="docs-shell ck-shell-bg flex min-h-screen w-full flex-col"
    >
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <DocsNavToggleButton />

            <Link to="/" className="docs-brand">
              <span className="docs-brand-dot" />
              Color Kit
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/introduction">Docs</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/components/color-area">Components</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/shadcn-registry">Registry</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/playground">Playground</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a
                  href="https://github.com/pbroom/color-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </Button>
            </nav>

            <Sheet open={panelsSheetOpen} onOpenChange={setPanelsSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="2xl:hidden"
                >
                  <PanelRightOpen className="size-4" />
                  Panels
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[min(92vw,28rem)] p-4 sm:max-w-md"
              >
                <SheetHeader className="pb-3">
                  <SheetTitle>Page panels</SheetTitle>
                  <SheetDescription>
                    Page outline and interactive demo properties.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1">
                  {supportsPropertiesPanel ? (
                    <Suspense
                      fallback={
                        <DocsOutlineRail
                          headings={headings}
                          className="h-full"
                        />
                      }
                    >
                      <DocsRightRail headings={headings} className="h-full" />
                    </Suspense>
                  ) : (
                    <DocsOutlineRail headings={headings} className="h-full" />
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1560px] flex-1 border-t border-border/60">
        <Sidebar collapsible="offcanvas" variant="sidebar">
          <SidebarRail />
          <SidebarContent
            aria-label="Documentation navigation"
            className="bg-transparent p-0"
          >
            <ScrollArea className="h-full min-h-0 flex-1 pr-2">
              <div className="p-6">
                <DocsSidebarNavConnected pathname={location.pathname} />
              </div>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        <SidebarInset
          id="docs-content"
          className="ck-docs-main-column flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden"
        >
          <div className="container mx-auto w-full min-w-0 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="ck-docs-main min-w-0">
              <article
                className={cn(
                  'ck-docs-article ck-docs-article--gridded prose dark:prose-invert docs-article m-0! w-full! max-w-none! px-5 py-6 md:px-8 md:py-8',
                )}
                data-doc-content=""
              >
                <Outlet />
              </article>
            </div>

            <div
              role="complementary"
              aria-label="Page tools and outline"
              className={cn(
                'sticky top-14 hidden h-[calc(100vh-3.5rem)] min-h-0 w-full min-w-0 -translate-x-2 p-6',
                '2xl:flex 2xl:flex-col',
              )}
            >
              {supportsPropertiesPanel ? (
                <Suspense
                  fallback={
                    <DocsOutlineRail
                      headings={headings}
                      className="min-h-0 flex-1 overflow-hidden"
                    />
                  }
                >
                  <DocsRightRail
                    headings={headings}
                    className="min-h-0 flex-1 overflow-hidden"
                  />
                </Suspense>
              ) : (
                <DocsOutlineRail
                  headings={headings}
                  className="min-h-0 flex-1 overflow-hidden"
                />
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function DocsLayout() {
  return (
    <DocsInspectorProvider>
      <DocsLayoutInner />
    </DocsInspectorProvider>
  );
}
