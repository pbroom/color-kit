import type { SearchHit } from '@/site/search';

const KEY = 'color-kit:recent-searches';
const LIMIT = 5;

/** A result the reader opened, remembered in this browser only. */
export type RecentHit = Pick<SearchHit, 'kind' | 'title' | 'href' | 'meta'>;

function isRecent(value: unknown): value is RecentHit {
  const hit = value as RecentHit | null;
  return (
    typeof hit?.title === 'string' &&
    typeof hit.href === 'string' &&
    hit.href.startsWith('/') &&
    (hit.kind === 'symbol' || hit.kind === 'page' || hit.kind === 'prose')
  );
}

/** Recently opened results, newest first. Empty when storage is unavailable. */
export function readRecent(): RecentHit[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberRecent(hit: SearchHit): RecentHit[] {
  const entry: RecentHit = {
    kind: hit.kind,
    title: hit.title,
    href: hit.href,
    meta: hit.meta,
  };
  const next = [
    entry,
    ...readRecent().filter((item) => item.href !== hit.href),
  ].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: recents are a convenience.
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
