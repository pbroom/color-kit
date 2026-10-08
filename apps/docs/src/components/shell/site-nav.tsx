import { lazy, Suspense, useId, useState } from 'react';
import { PrefetchLink } from '@/components/prefetch-link';
import { navigation, type NavGroup, type NavItem } from '@/site/routes';
import './sidebar.css';

// API symbol trees (domains, kind glyphs) are their own chunk: the home page
// never shows one, so it never pays for it.
const SidebarSymbols = lazy(() => import('./sidebar-tree'));

/** Groups that hold one page render as a plain top-level link. */
const SOLO_GROUPS = new Set(['start', 'map']);

function matches(item: NavItem, query: string): boolean {
  return item.title.toLowerCase().includes(query);
}

function filterGroups(groups: readonly NavGroup[], query: string): NavGroup[] {
  if (!query) {
    return [...groups];
  }
  return groups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item) => {
        const children = item.children?.filter((child) =>
          matches(child, query),
        );
        if (matches(item, query) || (children && children.length > 0)) {
          return [{ ...item, children }];
        }
        return [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function isWithin(currentPath: string, path: string): boolean {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

interface NavLinkProps {
  item: NavItem;
  currentPath: string;
  onNavigate?: () => void;
  label?: string;
}

function NavLink({ item, currentPath, onNavigate, label }: NavLinkProps) {
  const current = currentPath === item.path;
  const mono = item.kind === 'api-entry';
  return (
    <PrefetchLink
      to={item.path}
      className="nav-link"
      data-mono={mono || undefined}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
    >
      <span className="nav-link__label">{label ?? item.title}</span>
    </PrefetchLink>
  );
}

export interface SiteNavProps {
  currentPath: string;
  /** Called after a link is activated (the mobile drawer closes on it). */
  onNavigate?: () => void;
}

/**
 * The documentation nav: Start, Concepts, Guides, API by entry point in
 * package order (symbols expand under the current entry), then Map. The
 * filter narrows every level, symbols included.
 */
export function SiteNav({ currentPath, onNavigate }: SiteNavProps) {
  const [filter, setFilter] = useState('');
  const filterId = useId();
  const query = filter.trim().toLowerCase();
  const groups = filterGroups(navigation, query);

  return (
    <nav className="site-nav" aria-label="Documentation">
      <div className="site-nav__filter">
        <label className="visually-hidden" htmlFor={filterId}>
          Filter navigation
        </label>
        <input
          id={filterId}
          className="field"
          type="search"
          placeholder="Filter"
          autoComplete="off"
          spellCheck={false}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      {groups.map((group) => {
        if (SOLO_GROUPS.has(group.id) && group.items.length === 1) {
          return (
            <div key={group.id} className="site-nav__solo">
              <NavLink
                item={group.items[0]!}
                currentPath={currentPath}
                onNavigate={onNavigate}
                label={group.title}
              />
            </div>
          );
        }
        const headingId = `${filterId}-${group.id}`;
        return (
          <section
            key={group.id}
            className="site-nav__group"
            aria-labelledby={headingId}
          >
            <h2 id={headingId} className="site-nav__heading">
              {group.title}
            </h2>
            <ul className="site-nav__list">
              {group.items.map((item) => {
                const expanded =
                  item.children &&
                  item.children.length > 0 &&
                  (query !== '' || isWithin(currentPath, item.path));
                return (
                  <li key={item.path}>
                    <NavLink
                      item={item}
                      currentPath={currentPath}
                      onNavigate={onNavigate}
                    />
                    {expanded ? (
                      <Suspense>
                        <SidebarSymbols
                          items={item.children!}
                          currentPath={currentPath}
                          filtering={!!query}
                          onNavigate={onNavigate}
                        />
                      </Suspense>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {groups.length === 0 ? (
        <p className="site-nav__empty">Nothing matches “{filter.trim()}”.</p>
      ) : null}
    </nav>
  );
}
