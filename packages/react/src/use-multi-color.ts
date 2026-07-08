import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color } from '@color-kit/core';
import { parse } from '@color-kit/core';
import {
  createColorState,
  type ColorChannel,
  type ColorInteraction,
  type ColorSource,
  type ColorState,
  type GamutTarget,
  type ViewModel,
} from '@color-kit/driver';
import type { SetRequestedOptions } from './use-color.js';

export interface MultiColorEntryInput {
  id: string;
  color: Color | string;
}

export type MultiColorInput =
  | Record<string, Color | string>
  | MultiColorEntryInput[];

export interface MultiColorState {
  colors: Record<string, ColorState>;
  order: string[];
  selectedId: string | null;
  activeGamut: GamutTarget;
  activeView: ViewModel;
}

export interface MultiColorUpdateEvent {
  next: MultiColorState;
  interaction: ColorInteraction;
  id?: string;
  changedChannel?: ColorChannel;
}

export interface UseMultiColorOptions {
  defaultColors?: MultiColorInput;
  defaultSelectedId?: string;
  defaultGamut?: GamutTarget;
  defaultView?: ViewModel;
  state?: MultiColorState;
  onChange?: (event: MultiColorUpdateEvent) => void;
}

export interface UseMultiColorReturn {
  state: MultiColorState;
  ids: string[];
  selectedId: string | null;
  selected: ColorState | null;
  setRequested: (
    id: string,
    requested: Color,
    options?: SetRequestedOptions,
  ) => void;
  setChannel: (
    id: string,
    channel: ColorChannel,
    value: number,
    options?: Omit<SetRequestedOptions, 'changedChannel'>,
  ) => void;
  setActiveGamut: (gamut: GamutTarget, source?: ColorSource) => void;
  setActiveView: (view: ViewModel, source?: ColorSource) => void;
  select: (id: string, interaction?: ColorInteraction) => void;
  addColor: (id: string, color: Color | string, source?: ColorSource) => void;
  removeColor: (id: string, source?: ColorSource) => void;
  renameColor: (id: string, nextId: string, source?: ColorSource) => void;
}

interface MultiColorEntryState {
  requested: Color;
  source: ColorSource;
}

interface MultiColorInternalState {
  entries: Record<string, MultiColorEntryState>;
  order: string[];
  selectedId: string | null;
  activeGamut: GamutTarget;
  activeView: ViewModel;
}

interface PendingMultiColorUpdate {
  sequence: number;
  nextInternal: MultiColorInternalState;
  interaction: ColorInteraction;
  id?: string;
  changedChannel?: ColorChannel;
}

function resolveColor(input: Color | string): Color {
  return typeof input === 'string' ? parse(input) : input;
}

function cloneColor(color: Color): Color {
  return { ...color };
}

function createEntry(
  input: Color | string,
  source: ColorSource = 'programmatic',
): MultiColorEntryState {
  return {
    requested: cloneColor(resolveColor(input)),
    source,
  };
}

function normalizeInputColors(
  input: MultiColorInput | undefined,
): MultiColorEntryInput[] {
  if (!input) {
    return [{ id: 'color-1', color: { l: 0.6, c: 0.2, h: 250, alpha: 1 } }];
  }
  if (Array.isArray(input)) {
    return input.length > 0
      ? input
      : [{ id: 'color-1', color: { l: 0.6, c: 0.2, h: 250, alpha: 1 } }];
  }
  const entries = Object.entries(input).map(([id, color]) => ({ id, color }));
  return entries.length > 0
    ? entries
    : [{ id: 'color-1', color: { l: 0.6, c: 0.2, h: 250, alpha: 1 } }];
}

function buildInternalState(
  colorsInput: MultiColorInput | undefined,
  selectedIdInput: string | undefined,
  activeGamut: GamutTarget,
  activeView: ViewModel,
): MultiColorInternalState {
  const entries = normalizeInputColors(colorsInput);
  const order: string[] = [];
  const entryState: Record<string, MultiColorEntryState> = {};

  for (const entry of entries) {
    if (entryState[entry.id]) continue;
    order.push(entry.id);
    entryState[entry.id] = createEntry(entry.color);
  }

  const selectedId =
    selectedIdInput && entryState[selectedIdInput]
      ? selectedIdInput
      : (order[0] ?? null);

  return {
    entries: entryState,
    order,
    selectedId,
    activeGamut,
    activeView,
  };
}

function materializeState(
  internalState: MultiColorInternalState,
): MultiColorState {
  const colors: Record<string, ColorState> = {};

  for (const id of internalState.order) {
    const entry = internalState.entries[id];
    if (!entry) continue;
    colors[id] = createColorState(entry.requested, {
      activeGamut: internalState.activeGamut,
      activeView: internalState.activeView,
      source: entry.source,
    });
  }

  return {
    colors,
    order: [...internalState.order],
    selectedId: internalState.selectedId,
    activeGamut: internalState.activeGamut,
    activeView: internalState.activeView,
  };
}

function internalFromState(state: MultiColorState): MultiColorInternalState {
  const entries: Record<string, MultiColorEntryState> = {};
  const order: string[] = [];

  for (const id of state.order) {
    const colorState = state.colors[id];
    if (!colorState) continue;
    order.push(id);
    entries[id] = {
      requested: cloneColor(colorState.requested),
      source: colorState.meta.source,
    };
  }

  const selectedId =
    state.selectedId && entries[state.selectedId]
      ? state.selectedId
      : (order[0] ?? null);

  return {
    entries,
    order,
    selectedId,
    activeGamut: state.activeGamut,
    activeView: state.activeView,
  };
}

function updateEntrySources(
  entries: Record<string, MultiColorEntryState>,
  order: string[],
  source: ColorSource,
): Record<string, MultiColorEntryState> {
  let nextEntries: Record<string, MultiColorEntryState> | null = null;

  for (const id of order) {
    const entry = entries[id];
    if (!entry || entry.source === source) continue;
    nextEntries ??= { ...entries };
    nextEntries[id] = { ...entry, source };
  }

  return nextEntries ?? entries;
}

function resolveSource(
  interaction: ColorInteraction,
  source?: ColorSource,
): ColorSource {
  if (source) return source;
  return interaction === 'programmatic' ? 'programmatic' : 'user';
}

function createPendingUpdate(
  sequence: number,
  nextInternal: MultiColorInternalState,
  interaction: ColorInteraction,
  id?: string,
  changedChannel?: ColorChannel,
): PendingMultiColorUpdate {
  const update: PendingMultiColorUpdate = {
    sequence,
    nextInternal,
    interaction,
  };

  if (id !== undefined) update.id = id;
  if (changedChannel !== undefined) update.changedChannel = changedChannel;

  return update;
}

function materializeUpdateEvent(
  update: PendingMultiColorUpdate,
): MultiColorUpdateEvent {
  const event: MultiColorUpdateEvent = {
    next: materializeState(update.nextInternal),
    interaction: update.interaction,
  };

  if (update.id !== undefined) event.id = update.id;
  if (update.changedChannel !== undefined) {
    event.changedChannel = update.changedChannel;
  }

  return event;
}

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

  const [internalState, setInternalState] = useState<MultiColorInternalState>(
    () =>
      buildInternalState(
        defaultColors,
        defaultSelectedId,
        defaultGamut,
        defaultView,
      ),
  );
  const pendingUpdateSequence = useRef(0);
  const pendingUpdates = useRef<PendingMultiColorUpdate[]>([]);
  const [pendingUpdateVersion, setPendingUpdateVersion] = useState(0);

  const isControlled = controlledState !== undefined;
  const state = useMemo<MultiColorState>(
    () => controlledState ?? materializeState(internalState),
    [controlledState, internalState],
  );

  useEffect(() => {
    if (pendingUpdates.current.length === 0) return;

    const updates = pendingUpdates.current;
    pendingUpdates.current = [];
    const flushedSequences = new Set<number>();

    for (const update of updates) {
      if (flushedSequences.has(update.sequence)) continue;
      flushedSequences.add(update.sequence);
      onChange?.(materializeUpdateEvent(update));
    }
  }, [onChange, pendingUpdateVersion]);

  const applyUpdate = useCallback(
    (
      updater: (current: MultiColorInternalState) => MultiColorInternalState,
      interaction: ColorInteraction,
      id?: string,
      changedChannel?: ColorChannel,
    ) => {
      if (isControlled && controlledState) {
        const current = internalFromState(controlledState);
        const nextInternal = updater(current);
        if (nextInternal === current) return;
        onChange?.(
          materializeUpdateEvent(
            createPendingUpdate(
              0,
              nextInternal,
              interaction,
              id,
              changedChannel,
            ),
          ),
        );
        return;
      }

      const sequence = pendingUpdateSequence.current + 1;
      pendingUpdateSequence.current = sequence;

      setInternalState((current) => {
        const nextInternal = updater(current);
        if (nextInternal === current) return current;

        pendingUpdates.current.push(
          createPendingUpdate(
            sequence,
            nextInternal,
            interaction,
            id,
            changedChannel,
          ),
        );

        return nextInternal;
      });
      setPendingUpdateVersion(sequence);
    },
    [controlledState, isControlled, onChange],
  );

  const setRequested = useCallback(
    (id: string, requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveSource(interaction, options.source);

      applyUpdate(
        (current) => {
          if (!current.entries[id]) return current;

          return {
            ...current,
            entries: {
              ...current.entries,
              [id]: {
                requested: cloneColor(requested),
                source,
              },
            },
          };
        },
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
      applyUpdate(
        (current) => {
          const existing = current.entries[id];
          if (!existing) return current;

          const interaction = options.interaction ?? 'programmatic';
          const source = resolveSource(interaction, options.source);

          return {
            ...current,
            entries: {
              ...current.entries,
              [id]: {
                requested: {
                  ...existing.requested,
                  [channel]: value,
                },
                source,
              },
            },
          };
        },
        options.interaction ?? 'programmatic',
        id,
        channel,
      );
    },
    [applyUpdate],
  );

  const setActiveGamut = useCallback(
    (gamut: GamutTarget, source: ColorSource = 'user') => {
      applyUpdate((current) => {
        if (current.activeGamut === gamut) return current;

        return {
          ...current,
          activeGamut: gamut,
          entries: updateEntrySources(current.entries, current.order, source),
        };
      }, 'programmatic');
    },
    [applyUpdate],
  );

  const setActiveView = useCallback(
    (view: ViewModel, source: ColorSource = 'user') => {
      applyUpdate((current) => {
        if (current.activeView === view) return current;

        return {
          ...current,
          activeView: view,
          entries: updateEntrySources(current.entries, current.order, source),
        };
      }, 'programmatic');
    },
    [applyUpdate],
  );

  const select = useCallback(
    (id: string, interaction: ColorInteraction = 'programmatic') => {
      applyUpdate(
        (current) => {
          if (!current.entries[id] || current.selectedId === id) return current;

          return {
            ...current,
            selectedId: id,
          };
        },
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
        (current) => {
          if (current.entries[id]) return current;

          return {
            ...current,
            order: [...current.order, id],
            selectedId: current.selectedId ?? id,
            entries: {
              ...current.entries,
              [id]: createEntry(color, source),
            },
          };
        },
        'programmatic',
        id,
      );
    },
    [applyUpdate],
  );

  const removeColor = useCallback(
    (id: string, _source: ColorSource = 'programmatic') => {
      applyUpdate(
        (current) => {
          if (!current.entries[id]) return current;

          const nextOrder = current.order.filter((entryId) => entryId !== id);
          const nextEntries: Record<string, MultiColorEntryState> = {};
          for (const entryId of nextOrder) {
            const entry = current.entries[entryId];
            if (!entry) continue;
            nextEntries[entryId] = entry;
          }

          const nextSelectedId =
            current.selectedId === id
              ? (nextOrder[0] ?? null)
              : current.selectedId;

          return {
            ...current,
            order: nextOrder,
            entries: nextEntries,
            selectedId: nextSelectedId,
          };
        },
        'programmatic',
        id,
      );
    },
    [applyUpdate],
  );

  const renameColor = useCallback(
    (id: string, nextId: string, source: ColorSource = 'programmatic') => {
      applyUpdate(
        (current) => {
          if (
            id === nextId ||
            !current.entries[id] ||
            current.entries[nextId]
          ) {
            return current;
          }

          const nextOrder = current.order.map((entryId) =>
            entryId === id ? nextId : entryId,
          );
          const nextEntries = { ...current.entries };
          const existing = nextEntries[id];
          if (!existing) return current;

          nextEntries[nextId] = {
            requested: cloneColor(existing.requested),
            source,
          };
          delete nextEntries[id];

          return {
            ...current,
            order: nextOrder,
            selectedId: current.selectedId === id ? nextId : current.selectedId,
            entries: nextEntries,
          };
        },
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
