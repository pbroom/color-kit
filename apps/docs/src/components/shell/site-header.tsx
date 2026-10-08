import { PrefetchLink } from '@/components/prefetch-link';
import { GitHubIcon, LogoMark } from './icons';
import { MobileNav } from './mobile-nav';
import { SearchLauncher } from './search-launcher';
import { ThemeToggle } from './theme-toggle';

const REPO_URL = 'https://github.com/pbroom/color-kit';

export function SiteHeader({ currentPath }: { currentPath: string }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <MobileNav currentPath={currentPath} />
        <PrefetchLink to="/" className="wordmark">
          <LogoMark />
          <span className="wordmark__name">color-kit</span>
          <span className="wordmark__tag">next</span>
        </PrefetchLink>
        <nav className="site-header__links" aria-label="Primary">
          <PrefetchLink
            to="/start"
            className="header-link"
            aria-current={currentPath === '/start' ? 'page' : undefined}
            data-active={currentPath === '/start' || undefined}
          >
            Start
          </PrefetchLink>
          <PrefetchLink
            to="/api"
            className="header-link"
            aria-current={currentPath === '/api' ? 'page' : undefined}
            data-active={currentPath.startsWith('/api') || undefined}
          >
            API
          </PrefetchLink>
        </nav>
        <div className="site-header__actions">
          <SearchLauncher />
          <ThemeToggle />
          <a className="icon-button" href={REPO_URL}>
            <GitHubIcon />
            <span className="visually-hidden">color-kit on GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
