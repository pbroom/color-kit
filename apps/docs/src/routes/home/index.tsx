import { PrefetchLink } from '@/components/prefetch-link';
import { InstallLine } from '@/components/ui/install-line';

/**
 * Home. Placeholder owned by S3, which replaces it with the live OKLCH plane
 * hero (gamut regions, P3 boundary, contrast region) and its source.
 */
const PATHS = [
  {
    to: '/start',
    title: 'Start',
    text: 'Install, parse a color, check its gamut and contrast.',
  },
  {
    to: '/concepts/requested-vs-displayed',
    title: 'Concepts',
    text: 'Why color-kit keeps the color you asked for apart from the one a display can show.',
  },
  {
    to: '/api',
    title: 'API',
    text: 'Every export, by entry point: color-kit, plane, interop, compute, hct, driver, react.',
  },
];

export default function HomePage() {
  return (
    <div className="home">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="home-intro__eyebrow">color-kit@next</p>
        <h1 id="home-title" className="home-intro__title">
          A queryable color engine.
        </h1>
        <p className="home-intro__lede">
          OKLCH-canonical conversion, contrast, gamut geometry and plane
          queries. Ask a color space where its edges are, then draw the answer.
        </p>
        <InstallLine />
      </section>
      <nav className="home-paths" aria-label="Where to go next">
        <ul>
          {PATHS.map((path) => (
            <li key={path.to}>
              <PrefetchLink to={path.to} className="home-path">
                <span className="home-path__title">{path.title}</span>
                <span className="home-path__text">{path.text}</span>
              </PrefetchLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
