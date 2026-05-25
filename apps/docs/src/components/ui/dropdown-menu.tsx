import * as React from 'react';
import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type DropdownMenuVariant = 'default' | 'ui3';
type DropdownMenuDensity = 'compact' | 'comfortable';
type DropdownMenuPanelKind = 'content' | 'subcontent';
type DropdownMenuTypeaheadItem = {
  element: HTMLElement;
  label: string;
};
type DropdownMenuTypeaheadKeyboardEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  target: EventTarget | null;
};
const dropdownMenuUi3OpenAnimationClass =
  'data-[open]:[animation-delay:-35ms] data-[open]:[animation-duration:90ms] data-[open]:[animation-fill-mode:both] data-[open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[open]:[--tw-enter-opacity:0.28] data-[open]:[--tw-enter-scale:0.985] data-[open]:[--tw-enter-translate-y:-1px] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none';
const dropdownMenuUi3ContentClass = `w-[208px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${dropdownMenuUi3OpenAnimationClass}`;
const dropdownMenuUi3SubContentClass = `w-[176px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${dropdownMenuUi3OpenAnimationClass}`;
const dropdownMenuUi3ItemDensityClass: Record<DropdownMenuDensity, string> = {
  compact: 'h-6 min-h-6',
  comfortable: 'h-7 min-h-7',
};
const dropdownMenuUi3ItemClass =
  'group relative flex w-full cursor-default select-none items-center justify-start gap-0 rounded-[5px] px-2 py-0 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white outline-none hover:bg-[#0d99ff] hover:text-white focus-visible:bg-[#0d99ff] focus-visible:text-white data-[dropdown-menu-typeahead-active=true]:!bg-[#0d99ff] data-[dropdown-menu-typeahead-active=true]:!text-white data-[highlighted]:bg-[#0d99ff] data-[highlighted]:text-white data-[popup-open]:bg-[#303030] data-[popup-open]:text-white data-[highlighted]:data-[popup-open]:bg-[#0d99ff] data-[dropdown-menu-submenu-child-active=true]:!bg-[#303030] data-[dropdown-menu-submenu-child-active=true]:!text-white data-[dropdown-menu-suppress-pointer-hover=true]:hover:bg-transparent data-[dropdown-menu-suppress-pointer-hover=true]:hover:text-white data-[dropdown-menu-suppress-pointer-hover=true]:data-[highlighted]:bg-transparent data-[dropdown-menu-suppress-pointer-hover=true]:data-[highlighted]:text-white';
const dropdownMenuUi3ItemDisabledClass =
  'disabled:text-white/35 disabled:hover:bg-transparent data-[disabled]:text-white/35 data-[disabled]:hover:bg-transparent data-[disabled]:focus-visible:bg-transparent';
const dropdownMenuUi3SeparatorClass = 'mx-0 my-2 h-px bg-[#383838]';
const DROPDOWN_MENU_TYPEAHEAD_RESET_MS = 500;
const DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE =
  'data-dropdown-menu-typeahead-active';
const DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE =
  'data-dropdown-menu-suppress-pointer-hover';
const DROPDOWN_MENU_SUBMENU_CHILD_ACTIVE_ATTRIBUTE =
  'data-dropdown-menu-submenu-child-active';
const DROPDOWN_MENU_KEYBOARD_NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }

      if (typeof ref === 'function') {
        ref(node);
      } else {
        ref.current = node;
      }
    }
  };
}

function cloneDropdownMenuRenderElement<P extends { className?: string }>(
  element: React.ReactElement,
  props: P,
  extraProps?: Record<string, unknown>,
) {
  const elementProps = element.props as {
    className?: string;
    ref?: React.Ref<unknown>;
  };

  return React.cloneElement(element, {
    ...props,
    ...extraProps,
    className: cn(elementProps.className, props.className),
    ref: composeRefs(
      elementProps.ref,
      (props as { ref?: React.Ref<unknown> }).ref,
    ),
  });
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeTypeaheadLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function shouldHandleDropdownMenuTypeahead(
  event: DropdownMenuTypeaheadKeyboardEvent,
) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [data-dropdown-menu-typeahead-ignore]',
    )
  ) {
    return false;
  }

  return (
    event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey
  );
}

function shouldHandleDropdownMenuKeyboardNavigation(
  event: DropdownMenuTypeaheadKeyboardEvent,
) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [data-dropdown-menu-typeahead-ignore]',
    )
  ) {
    return false;
  }

  return (
    DROPDOWN_MENU_KEYBOARD_NAVIGATION_KEYS.has(event.key) &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

function shouldRouteDropdownMenuTypeaheadToContent(
  content: HTMLElement,
  target: EventTarget | null,
) {
  if (!(target instanceof Node)) {
    return false;
  }

  if (content.contains(target)) {
    return true;
  }

  const trigger = getOpenTriggerForContent(content);
  return Boolean(trigger?.contains(target));
}

function getDropdownMenuTypeaheadItems(
  content: HTMLElement,
): DropdownMenuTypeaheadItem[] {
  return Array.from(
    content.querySelectorAll<HTMLElement>(
      '[data-dropdown-menu-typeahead-item]',
    ),
  ).flatMap((element) => {
    if (
      element.matches(
        '[disabled], [aria-disabled="true"], [data-disabled], [data-closed]',
      )
    ) {
      return [];
    }

    const label = normalizeTypeaheadLabel(
      element.dataset.dropdownMenuTypeaheadLabel ?? element.textContent ?? '',
    );

    if (!label) {
      return [];
    }

    return [{ element, label }];
  });
}

function getDropdownMenuTypeaheadActiveIndex(
  items: DropdownMenuTypeaheadItem[],
) {
  const activeAttributeIndex = items.findIndex((item) =>
    item.element.hasAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE),
  );

  if (activeAttributeIndex >= 0) {
    return activeAttributeIndex;
  }

  return items.findIndex((item) => item.element === document.activeElement);
}

function getDropdownMenuTypeaheadMatchIndex({
  buffer,
  items,
}: {
  buffer: string;
  items: DropdownMenuTypeaheadItem[];
}) {
  if (items.length === 0) {
    return -1;
  }

  const activeIndex = getDropdownMenuTypeaheadActiveIndex(items);
  const startIndex = activeIndex >= 0 ? activeIndex + 1 : 0;

  for (let offset = 0; offset < items.length; offset += 1) {
    const index = (startIndex + offset) % items.length;
    if (items[index]?.label.startsWith(buffer)) {
      return index;
    }
  }

  const isRepeatedCharacter =
    buffer.length > 1 && Array.from(buffer).every((char) => char === buffer[0]);
  if (isRepeatedCharacter) {
    const searchText = buffer[0];

    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (startIndex + offset) % items.length;
      if (items[index]?.label.startsWith(searchText)) {
        return index;
      }
    }
  }

  return -1;
}

function suppressDropdownMenuPointerHover(content: HTMLElement) {
  content
    .querySelectorAll<HTMLElement>('[data-dropdown-menu-typeahead-item]')
    .forEach((item) => {
      item.setAttribute(DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE, 'true');
    });
}

function setDropdownMenuTypeaheadActiveItem(
  content: HTMLElement,
  nextItem: HTMLElement,
  {
    focus = true,
    scroll = true,
  }: {
    focus?: boolean;
    scroll?: boolean;
  } = {},
) {
  content
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE}]`,
    )
    .forEach((item) => {
      item.removeAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE);
    });

  const itemContent =
    nextItem.closest<HTMLElement>(
      '[data-slot="dropdown-menu-sub-content"], [data-slot="dropdown-menu-content"]',
    ) ?? content;

  nextItem.setAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE, 'true');
  setSubmenuTriggerChildActive(itemContent, true);
  suppressDropdownMenuPointerHover(content);

  if (focus) {
    nextItem.focus({ preventScroll: true });
  }

  if (scroll) {
    nextItem.scrollIntoView({ block: 'nearest' });
  }
}

function clearDropdownMenuTypeaheadActiveItems(content: HTMLElement) {
  content
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE}]`,
    )
    .forEach((item) => {
      item.removeAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE);
    });
}

function clearDropdownMenuPointerHoverSuppression(content: HTMLElement) {
  content
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE}]`,
    )
    .forEach((item) => {
      item.removeAttribute(DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE);
    });
}

function clearDocumentDropdownMenuKeyboardActiveItems(document: Document) {
  document
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE}]`,
    )
    .forEach((item) => {
      item.removeAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE);
    });

  document
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE}]`,
    )
    .forEach((item) => {
      item.removeAttribute(DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE);
    });
}

function getDropdownMenuKeyboardNavigationActiveItem(
  content: HTMLElement,
): HTMLElement | null {
  const activeElement = content.ownerDocument.activeElement;

  if (activeElement instanceof HTMLElement && content.contains(activeElement)) {
    const focusedItem = activeElement.closest<HTMLElement>(
      '[data-dropdown-menu-typeahead-item]',
    );

    if (focusedItem) {
      return focusedItem;
    }
  }

  return content.querySelector<HTMLElement>(
    '[data-dropdown-menu-typeahead-item][data-highlighted]',
  );
}

function getDropdownMenuKeyboardNavigationBaseIndex({
  content,
  items,
}: {
  content: HTMLElement;
  items: DropdownMenuTypeaheadItem[];
}) {
  const activeIndex = getDropdownMenuTypeaheadActiveIndex(items);

  if (activeIndex >= 0) {
    return activeIndex;
  }

  const highlightedIndex = items.findIndex((item) =>
    item.element.matches('[data-highlighted]'),
  );

  if (highlightedIndex >= 0) {
    return highlightedIndex;
  }

  const selectedIndex = items.findIndex((item) =>
    item.element.matches('[data-select-list-item][aria-checked="true"]'),
  );

  if (selectedIndex >= 0) {
    return selectedIndex;
  }

  const selectedItem = getSelectedListItemForOpenAlignment(content);
  if (selectedItem) {
    return items.findIndex((item) => item.element === selectedItem);
  }

  return -1;
}

function getDropdownMenuKeyboardNavigationFallbackItem(
  content: HTMLElement,
  key: string,
): HTMLElement | null {
  const items = getDropdownMenuTypeaheadItems(content);

  if (items.length === 0) {
    return null;
  }

  const baseIndex = getDropdownMenuKeyboardNavigationBaseIndex({
    content,
    items,
  });
  const lastIndex = items.length - 1;

  switch (key) {
    case 'ArrowDown':
      return items[baseIndex < 0 ? 0 : clampValue(baseIndex + 1, 0, lastIndex)]
        ?.element;
    case 'ArrowUp':
      return items[
        baseIndex < 0 ? lastIndex : clampValue(baseIndex - 1, 0, lastIndex)
      ]?.element;
    case 'End':
      return items[lastIndex]?.element;
    case 'Home':
      return items[0]?.element;
    case 'PageDown':
      return items[baseIndex < 0 ? 0 : clampValue(baseIndex + 10, 0, lastIndex)]
        ?.element;
    case 'PageUp':
      return items[
        baseIndex < 0 ? lastIndex : clampValue(baseIndex - 10, 0, lastIndex)
      ]?.element;
    default:
      return null;
  }
}

function getOpenTriggerForContent(content: HTMLElement): HTMLElement | null {
  const ownerDocument = content.ownerDocument;
  const ownerCss = ownerDocument.defaultView?.CSS;

  if (content.id && ownerCss?.escape) {
    const escapedContentId = ownerCss.escape(content.id);
    const controlledTrigger = ownerDocument.querySelector<HTMLElement>(
      `[data-slot="dropdown-menu-trigger"][aria-controls="${escapedContentId}"], [data-slot="dropdown-menu-sub-trigger"][aria-controls="${escapedContentId}"]`,
    );
    if (controlledTrigger) {
      return controlledTrigger;
    }
  }

  return ownerDocument.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-trigger"][data-popup-open]',
  );
}

function setSubmenuTriggerChildActive(content: HTMLElement, active: boolean) {
  const trigger = getOpenTriggerForContent(content);
  if (trigger?.dataset.slot !== 'dropdown-menu-sub-trigger') {
    return;
  }

  if (active) {
    trigger.setAttribute(DROPDOWN_MENU_SUBMENU_CHILD_ACTIVE_ATTRIBUTE, 'true');
    trigger.removeAttribute(DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE);
  } else {
    trigger.removeAttribute(DROPDOWN_MENU_SUBMENU_CHILD_ACTIVE_ATTRIBUTE);
  }
}

function clearSubmenuTriggerChildActive(trigger: HTMLElement) {
  trigger.removeAttribute(DROPDOWN_MENU_SUBMENU_CHILD_ACTIVE_ATTRIBUTE);
}

function clearDocumentSubmenuTriggerChildActive(document: Document) {
  document
    .querySelectorAll<HTMLElement>(
      `[${DROPDOWN_MENU_SUBMENU_CHILD_ACTIVE_ATTRIBUTE}]`,
    )
    .forEach(clearSubmenuTriggerChildActive);
}

function getSelectedListItemForOpenAlignment(
  content: HTMLElement,
): HTMLElement | null {
  const list = content.querySelector<HTMLElement>(
    '[data-select-list][data-select-list-open-alignment="selected"]',
  );
  return (
    list?.querySelector<HTMLElement>(
      '[data-select-list-item][aria-checked="true"]',
    ) ?? null
  );
}

function alignSelectedListItemToTrigger(content: HTMLElement): boolean {
  content.style.translate = '';

  const selectedItem = getSelectedListItemForOpenAlignment(content);

  if (!selectedItem) {
    return false;
  }

  const list = selectedItem.closest<HTMLElement>(
    '[data-select-list][data-select-list-open-alignment="selected"]',
  );

  if (!list) {
    return false;
  }

  const selectedItemCenter =
    selectedItem.offsetTop + selectedItem.offsetHeight / 2;
  const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
  const nextScrollTop = clampValue(
    selectedItemCenter - content.clientHeight / 2,
    0,
    maxScrollTop,
  );
  content.scrollTop = nextScrollTop;

  const trigger = getOpenTriggerForContent(content);
  if (!trigger) {
    return true;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const selectedRect = selectedItem.getBoundingClientRect();
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;
  const selectedCenterY = selectedRect.top + selectedRect.height / 2;
  const desiredOffsetY = triggerCenterY - selectedCenterY;
  const collisionPadding = 8;
  const minOffsetY = collisionPadding - contentRect.top;
  const maxOffsetY = window.innerHeight - collisionPadding - contentRect.bottom;
  const offsetY = clampValue(desiredOffsetY, minOffsetY, maxOffsetY);

  content.style.translate = offsetY === 0 ? '' : `0px ${offsetY}px`;
  return true;
}
function getDropdownMenuPanelClass({
  variant,
  panel,
}: {
  variant: DropdownMenuVariant;
  panel: DropdownMenuPanelKind;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return panel === 'subcontent'
    ? dropdownMenuUi3SubContentClass
    : dropdownMenuUi3ContentClass;
}

function getDropdownMenuItemClass({
  variant,
  density,
}: {
  variant: DropdownMenuVariant;
  density: DropdownMenuDensity;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return cn(
    dropdownMenuUi3ItemDensityClass[density],
    dropdownMenuUi3ItemClass,
    dropdownMenuUi3ItemDisabledClass,
  );
}

function DropdownMenu(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

type DropdownMenuTriggerProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
> & {
  asChild?: boolean;
};

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: DropdownMenuTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return (
      <DropdownMenuPrimitive.Trigger
        data-slot="dropdown-menu-trigger"
        {...props}
        render={(renderProps, state) =>
          cloneDropdownMenuRenderElement(children, {
            ...renderProps,
            'data-state': state.open ? 'open' : 'closed',
          })
        }
      />
    );
  }

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
      render={(renderProps, state) => (
        <button {...renderProps} data-state={state.open ? 'open' : 'closed'}>
          {children}
        </button>
      )}
    />
  );
}

function DropdownMenuPortal(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

type DropdownMenuPositionerProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Positioner
>;
type DropdownMenuPopupProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Popup
>;
type DropdownMenuPositioningProps = Pick<
  DropdownMenuPositionerProps,
  | 'align'
  | 'alignOffset'
  | 'anchor'
  | 'collisionAvoidance'
  | 'collisionBoundary'
  | 'collisionPadding'
  | 'positionMethod'
  | 'side'
  | 'sideOffset'
  | 'sticky'
>;
type DropdownMenuAutoFocusEvent = {
  currentTarget: HTMLDivElement;
  preventDefault: () => void;
};
type DropdownMenuContentProps = Omit<
  DropdownMenuPopupProps,
  keyof DropdownMenuPositioningProps
> &
  DropdownMenuPositioningProps & {
    onCloseAutoFocus?: (event: DropdownMenuAutoFocusEvent) => void;
    onOpenAutoFocus?: (event: DropdownMenuAutoFocusEvent) => void;
    variant?: DropdownMenuVariant;
  };

function useDropdownMenuKeyboardController() {
  const keyboardNavigationFrameRef = React.useRef<number | null>(null);
  const lastPointerPositionRef = React.useRef<{
    x: number;
    y: number;
  } | null>(null);
  const typeaheadKeydownCleanupRef = React.useRef<(() => void) | null>(null);
  const typeaheadBufferRef = React.useRef('');
  const typeaheadResetTimerRef = React.useRef<number | null>(null);
  const resetTypeaheadBuffer = React.useCallback(() => {
    typeaheadBufferRef.current = '';
    if (typeaheadResetTimerRef.current !== null) {
      window.clearTimeout(typeaheadResetTimerRef.current);
      typeaheadResetTimerRef.current = null;
    }
  }, []);
  const cancelKeyboardNavigationFrame = React.useCallback(() => {
    if (keyboardNavigationFrameRef.current !== null) {
      cancelAnimationFrame(keyboardNavigationFrameRef.current);
      keyboardNavigationFrameRef.current = null;
    }
  }, []);
  const scheduleKeyboardNavigationActiveSync = React.useCallback(
    (node: HTMLElement, fallbackItem: HTMLElement | null) => {
      cancelKeyboardNavigationFrame();

      keyboardNavigationFrameRef.current = requestAnimationFrame(() => {
        keyboardNavigationFrameRef.current = requestAnimationFrame(() => {
          keyboardNavigationFrameRef.current = null;
          if (!node.isConnected) {
            return;
          }

          const activeItem =
            getDropdownMenuKeyboardNavigationActiveItem(node) ?? fallbackItem;
          if (!activeItem) {
            return;
          }

          setDropdownMenuTypeaheadActiveItem(node, activeItem, {
            focus: activeItem === fallbackItem,
            scroll: activeItem === fallbackItem,
          });
        });
      });
    },
    [cancelKeyboardNavigationFrame],
  );
  const handleKeyboardNavigationKeyDown = React.useCallback(
    (
      content: HTMLElement,
      event: DropdownMenuTypeaheadKeyboardEvent,
    ): boolean => {
      if (
        event.defaultPrevented ||
        !shouldRouteDropdownMenuTypeaheadToContent(content, event.target) ||
        !shouldHandleDropdownMenuKeyboardNavigation(event)
      ) {
        return false;
      }

      resetTypeaheadBuffer();
      clearDropdownMenuTypeaheadActiveItems(content);
      suppressDropdownMenuPointerHover(content);
      const fallbackItem = getDropdownMenuKeyboardNavigationFallbackItem(
        content,
        event.key,
      );
      if (fallbackItem) {
        setDropdownMenuTypeaheadActiveItem(content, fallbackItem, {
          focus: false,
          scroll: false,
        });
      }
      scheduleKeyboardNavigationActiveSync(content, fallbackItem);
      return true;
    },
    [resetTypeaheadBuffer, scheduleKeyboardNavigationActiveSync],
  );
  const handleTypeaheadKeyDown = React.useCallback(
    (
      content: HTMLElement,
      event: DropdownMenuTypeaheadKeyboardEvent,
    ): boolean => {
      if (
        event.defaultPrevented ||
        !shouldRouteDropdownMenuTypeaheadToContent(content, event.target) ||
        !shouldHandleDropdownMenuTypeahead(event)
      ) {
        return false;
      }

      const items = getDropdownMenuTypeaheadItems(content);
      const nextBuffer = normalizeTypeaheadLabel(
        `${typeaheadBufferRef.current}${event.key}`,
      );
      const matchIndex = getDropdownMenuTypeaheadMatchIndex({
        buffer: nextBuffer,
        items,
      });

      if (matchIndex < 0) {
        resetTypeaheadBuffer();
        return false;
      }

      typeaheadBufferRef.current = nextBuffer;
      if (typeaheadResetTimerRef.current !== null) {
        window.clearTimeout(typeaheadResetTimerRef.current);
      }
      typeaheadResetTimerRef.current = window.setTimeout(
        resetTypeaheadBuffer,
        DROPDOWN_MENU_TYPEAHEAD_RESET_MS,
      );

      const item = items[matchIndex];
      if (item) {
        cancelKeyboardNavigationFrame();
        setDropdownMenuTypeaheadActiveItem(content, item.element);
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [cancelKeyboardNavigationFrame, resetTypeaheadBuffer],
  );
  const handleKeyDown = React.useCallback(
    (content: HTMLElement, event: DropdownMenuTypeaheadKeyboardEvent) => {
      handleKeyboardNavigationKeyDown(content, event);
      handleTypeaheadKeyDown(content, event);
    },
    [handleKeyboardNavigationKeyDown, handleTypeaheadKeyDown],
  );
  const handlePointerMove = React.useCallback(
    (
      content: HTMLElement,
      event: {
        clientX: number;
        clientY: number;
        movementX: number;
        movementY: number;
      },
    ) => {
      const previousPointerPosition = lastPointerPositionRef.current;
      const nextPointerPosition = {
        x: event.clientX,
        y: event.clientY,
      };
      lastPointerPositionRef.current = nextPointerPosition;

      const pointerActuallyMoved = previousPointerPosition
        ? previousPointerPosition.x !== nextPointerPosition.x ||
          previousPointerPosition.y !== nextPointerPosition.y
        : event.movementX !== 0 || event.movementY !== 0;

      if (!pointerActuallyMoved) {
        content
          .querySelector<HTMLElement>(
            `[${DROPDOWN_MENU_TYPEAHEAD_ACTIVE_ATTRIBUTE}]`,
          )
          ?.focus({ preventScroll: true });
        return;
      }

      cancelKeyboardNavigationFrame();
      clearDocumentSubmenuTriggerChildActive(content.ownerDocument);
      clearDocumentDropdownMenuKeyboardActiveItems(content.ownerDocument);
    },
    [cancelKeyboardNavigationFrame],
  );
  const handleFocusCapture = React.useCallback(
    (content: HTMLElement, target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const focusedItem = target.closest<HTMLElement>(
        '[data-dropdown-menu-typeahead-item]',
      );
      if (
        !focusedItem ||
        !content.contains(focusedItem) ||
        !focusedItem.hasAttribute(
          DROPDOWN_MENU_SUPPRESS_POINTER_HOVER_ATTRIBUTE,
        )
      ) {
        return;
      }

      setDropdownMenuTypeaheadActiveItem(content, focusedItem, {
        focus: false,
        scroll: false,
      });
    },
    [],
  );
  const clearKeyboardState = React.useCallback(
    (content: HTMLElement) => {
      cancelKeyboardNavigationFrame();
      resetTypeaheadBuffer();
      lastPointerPositionRef.current = null;
      setSubmenuTriggerChildActive(content, false);
      clearDropdownMenuTypeaheadActiveItems(content);
      clearDropdownMenuPointerHoverSuppression(content);
    },
    [cancelKeyboardNavigationFrame, resetTypeaheadBuffer],
  );
  const registerKeyboardScope = React.useCallback(
    (node: HTMLElement | null) => {
      typeaheadKeydownCleanupRef.current?.();
      typeaheadKeydownCleanupRef.current = null;
      cancelKeyboardNavigationFrame();

      if (!node) {
        return;
      }

      const handleDocumentKeyDown = (event: KeyboardEvent) => {
        handleKeyDown(node, event);
      };
      node.ownerDocument.addEventListener('keydown', handleDocumentKeyDown, {
        capture: true,
      });
      typeaheadKeydownCleanupRef.current = () => {
        node.ownerDocument.removeEventListener(
          'keydown',
          handleDocumentKeyDown,
          {
            capture: true,
          },
        );
      };
    },
    [cancelKeyboardNavigationFrame, handleKeyDown],
  );

  return React.useMemo(
    () => ({
      cancelKeyboardNavigationFrame,
      clearKeyboardState,
      handleFocusCapture,
      handleKeyDown,
      handlePointerMove,
      registerKeyboardScope,
      resetTypeaheadBuffer,
    }),
    [
      cancelKeyboardNavigationFrame,
      clearKeyboardState,
      handleFocusCapture,
      handleKeyDown,
      handlePointerMove,
      registerKeyboardScope,
      resetTypeaheadBuffer,
    ],
  );
}

function createDropdownMenuAutoFocusEvent(
  currentTarget: HTMLDivElement,
): DropdownMenuAutoFocusEvent {
  return {
    currentTarget,
    preventDefault: () => {},
  };
}

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Popup>,
  DropdownMenuContentProps
>(function DropdownMenuContent(
  {
    align,
    alignOffset,
    anchor,
    className,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    onCloseAutoFocus,
    onKeyDown,
    onOpenAutoFocus,
    onPointerMove,
    positionMethod,
    side,
    sideOffset = 4,
    sticky,
    variant = 'default',
    ...props
  },
  ref,
) {
  const contentRef = React.useRef<React.ElementRef<
    typeof DropdownMenuPrimitive.Popup
  > | null>(null);
  const hasAlignedOpenRef = React.useRef(false);
  const alignFrameRef = React.useRef<number | null>(null);
  const keyboardController = useDropdownMenuKeyboardController();
  const cancelAlignFrame = React.useCallback(() => {
    if (alignFrameRef.current !== null) {
      cancelAnimationFrame(alignFrameRef.current);
      alignFrameRef.current = null;
    }
  }, []);
  const scheduleSelectedAlignment = React.useCallback(
    (node: HTMLElement) => {
      cancelAlignFrame();

      if (hasAlignedOpenRef.current) {
        return;
      }

      const shouldAlignSelected =
        getSelectedListItemForOpenAlignment(node) !== null;
      if (!shouldAlignSelected) {
        node.style.visibility = '';
        return;
      }

      // Hide the first paint so selected-item alignment does not visibly jump
      // from the default anchored position into its final translated position.
      node.style.visibility = 'hidden';

      alignFrameRef.current = requestAnimationFrame(() => {
        alignFrameRef.current = null;
        if (!node.isConnected) {
          return;
        }

        if (hasAlignedOpenRef.current) {
          node.style.visibility = '';
          return;
        }

        hasAlignedOpenRef.current = alignSelectedListItemToTrigger(node);
        node.style.visibility = '';
      });
    },
    [cancelAlignFrame],
  );
  const setContentRef = React.useCallback(
    (node: React.ElementRef<typeof DropdownMenuPrimitive.Popup> | null) => {
      if (!node && contentRef.current) {
        cancelAlignFrame();
        hasAlignedOpenRef.current = false;
        keyboardController.clearKeyboardState(contentRef.current);
        contentRef.current.style.translate = '';
        contentRef.current.style.visibility = '';
        onCloseAutoFocus?.(
          createDropdownMenuAutoFocusEvent(contentRef.current),
        );
      }

      contentRef.current = node;
      keyboardController.registerKeyboardScope(node);

      if (node && !hasAlignedOpenRef.current) {
        onOpenAutoFocus?.(createDropdownMenuAutoFocusEvent(node));
        scheduleSelectedAlignment(node);
      }

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [
      cancelAlignFrame,
      keyboardController,
      onCloseAutoFocus,
      onOpenAutoFocus,
      ref,
      scheduleSelectedAlignment,
    ],
  );

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
      >
        <DropdownMenuPrimitive.Popup
          ref={setContentRef}
          data-slot="dropdown-menu-content"
          onKeyDown={(event) => {
            onKeyDown?.(event);
            keyboardController.handleKeyDown(event.currentTarget, event);
          }}
          onFocusCapture={(event) => {
            keyboardController.handleFocusCapture(
              event.currentTarget,
              event.target,
            );
          }}
          onPointerMove={(event) => {
            keyboardController.handlePointerMove(event.currentTarget, event);
            onPointerMove?.(event);
          }}
          className={cn(
            variant === 'ui3'
              ? [
                  'z-50',
                  getDropdownMenuPanelClass({
                    variant,
                    panel: 'content',
                  }),
                ]
              : 'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
            className,
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  );
});

type DropdownMenuItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
  'label' | 'onSelect'
> & {
  inset?: boolean;
  onSelect?: React.MouseEventHandler<HTMLElement>;
  textValue?: string;
  typeaheadLabel?: string;
  variant?: DropdownMenuVariant;
  density?: DropdownMenuDensity;
};

function DropdownMenuItem({
  className,
  inset,
  label,
  onClick,
  onSelect,
  textValue,
  typeaheadLabel,
  variant = 'default',
  density = 'compact',
  ...props
}: DropdownMenuItemProps & { label?: string }) {
  const resolvedLabel = typeaheadLabel ?? textValue ?? label;

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-dropdown-menu-typeahead-item=""
      data-dropdown-menu-typeahead-label={resolvedLabel}
      label={resolvedLabel}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(event);
      }}
      className={cn(
        variant === 'ui3'
          ? getDropdownMenuItemClass({ variant, density })
          : 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        variant === 'default' && inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  closeOnClick = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      checked={checked}
      closeOnClick={closeOnClick}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <Check className="size-4" />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>,
) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  closeOnClick = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      closeOnClick={closeOnClick}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.RadioItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.GroupLabel> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & {
  variant?: DropdownMenuVariant;
}) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        variant === 'ui3'
          ? dropdownMenuUi3SeparatorClass
          : '-mx-1 my-1 h-px bg-border',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  );
}

function DropdownMenuGroup(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>,
) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuSub(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuRoot>,
) {
  return (
    <DropdownMenuPrimitive.SubmenuRoot
      data-slot="dropdown-menu-sub"
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  onFocusCapture,
  onPointerMove,
  textValue,
  typeaheadLabel,
  variant = 'default',
  density = 'compact',
  showDefaultChevron,
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuTrigger>,
  'label'
> & {
  inset?: boolean;
  typeaheadLabel?: string;
  textValue?: string;
  variant?: DropdownMenuVariant;
  density?: DropdownMenuDensity;
  showDefaultChevron?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-dropdown-menu-typeahead-item=""
      data-dropdown-menu-typeahead-label={typeaheadLabel ?? textValue}
      label={typeaheadLabel ?? textValue}
      onFocusCapture={(event) => {
        clearSubmenuTriggerChildActive(event.currentTarget);
        onFocusCapture?.(event);
      }}
      onPointerMove={(event) => {
        clearSubmenuTriggerChildActive(event.currentTarget);
        onPointerMove?.(event);
      }}
      className={cn(
        variant === 'ui3'
          ? getDropdownMenuItemClass({ variant, density })
          : 'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[popup-open]:bg-accent',
        variant === 'default' && inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      {(showDefaultChevron ?? variant === 'default') ? (
        <ChevronRight className="ml-auto size-4" />
      ) : null}
    </DropdownMenuPrimitive.SubmenuTrigger>
  );
}

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Popup>,
  DropdownMenuContentProps
>(function DropdownMenuSubContent(
  {
    align,
    alignOffset,
    anchor,
    className,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    onKeyDown,
    onPointerMove,
    positionMethod,
    side,
    sideOffset,
    sticky,
    variant = 'default',
    ...props
  },
  ref,
) {
  const subContentRef = React.useRef<React.ElementRef<
    typeof DropdownMenuPrimitive.Popup
  > | null>(null);
  const keyboardController = useDropdownMenuKeyboardController();
  const setSubContentRef = React.useCallback(
    (node: React.ElementRef<typeof DropdownMenuPrimitive.Popup> | null) => {
      if (!node && subContentRef.current) {
        setSubmenuTriggerChildActive(subContentRef.current, false);
      }

      subContentRef.current = node;
      keyboardController.registerKeyboardScope(node);

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [keyboardController, ref],
  );

  return (
    <DropdownMenuPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      anchor={anchor}
      className="z-50"
      collisionAvoidance={collisionAvoidance}
      collisionBoundary={collisionBoundary}
      collisionPadding={collisionPadding}
      positionMethod={positionMethod}
      side={side}
      sideOffset={sideOffset}
      sticky={sticky}
    >
      <DropdownMenuPrimitive.Popup
        ref={setSubContentRef}
        data-slot="dropdown-menu-sub-content"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          keyboardController.handleKeyDown(event.currentTarget, event);
        }}
        onFocusCapture={(event) => {
          setSubmenuTriggerChildActive(event.currentTarget, true);
          keyboardController.handleFocusCapture(
            event.currentTarget,
            event.target,
          );
        }}
        onPointerMove={(event) => {
          keyboardController.handlePointerMove(event.currentTarget, event);
          setSubmenuTriggerChildActive(event.currentTarget, true);
          onPointerMove?.(event);
        }}
        className={cn(
          variant === 'ui3'
            ? [
                'z-50',
                getDropdownMenuPanelClass({
                  variant,
                  panel: 'subcontent',
                }),
              ]
            : 'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Positioner>
  );
});

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
