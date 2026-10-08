import { useCallback, useMemo, useState } from 'react';
import type { Color } from '@color-kit/core';
import {
  addMultiColorEntry,
  createMultiColorModel,
  materializeMultiColorState,
  multiColorModelFromState,
  removeMultiColorEntry,
  renameMultiColorEntry,
  resolveColorSource,
  selectMultiColorEntry,
  setMultiColorActiveGamut,
  setMultiColorActiveView,
  setMultiColorChannel,
  setMultiColorRequested,
  type ColorChannel,
  type ColorInteraction,
  type ColorSource,
  type ColorState,
  type GamutTarget,
  type MultiColorInput,
  type MultiColorModel,
  type MultiColorState,
  type MultiColorUpdateEvent,
  type ViewModel,
} from '@color-kit/driver';
import { useLatestSnapshot } from './color-store.js';
import type { SetRequestedOptions } from './use-color.js';

export type {
  MultiColorEntryInput,
  MultiColorInput,
  MultiColorState,
  MultiColorUpdateEvent,
} from '@color-kit/driver';

/** Options for {@link useMultiColor}. */
export interface UseMultiColorOptions {
  /**
   * Initial entries in uncontrolled mode, as an `{ id: color }` record or an
   * `[{ id, color }]` array (colors as CSS strings or OKLCH objects).
   * Duplicate ids keep the first entry.
   * @defaultValue one entry, `color-1`, set to `{ l: 0.6, c: 0.2, h: 250, alpha: 1 }`
   */
  defaultColors?: MultiColorInput;
  /**
   * Initially selected entry id; falls back to the first entry when missing
   * or unknown.
   */
  defaultSelectedId?: string;
  /**
   * Initial active display gamut shared by all entries.
   * @defaultValue 'display-p3'
   */
  defaultGamut?: GamutTarget;
  /**
   * Initial active view model shared by all entries.
   * @defaultValue 'oklch'
   */
  defaultView?: ViewModel;
  /** Controlled collection state. */
  state?: MultiColorState;
  /**
   * Called when an operation produces a new collection state. Fires
   * synchronously inside the operation call (i.e. in your event handler,
   * before React re-renders) in both controlled and uncontrolled modes,
   * exactly once per effective update and never for no-op updates. Several
   * calls in one tick compose: each `event.next` builds on the previous one,
   * even in controlled mode before the new `state` prop arrives. Once React
   * re-renders, later calls start from the `state` you committed, so an
   * update you ignore is not carried into the next one.
   */
  onChange?: (event: MultiColorUpdateEvent) => void;
}

/** Collection state and operations returned by {@link useMultiColor}. */
export interface UseMultiColorReturn {
  /** The full collection state. */
  state: MultiColorState;
  /** Entry ids in collection order. */
  ids: string[];
  /** Id of the selected entry, or `null` when the collection is empty. */
  selectedId: string | null;
  /** State of the selected entry, or `null` when nothing is selected. */
  selected: ColorState | null;
  /** Sets the requested OKLCH color of entry `id`. */
  setRequested: (
    id: string,
    requested: Color,
    options?: SetRequestedOptions,
  ) => void;
  /** Sets one OKLCH channel of entry `id`. */
  setChannel: (
    id: string,
    channel: ColorChannel,
    value: number,
    options?: Omit<SetRequestedOptions, 'changedChannel'>,
  ) => void;
  /** Sets the display gamut shared by all entries; `source` defaults to `'user'`. */
  setActiveGamut: (gamut: GamutTarget, source?: ColorSource) => void;
  /** Sets the view model shared by all entries; `source` defaults to `'user'`. */
  setActiveView: (view: ViewModel, source?: ColorSource) => void;
  /** Selects entry `id`; a no-op for unknown or already selected ids. */
  select: (id: string, interaction?: ColorInteraction) => void;
  /**
   * Appends an entry (a no-op when `id` exists). Selects it when nothing is
   * selected.
   */
  addColor: (id: string, color: Color | string, source?: ColorSource) => void;
  /** Removes entry `id`; removing the selected entry selects the first remaining one. */
  removeColor: (id: string) => void;
  /**
   * Renames entry `id` to `nextId`, keeping its position and selection; a
   * no-op when `id` is unknown or `nextId` is taken.
   */
  renameColor: (id: string, nextId: string, source?: ColorSource) => void;
}

function createUpdateEvent(
  nextModel: MultiColorModel,
  interaction: ColorInteraction,
  id?: string,
  changedChannel?: ColorChannel,
): MultiColorUpdateEvent {
  const event: MultiColorUpdateEvent = {
    next: materializeMultiColorState(nextModel),
    interaction,
  };

  if (id !== undefined) event.id = id;
  if (changedChannel !== undefined) event.changedChannel = changedChannel;

  return event;
}

/**
 * Manages a named collection of colors that share one display gamut and view
 * model, plus a selected entry.
 *
 * Each entry is a full requested/displayed `ColorState`, as in
 * {@link useColor}. Works uncontrolled (`defaultColors`) or controlled
 * (`state` + `onChange`); operations always build on the latest state, so
 * several calls in one event handler compose.
 *
 * @param options - Initial or controlled collection and the change callback.
 * @returns The collection state and operations.
 *
 * @example
 * ```tsx
 * import { useMultiColor } from 'color-kit/react';
 *
 * function Palette() {
 *   const palette = useMultiColor({
 *     defaultColors: { background: '#ffffff', text: '#1f2937' },
 *   });
 *   palette.ids; // → ['background', 'text']
 *   palette.selectedId; // → 'background'
 *
 *   return (
 *     <button onClick={() => palette.addColor('accent', '#3b82f6')}>
 *       Add accent
 *     </button>
 *   );
 * }
 * ```
 */
export function useMultiColor(
  options: UseMultiColorOptions = {},
): UseMultiColorReturn {
  const {
    defaultColors,
    defaultSelectedId,
    defaultGamut = 'display-p3',
    defaultView = 'oklch',
    state: controlledState,
    onChange,
  } = options;

  const [internalModel, setInternalModel] = useState<MultiColorModel>(() =>
    createMultiColorModel({
      colors: defaultColors,
      selectedId: defaultSelectedId,
      activeGamut: defaultGamut,
      activeView: defaultView,
    }),
  );

  const isControlled = controlledState !== undefined;
  // Normalized model of whatever React last committed: the controlled prop
  // or the internal state. Updates in one tick compose on the latest pending
  // snapshot of this model until the next commit.
  const committedModel = useMemo<MultiColorModel>(
    () =>
      controlledState
        ? multiColorModelFromState(controlledState)
        : internalModel,
    [controlledState, internalModel],
  );
  const snapshot = useLatestSnapshot(committedModel);
  const state = useMemo<MultiColorState>(
    () => controlledState ?? materializeMultiColorState(internalModel),
    [controlledState, internalModel],
  );

  /**
   * Applies a driver reducer to the latest snapshot and notifies `onChange`
   * synchronously. Uncontrolled commits still go through
   * `setInternalModel(prev => ...)`; `prev` equals the snapshot the update
   * was computed from unless something bypassed this hook, in which case the
   * reducer is re-applied to `prev`.
   */
  const applyUpdate = useCallback(
    (
      updater: (current: MultiColorModel) => MultiColorModel,
      interaction: ColorInteraction,
      id?: string,
      changedChannel?: ColorChannel,
    ) => {
      const current = snapshot.read();
      const nextModel = updater(current);
      if (nextModel === current) return;

      snapshot.write(nextModel);
      if (!isControlled) {
        setInternalModel((prev) =>
          prev === current ? nextModel : updater(prev),
        );
      }
      onChange?.(createUpdateEvent(nextModel, interaction, id, changedChannel));
    },
    [isControlled, onChange, snapshot],
  );

  const setRequested = useCallback(
    (id: string, requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveColorSource(interaction, options.source);

      applyUpdate(
        (current) =>
          setMultiColorRequested(current, id, requested, source, {
            explicitHue: options.explicitHue,
          }),
        interaction,
        id,
        options.changedChannel,
      );
    },
    [applyUpdate],
  );

  const setChannel = useCallback(
    (
      id: string,
      channel: ColorChannel,
      value: number,
      options: Omit<SetRequestedOptions, 'changedChannel'> = {},
    ) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveColorSource(interaction, options.source);

      applyUpdate(
        (current) => setMultiColorChannel(current, id, channel, value, source),
        interaction,
        id,
        channel,
      );
    },
    [applyUpdate],
  );

  const setActiveGamut = useCallback(
    (gamut: GamutTarget, source: ColorSource = 'user') => {
      applyUpdate(
        (current) => setMultiColorActiveGamut(current, gamut, source),
        'programmatic',
      );
    },
    [applyUpdate],
  );

  const setActiveView = useCallback(
    (view: ViewModel, source: ColorSource = 'user') => {
      applyUpdate(
        (current) => setMultiColorActiveView(current, view, source),
        'programmatic',
      );
    },
    [applyUpdate],
  );

  const select = useCallback(
    (id: string, interaction: ColorInteraction = 'programmatic') => {
      applyUpdate(
        (current) => selectMultiColorEntry(current, id),
        interaction,
        id,
      );
    },
    [applyUpdate],
  );

  const addColor = useCallback(
    (
      id: string,
      color: Color | string,
      source: ColorSource = 'programmatic',
    ) => {
      applyUpdate(
        (current) => addMultiColorEntry(current, id, color, source),
        'programmatic',
        id,
      );
    },
    [applyUpdate],
  );

  const removeColor = useCallback(
    (id: string) => {
      applyUpdate(
        (current) => removeMultiColorEntry(current, id),
        'programmatic',
        id,
      );
    },
    [applyUpdate],
  );

  const renameColor = useCallback(
    (id: string, nextId: string, source: ColorSource = 'programmatic') => {
      applyUpdate(
        (current) => renameMultiColorEntry(current, id, nextId, source),
        'programmatic',
        nextId,
      );
    },
    [applyUpdate],
  );

  const ids = state.order;
  const selected = useMemo(
    () => (state.selectedId ? (state.colors[state.selectedId] ?? null) : null),
    [state.selectedId, state.colors],
  );

  return {
    state,
    ids,
    selectedId: state.selectedId,
    selected,
    setRequested,
    setChannel,
    setActiveGamut,
    setActiveView,
    select,
    addColor,
    removeColor,
    renameColor,
  };
}
