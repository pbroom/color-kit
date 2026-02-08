import { Link } from 'react-router';

export function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
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

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Primitive UI components for{' '}
            <span className="text-accent">color interfaces</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            An open-source toolkit for building color pickers, palettes, and
            color tools. Headless React primitives powered by OKLCH, with full
            accessibility and zero styling opinions.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/docs/introduction"
              className="inline-flex h-10 items-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/pbroom/color-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-md border border-border px-6 text-sm font-medium hover:bg-muted transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold mb-2">OKLCH-First</h3>
              <p className="text-muted-foreground leading-relaxed">
                Built on the OKLCH color space for perceptually uniform
                gradients, accurate manipulation, and modern CSS compatibility.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Headless Primitives
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Unstyled, composable React components with full keyboard
                navigation and ARIA support. Style with Tailwind, CSS Modules,
                or anything else.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">shadcn Registry</h3>
              <p className="text-muted-foreground leading-relaxed">
                Install components via the shadcn CLI. Copy-paste friendly
                source code that you own and control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <h2 className="text-2xl font-semibold mb-6">Quick Install</h2>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                npm / pnpm
              </p>
              <pre className="bg-muted border border-border rounded-lg p-4 text-sm font-mono overflow-x-auto">
                pnpm add @color-kit/core @color-kit/react
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                shadcn CLI
              </p>
              <pre className="bg-muted border border-border rounded-lg p-4 text-sm font-mono overflow-x-auto">
                npx shadcn add color-area --registry color-kit
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
