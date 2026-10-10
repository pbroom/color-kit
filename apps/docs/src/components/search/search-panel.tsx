import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { useNavigate } from 'react-router';
import { CornerDownLeft, Search, X } from 'lucide-react';
import '@/api/search';
import { prefetchHref } from '@/lib/prefetch';
import { matchRoute } from '@/site/routes';
import {
  loadPagefind,
  searchInstant,
  searchProse,
  type SearchHit,
} from '@/site/search';
import {
  clearRecent,
  readRecent,
  rememberRecent,
  type RecentHit,
} from './recent-searches';

type ProseState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'ready'; query: string; hits: SearchHit[] }
  | { status: 'unavailable' };

type Section = 'recent' | SearchHit['kind'];

interface Row {
  id: string;
  section: Section;
  hit: SearchHit;
}

const SECTION_LABELS: Record<Section, string> = {
  recent: 'Recent',
  symbol: 'Symbols',
  page: 'Pages',
  prose: 'In the docs',
};

function importPath(entry: string | undefined): string | undefined {
  if (!entry) return undefined;
  return entry === 'core' ? 'color-kit' : `color-kit/${entry}`;
}

/** Symbol hits: name, then kind and the entry point it imports from. */
function HitBody({ hit }: { hit: SearchHit }) {
  if (hit.kind === 'symbol') {
    const route = matchRoute(hit.href);
    return (
      <>
        <span className="search-hit__title">{hit.title}</span>
        <span className="search-hit__meta">
          <span className="search-hit__kind">{route.symbolKind}</span>
          {importPath(route.entry) ?? hit.meta}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="search-hit__title">{hit.title}</span>
      {hit.meta ? <span className="search-hit__meta">{hit.meta}</span> : null}
      {hit.excerptHtml ? (
        <span
          className="search-hit__excerpt"
          // Pagefind excerpts: escaped page text plus <mark> highlights.
          dangerouslySetInnerHTML={{ __html: hit.excerptHtml }}
        />
      ) : null}
    </>
  );
}

/**
 * The ⌘K dialog, loaded on first use by `SearchLauncher`. Symbols come
 * first and arrive instantly from the API route data, each with its kind
 * and entry point; page titles follow; full-text hits from Pagefind (with
 * highlighted excerpts) arrive last. With no query it lists the results
 * opened recently. Arrow keys move, Enter opens, Escape closes; below
 * 640 px it fills the screen.
 */
export default function SearchPanel({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [prose, setProse] = useState<ProseState>({ status: 'idle' });
  const [recent, setRecent] = useState<RecentHit[]>(readRecent);
  const navigate = useNavigate();
  // After choosing a result, focus belongs to the new page's <main>.
  const navigated = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  useEffect(() => {
    if (open) navigated.current = false;
  }, [open]);

  // Every opening starts empty (showing recent results), however the last
  // one ended.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setActive(0);
    }
  }

  const trimmed = query.trim();

  useEffect(() => {
    if (!open || trimmed === '') {
      return;
    }
    let cancelled = false;
    void loadPagefind().then(async (pagefind) => {
      if (cancelled) return;
      if (!pagefind) {
        setProse({ status: 'unavailable' });
        return;
      }
      setProse({ status: 'loading', query: trimmed });
      try {
        const hits = await searchProse(pagefind, trimmed);
        if (!cancelled && hits) {
          setProse({ status: 'ready', query: trimmed, hits });
        }
      } catch {
        if (!cancelled) setProse({ status: 'unavailable' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, trimmed]);

  let rows: Row[];
  if (trimmed === '') {
    rows = recent.map((hit) => ({
      id: `recent:${hit.href}`,
      section: 'recent',
      hit: { ...hit, id: `recent:${hit.href}` },
    }));
  } else {
    const instant = searchInstant(trimmed);
    const seen = new Set(instant.map((hit) => hit.href));
    const proseHits =
      prose.status === 'ready' && prose.query === trimmed
        ? prose.hits.filter((hit) => !seen.has(hit.href))
        : [];
    rows = [...instant, ...proseHits].map((hit) => ({
      id: hit.id,
      section: hit.kind,
      hit,
    }));
  }
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));
  const activeRow = rows[activeIndex];

  const go = (hit: SearchHit) => {
    setRecent(rememberRecent(hit));
    navigated.current = true;
    onOpenChange(false);
    void navigate(hit.href);
  };

  const moveTo = (index: number) => {
    setActive(index);
    prefetchHref(rows[index]!.hit.href);
    listRef.current
      ?.querySelector(`#${CSS.escape(`${listId}-${index}`)}`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = rows.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      moveTo((activeIndex + step + rows.length) % rows.length);
    } else if ((event.key === 'Home' || event.key === 'End') && event.ctrlKey) {
      event.preventDefault();
      if (rows.length > 0) moveTo(event.key === 'Home' ? 0 : last);
    } else if (event.key === 'Enter' && activeRow) {
      event.preventDefault();
      go(activeRow.hit);
    }
  };

  let status: string | null = null;
  if (trimmed !== '') {
    if (prose.status === 'unavailable') {
      status = 'Full-text search is unavailable. Search titles or try again.';
    } else if (
      (prose.status === 'loading' || prose.status === 'idle') &&
      rows.length === 0
    ) {
      status = 'Searching…';
    } else if (rows.length === 0 && prose.status === 'ready') {
      status = `Nothing found for “${trimmed}”.`;
    }
  } else if (rows.length === 0) {
    status = 'Search symbols by name, or the docs for any phrase.';
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (!next) {
          if (navigated.current) {
            document.getElementById('main')?.focus({ preventScroll: true });
          }
          setQuery('');
          setActive(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="overlay-backdrop" />
        <Dialog.Popup
          className="search-dialog"
          aria-label="Search the docs"
          finalFocus={() => {
            if (navigated.current) return false;
            return returnFocusRef.current ?? true;
          }}
        >
          <div className="search-dialog__field">
            <Search aria-hidden="true" size={16} strokeWidth={1.75} />
            <input
              className="search-dialog__input"
              type="text"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeRow ? `${listId}-${activeIndex}` : undefined
              }
              aria-label="Search symbols and pages"
              placeholder="Search symbols, concepts, guides"
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="go"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
            />
            <kbd className="search-dialog__esc">Esc</kbd>
            <Dialog.Close className="icon-button search-dialog__close">
              <X aria-hidden="true" size={18} strokeWidth={1.75} />
              <span className="visually-hidden">Close search</span>
            </Dialog.Close>
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="search-dialog__results"
          >
            {rows.map((row, index) => {
              const first =
                index === 0 || rows[index - 1]!.section !== row.section;
              return (
                <li
                  key={row.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="search-hit"
                  data-kind={row.hit.kind}
                  data-first={first || undefined}
                  data-section={first ? SECTION_LABELS[row.section] : undefined}
                  onPointerMove={() => {
                    if (index !== activeIndex) setActive(index);
                  }}
                  onClick={() => go(row.hit)}
                >
                  <HitBody hit={row.hit} />
                </li>
              );
            })}
          </ul>
          <p className="search-dialog__status" role="status">
            {status}
          </p>
          <div className="search-dialog__footer">
            <span className="search-dialog__keys" aria-hidden="true">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
              </span>
              <span>
                <kbd>
                  <CornerDownLeft size={11} strokeWidth={2} />
                </kbd>{' '}
                open
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </span>
            {trimmed === '' && recent.length > 0 ? (
              <button
                type="button"
                className="search-dialog__clear"
                onClick={() => {
                  clearRecent();
                  setRecent([]);
                }}
              >
                Clear recent
              </button>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
