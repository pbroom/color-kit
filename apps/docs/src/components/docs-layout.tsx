import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { docsNavigation } from '../content/docs-registry.js';
import {
  DocsInspectorProvider,
  useDocsInspector,
} from './docs-inspector-context.js';
import { DocsRightRail, type DocsHeading } from './docs-right-rail.js';
import { ThemeSwitcher } from './theme-switcher.js';

function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function DocsLayoutInner() {
  const location = useLocation();
  const [headingsState, setHeadingsState] = useState<{
    pathname: string;
    items: DocsHeading[];
  }>({
    pathname: location.pathname,
    items: [],
  });
  const { setActiveTab } = useDocsInspector();
  const headings =
    headingsState.pathname === location.pathname ? headingsState.items : [];

  useEffect(() => {
    setActiveTab('outline');
  }, [location.pathname, setActiveTab]);

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
    <div className="docs-shell">
      <header className="docs-header">
        <div className="docs-header-inner">
          <Link to="/" className="docs-brand">
            <span className="docs-brand-dot" />
            Color Kit
          </Link>
          <div className="docs-header-actions">
            <nav className="docs-header-nav">
              <Link to="/docs/introduction" className="docs-top-link">
                Docs
              </Link>
              <Link to="/docs/components/color-area" className="docs-top-link">
                Components
              </Link>
              <Link to="/docs/shadcn-registry" className="docs-top-link">
                Registry
              </Link>
              <a
                href="https://github.com/pbroom/color-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="docs-top-link"
              >
                GitHub
              </a>
            </nav>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="docs-body">
        <aside className="docs-left-rail">
          <nav>
            {docsNavigation.map((section) => (
              <div key={section.title} className="docs-nav-section">
                <h4>{section.title}</h4>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={`docs-side-link ${
                          location.pathname === item.href
                            ? 'is-active'
                            : undefined
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="docs-main">
          <article className="prose docs-article" data-doc-content="">
            <Outlet />
          </article>
        </main>

        <DocsRightRail headings={headings} />
      </div>
    </div>
  );
}

export function DocsLayout() {
  return (
    <DocsInspectorProvider>
      <DocsLayoutInner />
    </DocsInspectorProvider>
  );
}
