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
import { Search } from 'lucide-react';
import '@/api/search';
import { prefetchHref } from '@/lib/prefetch';
import {
  loadPagefind,
  searchInstant,
  searchProse,
  type SearchHit,
} from '@/site/search';

type ProseState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'ready'; query: string; hits: SearchHit[] }
  | { status: 'unavailable' };

const SECTION_LABELS: Record<SearchHit['kind'], string> = {
  symbol: 'Symbols',
  page: 'Pages',
  prose: 'In the docs',
};

/**
 * The search dialog, loaded on first use by `SearchLauncher`. Symbol and
 * page hits are synchronous and come first; full-text hits come from
 * Pagefind, fetched the first time the dialog opens. The result list is a
 * combobox listbox driven from the input.
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
  const navigate = useNavigate();
  // After choosing a result, focus belongs to the new page's <main>.
  const navigated = useRef(false);
  const listId = useId();
  // Keep the navigation flag through final-focus cleanup; reset on reopen.
  useEffect(() => {
    if (open) navigated.current = false;
  }, [open]);

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

  const instant = searchInstant(trimmed);
  const instantPaths = new Set(instant.map((hit) => hit.href));
  const proseHits =
    prose.status === 'ready' && prose.query === trimmed
      ? prose.hits.filter((hit) => !instantPaths.has(hit.href))
      : [];
  const hits = [...instant, ...proseHits];
  const activeIndex = Math.min(active, Math.max(hits.length - 1, 0));
  const activeHit = hits[activeIndex];

  const go = (hit: SearchHit) => {
    navigated.current = true;
    onOpenChange(false);
    void navigate(hit.href);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (hits.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (activeIndex + step + hits.length) % hits.length;
      setActive(next);
      prefetchHref(hits[next]!.href);
      document
        .getElementById(`${listId}-${next}`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && activeHit) {
      event.preventDefault();
      go(activeHit);
    }
  };

  let status: string | null = null;
  if (trimmed !== '') {
    if (prose.status === 'unavailable') {
      status = 'Full-text search is unavailable. Search titles or try again.';
    } else if (prose.status === 'loading' && hits.length === 0) {
      status = 'Searching…';
    } else if (hits.length === 0 && prose.status === 'ready') {
      status = `Nothing found for “${trimmed}”.`;
    }
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
              aria-expanded={hits.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeHit ? `${listId}-${activeIndex}` : undefined
              }
              aria-label="Search symbols and pages"
              placeholder="Search symbols, concepts, guides"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
            />
            <kbd className="search-dialog__esc">Esc</kbd>
          </div>
          <ul id={listId} role="listbox" className="search-dialog__results">
            {hits.map((hit, index) => {
              const first = index === 0 || hits[index - 1]!.kind !== hit.kind;
              return (
                <li
                  key={hit.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="search-hit"
                  data-kind={hit.kind}
                  data-first={first || undefined}
                  data-section={first ? SECTION_LABELS[hit.kind] : undefined}
                  onPointerMove={() => setActive(index)}
                  onClick={() => go(hit)}
                >
                  <span className="search-hit__title">{hit.title}</span>
                  {hit.meta ? (
                    <span className="search-hit__meta">{hit.meta}</span>
                  ) : null}
                  {hit.excerptHtml ? (
                    <span
                      className="search-hit__excerpt"
                      // Pagefind excerpts: escaped page text plus <mark>.
                      dangerouslySetInnerHTML={{ __html: hit.excerptHtml }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="search-dialog__status" role="status">
            {status}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
