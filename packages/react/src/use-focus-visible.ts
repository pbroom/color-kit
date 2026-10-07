import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type FocusEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

type Modality = 'keyboard' | 'pointer' | null;

interface DocumentModality {
  modality: Modality;
  /** Mounted controls in this document; listeners detach at zero. */
  users: number;
  detach: () => void;
}

/**
 * Input modality per document, so a control rendered into another document
 * (for example an iframe) tracks that document's input.
 */
const modalityByDocument = new WeakMap<Document, DocumentModality>();

function setModality(doc: Document, modality: Modality): void {
  const entry = modalityByDocument.get(doc);
  if (entry) {
    entry.modality = modality;
  }
}

function getModality(doc: Document): Modality {
  return modalityByDocument.get(doc)?.modality ?? null;
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

/**
 * Adds a user of `doc`'s modality listeners, attaching them for the first
 * user. The returned release detaches them when the last user unmounts.
 */
function retainModalityListeners(doc: Document): () => void {
  let entry = modalityByDocument.get(doc);
  if (!entry) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModifierOnlyKey(event)) {
        setModality(doc, 'keyboard');
      }
    };
    const onPointer = () => {
      setModality(doc, 'pointer');
    };

    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('pointerdown', onPointer, true);
    doc.addEventListener('mousedown', onPointer, true);
    entry = {
      modality: null,
      users: 0,
      detach: () => {
        doc.removeEventListener('keydown', onKeyDown, true);
        doc.removeEventListener('pointerdown', onPointer, true);
        doc.removeEventListener('mousedown', onPointer, true);
      },
    };
    modalityByDocument.set(doc, entry);
  }

  const retained = entry;
  retained.users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    retained.users -= 1;
    if (retained.users === 0) {
      retained.detach();
      modalityByDocument.delete(doc);
    }
  };
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
 *
 * `node` is the focusable element: input modality is tracked in its owner
 * document while it is mounted, and the listeners are removed once no
 * mounted control uses that document.
 */
export function useFocusVisible<T extends Element>(
  node: T | null,
  onFocusProp?: FocusEventHandler<T>,
  onBlurProp?: FocusEventHandler<T>,
): FocusVisibleHandlers<T> {
  const [focusVisible, setFocusVisible] = useState(false);
  const ownerDocument = node?.ownerDocument ?? null;

  useEffect(() => {
    if (!ownerDocument) return;
    return retainModalityListeners(ownerDocument);
  }, [ownerDocument]);

  const onFocus = useCallback(
    (event: ReactFocusEvent<T>) => {
      onFocusProp?.(event);
      setFocusVisible(
        getModality(event.currentTarget.ownerDocument) !== 'pointer',
      );
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
        setModality(event.currentTarget.ownerDocument, 'keyboard');
        setFocusVisible(true);
      }
    },
    [],
  );

  return { focusVisible, onFocus, onBlur, markKeyboardInteraction };
}
