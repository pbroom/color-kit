import { useMediaQuery } from '@/site/media';
import { GitHubIcon } from './icons';

const REPO_URL = 'https://github.com/pbroom/color-kit';

/**
 * Reports the viewer's display gamut. The value comes from
 * `matchMedia('(color-gamut: p3)')` after hydration (never during render on
 * the server), and the two chips show the same requested color mapped to
 * each gamut: on a P3 display they visibly differ.
 */
function DisplayGamut() {
  const p3 = useMediaQuery('(color-gamut: p3)');
  const label = p3 == null ? 'detecting' : p3 ? 'Display P3' : 'sRGB';
  return (
    <p className="display-gamut">
      <span className="display-gamut__chips" aria-hidden="true">
        <span className="display-gamut__chip display-gamut__chip--p3" />
        <span className="display-gamut__chip display-gamut__chip--srgb" />
      </span>
      <span>
        Your display:{' '}
        <strong data-pending={p3 == null || undefined}>{label}</strong>
      </span>
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <DisplayGamut />
        <p className="site-footer__meta">
          <span>MIT licensed</span>
          <a href={REPO_URL} className="site-footer__link">
            <GitHubIcon width={14} height={14} />
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
