import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';

const loadDrawer = () => import('./mobile-nav-drawer');
const MobileNavDrawer = lazy(loadDrawer);

/**
 * The menu button shown below the sidebar breakpoint. The drawer (Base UI)
 * is its own chunk, fetched on first touch/hover/focus of the button.
 */
export function MobileNav({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 60rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button mobile-nav__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={() => void loadDrawer()}
        onFocus={() => void loadDrawer()}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Menu aria-hidden="true" size={18} strokeWidth={1.75} />
        <span className="visually-hidden">Open navigation</span>
      </button>
      {mounted ? (
        <Suspense fallback={null}>
          <MobileNavDrawer
            currentPath={currentPath}
            open={open}
            onOpenChange={setOpen}
            returnFocusRef={triggerRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}
