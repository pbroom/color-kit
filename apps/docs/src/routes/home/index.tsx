import { PrefetchLink } from '@/components/prefetch-link';
import { PlaneHero } from '@/components/hero/plane-hero';
import { CodeBlock } from '@/components/ui/code-block';
import { InstallLine } from '@/components/ui/install-line';
import heroHtml, {
  code as heroCode,
  filename as heroFilename,
} from '@/examples/plane/hero.ts?highlighted';
import './home.css';

const QUESTIONS = [
  {
    question: 'Can this display show it?',
    call: 'inP3Gamut(color)',
    to: '/concepts/requested-vs-displayed',
    where: 'Requested vs displayed',
  },
  {
    question: 'Where does the gamut end?',
    call: 'sense(plane).gamutRegion()',
    to: '/api/plane',
    where: 'color-kit/plane',
  },
  {
    question: 'Does this text pass AA?',
    call: 'contrastRatio(text, background)',
    to: '/api/core',
    where: 'color-kit',
  },
];

export default function HomePage() {
  return (
    <div className="home">
      <header className="home-intro">
        <h1 className="home-intro__title">A queryable OKLCH color engine.</h1>
        <p className="home-intro__lede">
          Convert, gamut-map and measure color in OKLCH, then ask a color space
          where its edges are and get geometry back. Everything in the plane
          below is a color-kit query, recomputed as you turn the hue.
        </p>
      </header>

      <PlaneHero />

      <div className="home-install">
        <InstallLine />
      </div>

      <section className="home-asks" aria-labelledby="home-asks-title">
        <h2 id="home-asks-title" className="home-section-title">
          What you can ask
        </h2>
        <ul className="home-asks__list">
          {QUESTIONS.map((item) => (
            <li key={item.call}>
              <PrefetchLink to={item.to} className="home-ask">
                <span className="home-ask__question">{item.question}</span>
                <code className="home-ask__call">{item.call}</code>
                <span className="home-ask__where">
                  {item.where}
                  <span aria-hidden="true"> →</span>
                </span>
              </PrefetchLink>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-source" aria-labelledby="home-source-title">
        <h2 id="home-source-title" className="home-section-title">
          This is the code drawing the plane above
        </h2>
        <p className="home-source__note">
          <code>queryHue</code> ran once at build time to prerender the first
          frame, and runs again in your browser on every hue change.{' '}
          <code>paintPlane</code> fills the canvas, one allocation-free{' '}
          <code>toP3Into</code> per cell.
        </p>
        <CodeBlock html={heroHtml} code={heroCode} filename={heroFilename} />
      </section>
    </div>
  );
}
