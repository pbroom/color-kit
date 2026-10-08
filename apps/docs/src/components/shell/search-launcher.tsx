import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useIsApplePlatform } from '@/site/media';
import '@/components/search/search.css';

const loadPanel = () => import('@/components/search/search-panel');
const SearchPanel = lazy(loadPanel);

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/**
 * The search trigger and ⌘K / Ctrl+K / `/` shortcuts. The dialog itself
 * (Base UI, search logic) is a separate chunk, warmed when the browser is
 * idle after load and mounted on first open, so it costs the initial page
 * nothing.
 */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const apple = useIsApplePlatform();

  const show = (next: boolean) => {
    if (next) setMounted(true);
    setOpen(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modK =
        event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      const slash =
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !isTypingTarget(event.target);
      if (modK || slash) {
        event.preventDefault();
        setMounted(true);
        setOpen((value) => (modK ? !value : true));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void loadPanel())
      : window.setTimeout(() => void loadPanel(), 2000);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-trigger"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        onClick={() => show(true)}
        onPointerEnter={() => void loadPanel()}
      >
        <Search aria-hidden="true" size={14} strokeWidth={2} />
        <span className="search-trigger__label">Search</span>
        <kbd className="search-trigger__kbd" aria-hidden="true">
          {apple === false ? 'Ctrl K' : '⌘K'}
        </kbd>
        <span className="visually-hidden">the docs</span>
      </button>
      {mounted ? (
        <Suspense fallback={null}>
          <SearchPanel
            open={open}
            onOpenChange={show}
            returnFocusRef={triggerRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}
