import { useEffect, useRef, type RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { SiteNav } from './site-nav';

/**
 * The nav drawer below the sidebar breakpoint, loaded on first use by
 * `MobileNav`: focus is trapped while open, Escape and the backdrop close it,
 * it can be swiped away, and it closes after a link is followed.
 */
export default function MobileNavDrawer({
  currentPath,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  currentPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  // After following a link, focus belongs to the new page's <main>, not the
  // menu button.
  const navigated = useRef(false);
  // Keep the navigation flag through final-focus cleanup; reset on reopen.
  useEffect(() => {
    if (open) navigated.current = false;
  }, [open]);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (
          !next &&
          (navigated.current || !returnFocusRef.current?.offsetParent)
        ) {
          document.getElementById('main')?.focus({ preventScroll: true });
        }
      }}
      swipeDirection="left"
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="overlay-backdrop" />
        <Drawer.Viewport className="mobile-nav__viewport">
          <Drawer.Popup
            className="mobile-nav__popup"
            finalFocus={() => {
              if (navigated.current || !returnFocusRef.current?.offsetParent)
                return false;
              return returnFocusRef.current ?? true;
            }}
          >
            <div className="mobile-nav__header">
              <Drawer.Title className="mobile-nav__title">
                Navigation
              </Drawer.Title>
              <Drawer.Close className="icon-button">
                <X aria-hidden="true" size={18} strokeWidth={1.75} />
                <span className="visually-hidden">Close navigation</span>
              </Drawer.Close>
            </div>
            <Drawer.Content className="mobile-nav__content">
              <SiteNav
                currentPath={currentPath}
                onNavigate={() => {
                  navigated.current = true;
                  onOpenChange(false);
                }}
              />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
