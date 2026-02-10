import { useCallback, useMemo, useState } from 'react';
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
} from './color-state.js';
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

function resolveColor(input: Color | string): Color {
  return typeof input === 'string' ? parse(input) : input;
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

function buildState(
  colorsInput: MultiColorInput | undefined,
  selectedIdInput: string | undefined,
  activeGamut: GamutTarget,
  activeView: ViewModel,
): MultiColorState {
  const entries = normalizeInputColors(colorsInput);
  const order: string[] = [];
  const colors: Record<string, ColorState> = {};

  for (const entry of entries) {
    if (colors[entry.id]) continue;
    order.push(entry.id);
    colors[entry.id] = createColorState(resolveColor(entry.color), {
      activeGamut,
      activeView,
      source: 'programmatic',
    });
  }

  const selectedId =
    selectedIdInput && colors[selectedIdInput]
      ? selectedIdInput
      : (order[0] ?? null);

  return {
    colors,
    order,
    selectedId,
    activeGamut,
    activeView,
  };
}

function resolveSource(
  interaction: ColorInteraction,
  source?: ColorSource,
): ColorSource {
  if (source) return source;
  return interaction === 'programmatic' ? 'programmatic' : 'user';
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

  const [internalState, setInternalState] = useState<MultiColorState>(() =>
    buildState(defaultColors, defaultSelectedId, defaultGamut, defaultView),
  );

  const isControlled = controlledState !== undefined;
  const state = isControlled ? controlledState : internalState;

  const applyUpdate = useCallback(
    (
      updater: (current: MultiColorState) => MultiColorState,
      interaction: ColorInteraction,
      id?: string,
      changedChannel?: ColorChannel,
    ) => {
      if (isControlled) {
        const next = updater(state);
        if (next === state) return;
        onChange?.({
          next,
          interaction,
          id,
          changedChannel,
        });
        return;
      }

      setInternalState((current) => {
        const next = updater(current);
        if (next !== current) {
          onChange?.({
            next,
            interaction,
            id,
            changedChannel,
          });
        }
        return next;
      });
    },
    [isControlled, onChange, state],
  );

  const setRequested = useCallback(
    (id: string, requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveSource(interaction, options.source);

      applyUpdate(
        (current) => {
          if (!current.colors[id]) return current;

          const nextColorState = createColorState(requested, {
            activeGamut: current.activeGamut,
            activeView: current.activeView,
            source,
          });

          return {
            ...current,
            colors: {
              ...current.colors,
              [id]: nextColorState,
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
          const existing = current.colors[id];
          if (!existing) return current;

          const interaction = options.interaction ?? 'programmatic';
          const source = resolveSource(interaction, options.source);

          return {
            ...current,
            colors: {
              ...current.colors,
              [id]: createColorState(
                {
                  ...existing.requested,
                  [channel]: value,
                },
                {
                  activeGamut: current.activeGamut,
                  activeView: current.activeView,
                  source,
                },
              ),
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

        const nextColors: Record<string, ColorState> = {};
        for (const id of current.order) {
          const entry = current.colors[id];
          if (!entry) continue;
          nextColors[id] = createColorState(entry.requested, {
            activeGamut: gamut,
            activeView: current.activeView,
            source,
          });
        }

        return {
          ...current,
          activeGamut: gamut,
          colors: nextColors,
        };
      }, 'programmatic');
    },
    [applyUpdate],
  );

  const setActiveView = useCallback(
    (view: ViewModel, source: ColorSource = 'user') => {
      applyUpdate((current) => {
        if (current.activeView === view) return current;

        const nextColors: Record<string, ColorState> = {};
        for (const id of current.order) {
          const entry = current.colors[id];
          if (!entry) continue;
          nextColors[id] = createColorState(entry.requested, {
            activeGamut: current.activeGamut,
            activeView: view,
            source,
          });
        }

        return {
          ...current,
          activeView: view,
          colors: nextColors,
        };
      }, 'programmatic');
    },
    [applyUpdate],
  );

  const select = useCallback(
    (id: string, interaction: ColorInteraction = 'programmatic') => {
      applyUpdate(
        (current) => {
          if (!current.colors[id] || current.selectedId === id) return current;

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
          if (current.colors[id]) return current;

          const nextColorState = createColorState(resolveColor(color), {
            activeGamut: current.activeGamut,
            activeView: current.activeView,
            source,
          });

          return {
            ...current,
            order: [...current.order, id],
            selectedId: current.selectedId ?? id,
            colors: {
              ...current.colors,
              [id]: nextColorState,
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
    (id: string, source: ColorSource = 'programmatic') => {
      applyUpdate(
        (current) => {
          if (!current.colors[id]) return current;

          const nextOrder = current.order.filter((entryId) => entryId !== id);
          const nextColors: Record<string, ColorState> = {};
          for (const entryId of nextOrder) {
            const entry = current.colors[entryId];
            if (!entry) continue;
            nextColors[entryId] = createColorState(entry.requested, {
              activeGamut: current.activeGamut,
              activeView: current.activeView,
              source,
            });
          }

          const nextSelectedId =
            current.selectedId === id
              ? (nextOrder[0] ?? null)
              : current.selectedId;

          return {
            ...current,
            order: nextOrder,
            colors: nextColors,
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
          if (id === nextId || !current.colors[id] || current.colors[nextId]) {
            return current;
          }

          const nextOrder = current.order.map((entryId) =>
            entryId === id ? nextId : entryId,
          );
          const nextColors = { ...current.colors };
          const existing = nextColors[id];
          if (!existing) return current;

          nextColors[nextId] = createColorState(existing.requested, {
            activeGamut: current.activeGamut,
            activeView: current.activeView,
            source,
          });
          delete nextColors[id];

          return {
            ...current,
            order: nextOrder,
            selectedId: current.selectedId === id ? nextId : current.selectedId,
            colors: nextColors,
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
