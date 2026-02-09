import { Outlet, Link, useLocation } from 'react-router';
import { docsNavigation } from '../content/docs-registry.js';

export function DocsLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl flex h-14 items-center px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="inline-block size-5 rounded-full bg-accent" />
            color-kit
          </Link>
          <nav className="ml-auto flex items-center gap-6 text-sm">
            <Link
              to="/docs/introduction"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <a
              href="https://github.com/pbroom/color-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex flex-1 w-full">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 border-r border-border">
          <nav className="sticky top-14 p-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
            {docsNavigation.map((section) => (
              <div key={section.title} className="mb-6">
                <h4 className="text-sm font-semibold mb-2">{section.title}</h4>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={`block text-sm py-1 px-2 rounded-md transition-colors ${
                          location.pathname === item.href
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'text-muted-foreground hover:text-foreground'
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

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 py-8 md:px-12">
          <div className="prose">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
