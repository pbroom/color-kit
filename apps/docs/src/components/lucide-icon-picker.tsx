import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { ChevronDown } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type LazyExoticComponent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { cn } from '@/lib/utils';

/** Sorted slugs matching `lucide-react/dynamicIconImports` (lazy, per-icon chunks). */
export const LUCIDE_DYNAMIC_ICON_SLUGS: readonly string[] = Object.keys(
  dynamicIconImports,
).sort((a, b) => a.localeCompare(b));

const ROW_HEIGHT_PX = 34;
const LIST_MAX_HEIGHT_PX = 240;
const ROW_OVERSCAN = 10;

const LUCIDE_SEARCH_ALIASES: Record<string, readonly string[]> = {
  circle: ['dot'],
  'circle-help': ['help', 'question'],
  'circle-x': ['close', 'dismiss', 'remove'],
  cog: ['settings'],
  copy: ['duplicate'],
  minus: ['remove', 'subtract'],
  plus: ['add', 'create', 'new'],
  search: ['find', 'magnify'],
  settings: ['cog', 'gear', 'preferences'],
  'sliders-horizontal': ['controls', 'settings', 'tune'],
  'square-pen': ['edit', 'write'],
  trash: ['delete', 'remove'],
  'trash-2': ['delete', 'remove'],
  'triangle-alert': ['alert', 'warning'],
  x: ['close', 'dismiss', 'remove'],
};

type GlyphProps = {
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true';
};

type LucideGlyphComponent = ComponentType<GlyphProps>;

type LazyLucideEntry = LazyExoticComponent<LucideGlyphComponent>;

function createLazyLucideGlyph(slug: string): LazyLucideEntry {
  return lazy(async () => {
    const load = dynamicIconImports[slug as keyof typeof dynamicIconImports];
    if (!load) {
      const Fallback: LucideGlyphComponent = () => null;
      return { default: Fallback };
    }
    const mod = await load();
    return { default: mod.default as LucideGlyphComponent };
  });
}

const lazyLucideGlyphCache = new Map<string, LazyLucideEntry>();

function getLazyLucideGlyph(resolved: string): LazyLucideEntry {
  let entry = lazyLucideGlyphCache.get(resolved);
  if (!entry) {
    entry = createLazyLucideGlyph(resolved);
    lazyLucideGlyphCache.set(resolved, entry);
  }
  return entry;
}

export function formatLucideSlugLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveDynamicSlug(slug: string): string {
  if (slug && dynamicIconImports[slug as keyof typeof dynamicIconImports]) {
    return slug;
  }
  return 'circle-help';
}

function keepMenuSearchFocusedOnMouseDown(
  event: ReactMouseEvent<HTMLElement>,
): void {
  event.preventDefault();
}

const DynamicLucideGlyph = memo(function DynamicLucideGlyph({
  slug,
  className,
  strokeWidth = 1.75,
}: {
  slug: string;
  className?: string;
  strokeWidth?: number;
}) {
  const resolved = resolveDynamicSlug(slug);
  /* eslint-disable react-hooks/static-components -- Slug resolves through `getLazyLucideGlyph`, which returns a cached module-level `lazy()` wrapper per icon. */
  const LazyIcon = getLazyLucideGlyph(resolved);

  const glyph = (
    <Suspense
      fallback={
        <span
          className={cn(
            'inline-block size-3.5 animate-pulse rounded bg-white/15',
            className,
          )}
          aria-hidden
        />
      }
    >
      <LazyIcon className={className} strokeWidth={strokeWidth} aria-hidden />
    </Suspense>
  );
  /* eslint-enable react-hooks/static-components */
  return glyph;
});

/** Renders a Lucide icon by dynamic slug; falls back to `circle-help` when unknown. */
export function DynamicLucideIcon({
  slug,
  className,
  strokeWidth = 1.75,
}: {
  slug: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <DynamicLucideGlyph
      slug={slug}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}

function searchLucideSlugs(
  slugs: readonly string[],
  query: string,
): readonly string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return slugs;
  }

  const compact = trimmed.replace(/-/g, '');
  if (!compact) {
    return slugs;
  }

  const terms = trimmed.split(/[\s-]+/).filter(Boolean);

  return slugs
    .map((slug) => {
      const score = scoreLucideSlugMatch(slug, trimmed, compact, terms);
      return score === null ? null : { slug, score };
    })
    .filter((match): match is { slug: string; score: number } => match !== null)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      if (a.slug.length !== b.slug.length) {
        return a.slug.length - b.slug.length;
      }
      return a.slug.localeCompare(b.slug);
    })
    .map((match) => match.slug);
}

function scoreLucideSlugMatch(
  slug: string,
  query: string,
  compactQuery: string,
  terms: readonly string[],
): number | null {
  const compactSlug = slug.replace(/-/g, '');
  const tokens = slug.split('-').filter(Boolean);

  if (slug === query || compactSlug === compactQuery) {
    return 0;
  }
  if (slug.startsWith(query)) {
    return 10;
  }
  if (compactSlug.startsWith(compactQuery)) {
    return 20;
  }
  const aliasScore = scoreLucideAliasMatch(slug, query, terms);
  if (aliasScore !== null) {
    return aliasScore;
  }
  if (tokens.some((token) => token === query)) {
    return 30;
  }
  if (tokens.some((token) => token.startsWith(query))) {
    return 40;
  }
  if (terms.length > 1 && terms.every((term) => slug.includes(term))) {
    return 50;
  }
  if (slug.includes(query)) {
    return 60 + slug.indexOf(query);
  }
  if (compactSlug.includes(compactQuery)) {
    return 80 + compactSlug.indexOf(compactQuery);
  }
  if (matchesOrderedCharacters(compactSlug, compactQuery)) {
    return 120 + compactSlug.length - compactQuery.length;
  }

  return null;
}

function scoreLucideAliasMatch(
  slug: string,
  query: string,
  terms: readonly string[],
): number | null {
  const tokens = slug.split('-').filter(Boolean);

  for (const [tokenIdx, token] of tokens.entries()) {
    const aliases = LUCIDE_SEARCH_ALIASES[token];
    if (!aliases) {
      continue;
    }

    if (aliases.some((alias) => alias === query)) {
      return tokenIdx === 0 ? 25 : 45;
    }

    if (
      terms.length > 0 &&
      terms.every((term) =>
        aliases.some((alias) => alias === term || alias.startsWith(term)),
      )
    ) {
      return tokenIdx === 0 ? 35 : 55;
    }
  }

  const slugAliases = LUCIDE_SEARCH_ALIASES[slug];
  if (slugAliases?.some((alias) => alias === query)) {
    return 25;
  }

  return null;
}

function matchesOrderedCharacters(value: string, query: string): boolean {
  let queryIdx = 0;

  for (const char of value) {
    if (char === query[queryIdx]) {
      queryIdx += 1;
      if (queryIdx === query.length) {
        return true;
      }
    }
  }

  return false;
}

type VirtualLucideRowsProps = {
  activeSlug: string | null;
  getOptionId: (slug: string) => string;
  listboxId: string;
  slugs: readonly string[];
  selectedSlug: string;
  /** Live search text (not deferred): query changes reset scroll to top. */
  searchTrimmed: string;
  onActiveChange: (slug: string) => void;
  onPick: (slug: string) => void;
};

const VirtualLucideRows = memo(function VirtualLucideRows({
  activeSlug,
  getOptionId,
  listboxId,
  slugs,
  selectedSlug,
  searchTrimmed,
  onActiveChange,
  onPick,
}: VirtualLucideRowsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setScrollTop(el.scrollTop);
  }, []);

  const totalHeight = slugs.length * ROW_HEIGHT_PX;

  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT_PX) - ROW_OVERSCAN,
  );
  const endIdx = Math.min(
    slugs.length,
    Math.ceil((scrollTop + LIST_MAX_HEIGHT_PX) / ROW_HEIGHT_PX) + ROW_OVERSCAN,
  );

  const topSpacer = startIdx * ROW_HEIGHT_PX;
  const bottomSpacer = Math.max(0, totalHeight - endIdx * ROW_HEIGHT_PX);

  const slice = slugs.slice(startIdx, endIdx);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Virtual list scroll state mirrors the DOM scrollTop before paint. */
    const el = scrollRef.current;
    if (!el || searchTrimmed === '') {
      return;
    }
    el.scrollTop = 0;
    setScrollTop(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchTrimmed]);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Virtual list state must match programmatic scrollTop before paint. */
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const idx =
      activeSlug !== null
        ? slugs.indexOf(activeSlug)
        : slugs.indexOf(selectedSlug);
    if (idx < 0) {
      el.scrollTop = 0;
      setScrollTop(0);
      return;
    }

    const totalH = slugs.length * ROW_HEIGHT_PX;
    const maxScroll = Math.max(0, totalH - LIST_MAX_HEIGHT_PX);
    const rowTop = idx * ROW_HEIGHT_PX;
    const rowBottom = rowTop + ROW_HEIGHT_PX;
    const visibleTop = el.scrollTop;
    const visibleBottom = visibleTop + LIST_MAX_HEIGHT_PX;
    let nextTop = visibleTop;

    if (rowTop < visibleTop) {
      nextTop = rowTop;
    } else if (rowBottom > visibleBottom) {
      nextTop = rowBottom - LIST_MAX_HEIGHT_PX;
    }

    nextTop = Math.min(Math.max(0, nextTop), maxScroll);
    el.scrollTop = nextTop;
    setScrollTop(nextTop);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeSlug, slugs, selectedSlug]);

  return (
    <div
      id={listboxId}
      ref={scrollRef}
      role="listbox"
      aria-label="Lucide icons"
      className="overflow-y-auto overscroll-contain"
      style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
      onScroll={onScroll}
    >
      {topSpacer > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none shrink-0"
          style={{ height: topSpacer }}
        />
      ) : null}
      {slice.map((slug, sliceIdx) => {
        const selected = slug === selectedSlug;
        const active = slug === activeSlug;
        const posInSet = startIdx + sliceIdx + 1;
        return (
          <div
            key={slug}
            id={getOptionId(slug)}
            role="option"
            aria-selected={selected}
            aria-posinset={posInSet}
            aria-setsize={slugs.length}
            className={cn(
              'flex h-[34px] min-h-[34px] w-full cursor-pointer items-center gap-2 rounded-[4px] px-2 py-0 text-left text-[11px] font-medium text-white/85 outline-none hover:bg-white/12',
              selected && 'bg-white/[0.14]',
              active && 'bg-white/12',
            )}
            onMouseDown={keepMenuSearchFocusedOnMouseDown}
            onMouseMove={() => {
              onActiveChange(slug);
            }}
            onClick={() => {
              onPick(slug);
            }}
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-white/75">
              <DynamicLucideGlyph
                slug={slug}
                className="size-3.5"
                strokeWidth={1.75}
              />
            </span>
            <span className="min-w-0 flex-1 truncate" title={slug}>
              {formatLucideSlugLabel(slug)}
            </span>
          </div>
        );
      })}
      {bottomSpacer > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none shrink-0"
          style={{ height: bottomSpacer }}
        />
      ) : null}
    </div>
  );
});

export function LucideIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [immediateFiltered, setImmediateFiltered] = useState<readonly string[]>(
    LUCIDE_DYNAMIC_ICON_SLUGS,
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pickerId = useId();
  const filtered = useDeferredValue(immediateFiltered);
  const resolvedValue = resolveDynamicSlug(value);
  const listboxId = `${pickerId}-lucide-icon-listbox`;
  const activeOptionId =
    activeSlug !== null
      ? `${pickerId}-lucide-icon-option-${activeSlug}`
      : undefined;

  const getOptionId = useCallback(
    (slug: string) => `${pickerId}-lucide-icon-option-${slug}`,
    [pickerId],
  );

  const resetSearch = useCallback(() => {
    setSearch('');
    setImmediateFiltered(LUCIDE_DYNAMIC_ICON_SLUGS);
  }, []);

  const pickSlug = useCallback(
    (slug: string) => {
      onChange(slug);
      setOpen(false);
      resetSearch();
      setActiveSlug(null);
      triggerRef.current?.focus({ preventScroll: true });
    },
    [onChange, resetSearch],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setActiveSlug(resolvedValue);
        return;
      }

      resetSearch();
      setActiveSlug(null);
    },
    [resetSearch, resolvedValue],
  );

  const handleSearchChange = useCallback((nextSearch: string) => {
    const nextFiltered = searchLucideSlugs(
      LUCIDE_DYNAMIC_ICON_SLUGS,
      nextSearch,
    );
    setSearch(nextSearch);
    setImmediateFiltered(nextFiltered);
    setActiveSlug(nextFiltered[0] ?? null);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        resetSearch();
        setActiveSlug(null);
        triggerRef.current?.focus({ preventScroll: true });
        return;
      }

      if (event.key === 'Enter') {
        const selectedSlug =
          activeSlug !== null && immediateFiltered.includes(activeSlug)
            ? activeSlug
            : immediateFiltered[0];

        if (!selectedSlug) {
          return;
        }

        event.preventDefault();
        pickSlug(selectedSlug);
        return;
      }

      if (immediateFiltered.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSlug((current) => {
          const currentIdx =
            current === null ? -1 : immediateFiltered.indexOf(current);
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          const nextIdx =
            currentIdx < 0
              ? event.key === 'ArrowDown'
                ? 0
                : immediateFiltered.length - 1
              : (currentIdx + offset + immediateFiltered.length) %
                immediateFiltered.length;
          return immediateFiltered[nextIdx] ?? null;
        });
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setActiveSlug(immediateFiltered[0] ?? null);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        setActiveSlug(immediateFiltered[immediateFiltered.length - 1] ?? null);
      }
    },
    [activeSlug, immediateFiltered, pickSlug, resetSearch],
  );

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    queueMicrotask(() => {
      const input = searchInputRef.current;
      if (!input) {
        return;
      }
      input.focus({ preventScroll: true });
    });
  }, [open]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="flex h-6 w-full items-center gap-2 rounded-[5px] border border-transparent bg-[#383838] px-2 text-left text-[11px] font-medium text-white outline-none transition-[border-color] hover:border-[#4C4C4C] focus-visible:border-[#5288db]"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={`Choose Lucide icon. Current icon: ${formatLucideSlugLabel(
            resolvedValue,
          )}.`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-white/75">
            <DynamicLucideGlyph
              slug={resolvedValue}
              className="size-3.5"
              strokeWidth={1.75}
            />
          </span>
          <span className="min-w-0 flex-1 truncate" title={resolvedValue}>
            {formatLucideSlugLabel(resolvedValue)}
          </span>
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-white/45"
            strokeWidth={2}
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-white/10 bg-[#2a2a2a] p-0 text-white shadow-lg outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <div className="border-b border-white/10 p-2">
            <input
              ref={searchInputRef}
              role="combobox"
              type="text"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search icons…"
              autoComplete="off"
              spellCheck={false}
              className="h-6 w-full rounded-[4px] border border-transparent bg-[#383838] px-2 text-[11px] font-medium text-white outline-none transition-[border-color] placeholder:text-white/35 focus:border-[#5288db]"
              aria-label="Search Lucide icons"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-activedescendant={activeOptionId}
            />
          </div>
          {filtered.length === 0 ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Lucide icons"
              className="px-3 py-6 text-center text-[11px] text-white/45"
            >
              <span role="status" aria-live="polite">
                No icons match “{search.trim()}”.
              </span>
            </div>
          ) : (
            <VirtualLucideRows
              activeSlug={activeSlug}
              getOptionId={getOptionId}
              listboxId={listboxId}
              slugs={filtered}
              selectedSlug={resolvedValue}
              searchTrimmed={search.trim()}
              onActiveChange={setActiveSlug}
              onPick={pickSlug}
            />
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
