import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { Link } from 'react-router';
import { ArrowRight, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DeferredMount } from '../components/deferred-mount.js';
import { ThemeSwitcher } from '../components/theme-switcher.js';

interface ShowcaseCard {
  title: string;
  description: string;
  href: string;
  className?: string;
  demo: LazyExoticComponent<ComponentType>;
  minHeight?: number;
}

function lazyDemo<TProps extends object>(
  load: () => Promise<{ default: ComponentType<TProps> }>,
) {
  return lazy(load);
}

const ColorAreaDemo = lazyDemo(() =>
  import('../components/component-demos.js').then((module) => ({
    default: module.ColorAreaDemo as ComponentType,
  })),
);
const ColorProviderDemo = lazyDemo(() =>
  import('../components/demos/color-provider-demo.js').then((module) => ({
    default: module.ColorProviderDemo,
  })),
);
const ColorSliderDemo = lazyDemo(() =>
  import('../components/demos/color-slider-demo.js').then((module) => ({
    default: module.ColorSliderDemo,
  })),
);
const ColorInputDemo = lazyDemo(() =>
  import('../components/demos/color-input-demo.js').then((module) => ({
    default: module.ColorInputDemo,
  })),
);

function ShowcaseDemoFallback() {
  return <div className="h-[320px] w-full rounded-xl bg-muted/35" />;
}

const cards: ShowcaseCard[] = [
  {
    title: 'Color Area',
    description: '2D requested-value geometry with deterministic mapping.',
    href: '/docs/components/color-area',
    className: 'span-2',
    demo: ColorAreaDemo,
    minHeight: 320,
  },
  {
    title: 'Color',
    description: 'Shared canonical state for coordinated primitives.',
    href: '/docs/components/color',
    demo: ColorProviderDemo,
    minHeight: 320,
  },
  {
    title: 'Color Slider',
    description: 'Single-axis channel control across lightness, hue, chroma.',
    href: '/docs/components/color-slider',
    demo: ColorSliderDemo,
    minHeight: 320,
  },
  {
    title: 'Color Input',
    description: 'Channel-aware numeric editing with scrub and math parsing.',
    href: '/docs/components/color-input',
    demo: ColorInputDemo,
    minHeight: 220,
  },
];

function ShowcaseCard({ card }: { card: ShowcaseCard }) {
  const Demo = card.demo;

  return (
    <Card
      className="ck-home-card flex flex-col overflow-hidden border-border/70 bg-card/80 shadow-sm backdrop-blur-sm"
      data-span={card.className === 'span-2' ? '2' : undefined}
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-xl tracking-tight">{card.title}</CardTitle>
        <CardDescription className="mt-2 text-sm leading-relaxed">
          {card.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="ck-home-card-demo">
          <DeferredMount
            minHeight={card.minHeight}
            fallback={<ShowcaseDemoFallback />}
          >
            <Suspense fallback={<ShowcaseDemoFallback />}>
              <Demo />
            </Suspense>
          </DeferredMount>
        </div>
      </CardContent>
      <CardFooter className="mt-auto pt-4">
        <Button asChild variant="ghost" className="px-0">
          <Link to={card.href}>
            Open docs
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function HomePage() {
  return (
    <div className="ck-shell-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
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
                <Link to="/playground">Lab</Link>
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
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1560px] flex-col gap-8 px-4 py-8 md:gap-10 md:py-10">
        <section className="p-6 md:p-10">
          <div className="space-y-5">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                The Color Tooling Foundation for Product Teams
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Build color interfaces with requested/displayed intent
                semantics, deterministic gamut mapping, and composable React
                primitives.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/docs/introduction">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/docs/components/color-area">Explore Components</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Interactive Lab Grid
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              This surface doubles as product showcase, performance testbed, and
              visual consistency harness for docs development.
            </p>
          </div>

          <div className="ck-home-grid">
            {cards.map((card) => (
              <ShowcaseCard key={card.title} card={card} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
