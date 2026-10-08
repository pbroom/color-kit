import { useId, useState } from 'react';
import { KindGlyph } from '@/components/api/kind-glyph';
import { PrefetchLink } from '@/components/prefetch-link';
import { routes, type NavItem } from '@/site/routes';

/**
 * An entry's symbols in the sidebar, one collapsible section per domain.
 * Its own chunk (`site-nav.tsx` loads it lazily), so pages without an API
 * tree, the home page first, never download it.
 */

/** Symbol path → its domain slug (`/api/plane/definePlane` → `compile`). */
const domainByPath = new Map(
  routes
    .filter((route) => route.kind === 'api-symbol')
    .map((route) => [route.path, route.group ?? 'other']),
);

const TITLE_OVERRIDES: Record<string, string> = { hct: 'HCT' };

/** `color-string-input` → `Color string input`, as the entry pages title it. */
function domainTitle(slug: string): string {
  return (
    TITLE_OVERRIDES[slug] ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
  );
}

interface Domain {
  slug: string;
  items: NavItem[];
}

/** Symbols grouped by domain, keeping their display order. */
function groupByDomain(items: readonly NavItem[]): Domain[] {
  const domains = new Map<string, Domain>();
  for (const item of items) {
    const slug = domainByPath.get(item.path) ?? 'other';
    let domain = domains.get(slug);
    if (!domain) {
      domain = { slug, items: [] };
      domains.set(slug, domain);
    }
    domain.items.push(item);
  }
  return [...domains.values()];
}

/**
 * A symbol link: kind glyph, then the name on one line. Long names end in
 * an ellipsis and keep the full name in `title`.
 */
function SymbolLink({
  item,
  currentPath,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <PrefetchLink
      to={item.path}
      className="nav-link"
      data-mono=""
      data-symbol=""
      aria-current={currentPath === item.path ? 'page' : undefined}
      title={item.title}
      onClick={onNavigate}
    >
      {item.meta ? <KindGlyph kind={item.meta} /> : null}
      <span className="nav-link__label">{item.title}</span>
    </PrefetchLink>
  );
}

export interface SidebarSymbolsProps {
  items: readonly NavItem[];
  currentPath: string;
  /** The nav filter has text: show every matching domain open. */
  filtering: boolean;
  onNavigate?: () => void;
}

/**
 * The domain holding the current page starts open and the rest closed, so
 * a 145-symbol entry is a short list of domains. While the nav filter has
 * text, every domain with a match is open.
 */
export default function SidebarSymbols({
  items,
  currentPath,
  filtering,
  onNavigate,
}: SidebarSymbolsProps) {
  const ids = useId();
  // Explicit open/closed choices; anything else follows the current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const domains = groupByDomain(items);

  return (
    <ul className="site-nav__list site-nav__list--nested">
      {domains.map((domain) => {
        const key = domain.slug;
        const containsCurrent = domain.items.some(
          (item) => item.path === currentPath,
        );
        const open = filtering || (toggled[key] ?? containsCurrent);
        const listId = `${ids}-${domain.slug}`;
        return (
          <li key={domain.slug} className="sidebar-domain">
            <button
              type="button"
              className="sidebar-domain__toggle"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              disabled={filtering}
              onClick={() => setToggled((prev) => ({ ...prev, [key]: !open }))}
            >
              <span className="sidebar-domain__chevron" aria-hidden="true" />
              <span className="sidebar-domain__title">
                {domainTitle(domain.slug)}
              </span>
              <span className="sidebar-domain__count">
                {domain.items.length}
              </span>
            </button>
            {open ? (
              <ul id={listId} className="sidebar-domain__list">
                {domain.items.map((item) => (
                  <li key={item.path}>
                    <SymbolLink
                      item={item}
                      currentPath={currentPath}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
