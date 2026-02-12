import { Link } from 'react-router';
import type { ReactNode } from 'react';
import {
  ColorAreaDemo,
  ColorDisplayDemo,
  ColorInputDemo,
  ColorProviderDemo,
  ColorSliderDemo,
  ColorWheelDemo,
  ContrastBadgeDemo,
  SwatchGroupDemo,
} from '../components/component-demos.js';
import { ThemeSwitcher } from '../components/theme-switcher.js';

interface ShowcaseCard {
  title: string;
  description: string;
  href: string;
  className?: string;
  demo: ReactNode;
}

const cards: ShowcaseCard[] = [
  {
    title: 'Color Area',
    description: '2D requested-value geometry with deterministic mapping.',
    href: '/docs/components/color-area',
    className: 'span-2',
    demo: <ColorAreaDemo />,
  },
  {
    title: 'Color Provider',
    description: 'Shared canonical state for coordinated primitives.',
    href: '/docs/components/color-provider',
    demo: <ColorProviderDemo />,
  },
  {
    title: 'Color Wheel',
    description: 'Circular hue/chroma control with requested intent semantics.',
    href: '/docs/components/color-wheel',
    demo: <ColorWheelDemo />,
  },
  {
    title: 'Color Slider',
    description: 'Single-axis channel control across lightness, hue, chroma.',
    href: '/docs/components/color-slider',
    demo: <ColorSliderDemo />,
  },
  {
    title: 'Swatch Group',
    description: 'Palette collections for design-tool workflows.',
    href: '/docs/components/swatch-group',
    demo: <SwatchGroupDemo />,
  },
  {
    title: 'Color Input',
    description: 'Channel-aware numeric editing with scrub and math parsing.',
    href: '/docs/components/color-input',
    demo: <ColorInputDemo />,
  },
  {
    title: 'Color Display + Contrast',
    description: 'Rendered output and WCAG validation surfaces.',
    href: '/docs/components/contrast-badge',
    className: 'span-2',
    demo: (
      <div className="landing-duo">
        <ColorDisplayDemo />
        <ContrastBadgeDemo />
      </div>
    ),
  },
];

function ShowcaseCard({ card }: { card: ShowcaseCard }) {
  return (
    <article className={`landing-card ${card.className ?? ''}`}>
      <header>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </header>
      <div className="landing-card-demo">{card.demo}</div>
      <Link to={card.href} className="landing-card-link">
        Open docs
      </Link>
    </article>
  );
}

export function HomePage() {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="docs-brand">
            <span className="docs-brand-dot" />
            Color Kit
          </Link>
          <nav className="landing-nav">
            <Link to="/docs/introduction">Docs</Link>
            <Link to="/docs/components/color-area">Components</Link>
            <Link to="/docs/shadcn-registry">Registry</Link>
            <a
              href="https://github.com/pbroom/color-kit"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
          <ThemeSwitcher />
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-kicker">React Primitives + shadcn Registry</div>
        <h1>The Color Tooling Foundation for Product Teams</h1>
        <p>
          Build color interfaces with requested/displayed intent semantics,
          deterministic gamut mapping, and composable React primitives.
        </p>
        <div className="landing-hero-actions">
          <Link to="/docs/introduction" className="landing-cta-primary">
            Get Started
          </Link>
          <Link
            to="/docs/components/color-area"
            className="landing-cta-secondary"
          >
            Explore Components
          </Link>
        </div>
      </section>

      <section className="landing-grid-wrap">
        <div className="landing-grid-head">
          <h2>Interactive Playground Grid</h2>
          <p>
            This surface doubles as product showcase, performance testbed, and
            visual consistency harness for docs development.
          </p>
        </div>
        <div className="landing-grid">
          {cards.map((card) => (
            <ShowcaseCard key={card.title} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
