import { useCallback, useEffect, useRef, useState } from 'react';

export const SELECT_SUBMENU_HOVER_OPEN_DELAY_MS = 200;

export function useSubmenuHoverTimer<TSubmenuId extends string>({
  enabled,
  trappedOpenSubmenu = null,
}: {
  enabled: boolean;
  trappedOpenSubmenu?: TSubmenuId | null;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<TSubmenuId | null>(null);
  const submenuHoverTimerRef = useRef<number | null>(null);
  const activeOpenSubmenu = enabled
    ? (openSubmenu ?? trappedOpenSubmenu)
    : null;
  const clearSubmenuHoverTimer = useCallback(() => {
    if (submenuHoverTimerRef.current !== null) {
      window.clearTimeout(submenuHoverTimerRef.current);
      submenuHoverTimerRef.current = null;
    }
  }, []);
  const openSubmenuImmediately = useCallback(
    (optionValue: TSubmenuId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu(optionValue);
    },
    [clearSubmenuHoverTimer],
  );
  const scheduleSubmenuHoverOpen = useCallback(
    (optionValue: TSubmenuId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu((current) => (current === optionValue ? current : null));
      submenuHoverTimerRef.current = window.setTimeout(() => {
        submenuHoverTimerRef.current = null;
        setOpenSubmenu(optionValue);
      }, SELECT_SUBMENU_HOVER_OPEN_DELAY_MS);
    },
    [clearSubmenuHoverTimer],
  );
  const closeSubmenu = useCallback(
    (optionValue?: TSubmenuId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu((current) =>
        optionValue && current !== optionValue ? current : null,
      );
    },
    [clearSubmenuHoverTimer],
  );

  useEffect(() => clearSubmenuHoverTimer, [clearSubmenuHoverTimer]);

  return {
    activeOpenSubmenu,
    clearSubmenuHoverTimer,
    closeSubmenu,
    openSubmenuImmediately,
    scheduleSubmenuHoverOpen,
  };
}
