import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type FocusEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

type Modality = 'keyboard' | 'pointer' | null;

let currentModality: Modality = null;
let listenersInstalled = false;

function setModality(modality: Modality): void {
  currentModality = modality;
}

function getModality(): Modality {
  return currentModality;
}

function isModifierOnlyKey(event: KeyboardEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.key === 'Meta' ||
    event.key === 'Control' ||
    event.key === 'Alt' ||
    event.key === 'Shift'
  );
}

function installModalityListeners(): void {
  if (listenersInstalled || typeof document === 'undefined') {
    return;
  }
  listenersInstalled = true;

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isModifierOnlyKey(event)) {
      setModality('keyboard');
    }
  };
  const onPointer = () => {
    setModality('pointer');
  };

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('mousedown', onPointer, true);
}

export interface FocusVisibleHandlers<T extends Element> {
  /** True while focused via keyboard (or keyboard used after focusing). */
  focusVisible: boolean;
  onFocus: FocusEventHandler<T>;
  onBlur: FocusEventHandler<T>;
  /** Call from the element's keydown handler. */
  markKeyboardInteraction: (event: ReactKeyboardEvent<T>) => void;
}

/**
 * Tracks keyboard-driven focus for `data-focus-visible`, mirroring
 * `:focus-visible` heuristics: focus following pointer input is not visible,
 * focus following keyboard input (or with no prior input) is, and pressing a
 * key while focused upgrades pointer focus to visible.
 */
export function useFocusVisible<T extends Element>(
  onFocusProp?: FocusEventHandler<T>,
  onBlurProp?: FocusEventHandler<T>,
): FocusVisibleHandlers<T> {
  const [focusVisible, setFocusVisible] = useState(false);

  useEffect(() => {
    installModalityListeners();
  }, []);

  const onFocus = useCallback(
    (event: ReactFocusEvent<T>) => {
      onFocusProp?.(event);
      setFocusVisible(getModality() !== 'pointer');
    },
    [onFocusProp],
  );

  const onBlur = useCallback(
    (event: ReactFocusEvent<T>) => {
      onBlurProp?.(event);
      setFocusVisible(false);
    },
    [onBlurProp],
  );

  const markKeyboardInteraction = useCallback(
    (event: ReactKeyboardEvent<T>) => {
      if (!isModifierOnlyKey(event.nativeEvent)) {
        setModality('keyboard');
        setFocusVisible(true);
      }
    },
    [],
  );

  return { focusVisible, onFocus, onBlur, markKeyboardInteraction };
}
