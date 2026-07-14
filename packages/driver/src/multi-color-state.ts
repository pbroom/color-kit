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

export interface MultiColorEntryInput {
  id: string;
  color: Color | string;
}

export type MultiColorInput =
  | Record<string, Color | string>
  | MultiColorEntryInput[];

/**
 * Materialized multi-color state: every entry expanded to a full ColorState
 * that shares one display context (activeGamut/activeView).
 */
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

export interface MultiColorEntryModel {
  requested: Color;
  source: ColorSource;
}

/**
 * Normalized multi-color model: requested colors plus one shared display
 * context. This is the canonical state machine shape; use
 * `materializeMultiColorState` to derive per-entry ColorStates at the
 * consumer boundary.
 */
export interface MultiColorModel {
  entries: Record<string, MultiColorEntryModel>;
  order: string[];
  selectedId: string | null;
  activeGamut: GamutTarget;
  activeView: ViewModel;
}

export interface CreateMultiColorModelOptions {
  colors?: MultiColorInput;
  selectedId?: string;
  activeGamut?: GamutTarget;
  activeView?: ViewModel;
}

const DEFAULT_ENTRY: MultiColorEntryInput = {
  id: 'color-1',
  color: { l: 0.6, c: 0.2, h: 250, alpha: 1 },
};

function resolveColor(input: Color | string): Color {
  return typeof input === 'string' ? parse(input) : input;
}

function cloneColor(color: Color): Color {
  return { ...color };
}

function createEntry(
  input: Color | string,
  source: ColorSource = 'programmatic',
): MultiColorEntryModel {
  return {
    requested: cloneColor(resolveColor(input)),
    source,
  };
}

function normalizeInputColors(
  input: MultiColorInput | undefined,
): MultiColorEntryInput[] {
  if (!input) {
    return [DEFAULT_ENTRY];
  }
  if (Array.isArray(input)) {
    return input.length > 0 ? input : [DEFAULT_ENTRY];
  }
  const entries = Object.entries(input).map(([id, color]) => ({ id, color }));
  return entries.length > 0 ? entries : [DEFAULT_ENTRY];
}

export function createMultiColorModel(
  options: CreateMultiColorModelOptions = {},
): MultiColorModel {
  const {
    colors,
    selectedId: selectedIdInput,
    activeGamut = 'display-p3',
    activeView = 'oklch',
  } = options;

  const inputs = normalizeInputColors(colors);
  const order: string[] = [];
  const entries: Record<string, MultiColorEntryModel> = {};

  for (const input of inputs) {
    if (entries[input.id]) continue;
    order.push(input.id);
    entries[input.id] = createEntry(input.color);
  }

  const selectedId =
    selectedIdInput && entries[selectedIdInput]
      ? selectedIdInput
      : (order[0] ?? null);

  return {
    entries,
    order,
    selectedId,
    activeGamut,
    activeView,
  };
}

export function materializeMultiColorState(
  model: MultiColorModel,
): MultiColorState {
  const colors: Record<string, ColorState> = {};

  for (const id of model.order) {
    const entry = model.entries[id];
    if (!entry) continue;
    colors[id] = createColorState(entry.requested, {
      activeGamut: model.activeGamut,
      activeView: model.activeView,
      source: entry.source,
    });
  }

  return {
    colors,
    order: [...model.order],
    selectedId: model.selectedId,
    activeGamut: model.activeGamut,
    activeView: model.activeView,
  };
}

export function multiColorModelFromState(
  state: MultiColorState,
): MultiColorModel {
  const entries: Record<string, MultiColorEntryModel> = {};
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
  entries: Record<string, MultiColorEntryModel>,
  order: string[],
  source: ColorSource,
): Record<string, MultiColorEntryModel> {
  let nextEntries: Record<string, MultiColorEntryModel> | null = null;

  for (const id of order) {
    const entry = entries[id];
    if (!entry || entry.source === source) continue;
    nextEntries ??= { ...entries };
    nextEntries[id] = { ...entry, source };
  }

  return nextEntries ?? entries;
}

// All reducers below return the input model unchanged (same reference) when
// the operation is a no-op, so callers can cheaply skip redundant updates.

export function setMultiColorRequested(
  model: MultiColorModel,
  id: string,
  requested: Color,
  source: ColorSource,
): MultiColorModel {
  if (!model.entries[id]) return model;

  return {
    ...model,
    entries: {
      ...model.entries,
      [id]: {
        requested: cloneColor(requested),
        source,
      },
    },
  };
}

export function setMultiColorChannel(
  model: MultiColorModel,
  id: string,
  channel: ColorChannel,
  value: number,
  source: ColorSource,
): MultiColorModel {
  const existing = model.entries[id];
  if (!existing) return model;

  return {
    ...model,
    entries: {
      ...model.entries,
      [id]: {
        requested: {
          ...existing.requested,
          [channel]: value,
        },
        source,
      },
    },
  };
}

export function setMultiColorActiveGamut(
  model: MultiColorModel,
  gamut: GamutTarget,
  source: ColorSource,
): MultiColorModel {
  if (model.activeGamut === gamut) return model;

  return {
    ...model,
    activeGamut: gamut,
    entries: updateEntrySources(model.entries, model.order, source),
  };
}

export function setMultiColorActiveView(
  model: MultiColorModel,
  view: ViewModel,
  source: ColorSource,
): MultiColorModel {
  if (model.activeView === view) return model;

  return {
    ...model,
    activeView: view,
    entries: updateEntrySources(model.entries, model.order, source),
  };
}

export function selectMultiColorEntry(
  model: MultiColorModel,
  id: string,
): MultiColorModel {
  if (!model.entries[id] || model.selectedId === id) return model;

  return {
    ...model,
    selectedId: id,
  };
}

export function addMultiColorEntry(
  model: MultiColorModel,
  id: string,
  color: Color | string,
  source: ColorSource = 'programmatic',
): MultiColorModel {
  if (model.entries[id]) return model;

  return {
    ...model,
    order: [...model.order, id],
    selectedId: model.selectedId ?? id,
    entries: {
      ...model.entries,
      [id]: createEntry(color, source),
    },
  };
}

export function removeMultiColorEntry(
  model: MultiColorModel,
  id: string,
): MultiColorModel {
  if (!model.entries[id]) return model;

  const nextOrder = model.order.filter((entryId) => entryId !== id);
  const nextEntries: Record<string, MultiColorEntryModel> = {};
  for (const entryId of nextOrder) {
    const entry = model.entries[entryId];
    if (!entry) continue;
    nextEntries[entryId] = entry;
  }

  const nextSelectedId =
    model.selectedId === id ? (nextOrder[0] ?? null) : model.selectedId;

  return {
    ...model,
    order: nextOrder,
    entries: nextEntries,
    selectedId: nextSelectedId,
  };
}

export function renameMultiColorEntry(
  model: MultiColorModel,
  id: string,
  nextId: string,
  source: ColorSource = 'programmatic',
): MultiColorModel {
  if (id === nextId || !model.entries[id] || model.entries[nextId]) {
    return model;
  }

  const existing = model.entries[id];
  if (!existing) return model;

  const nextOrder = model.order.map((entryId) =>
    entryId === id ? nextId : entryId,
  );
  const nextEntries = { ...model.entries };
  nextEntries[nextId] = {
    requested: cloneColor(existing.requested),
    source,
  };
  delete nextEntries[id];

  return {
    ...model,
    order: nextOrder,
    selectedId: model.selectedId === id ? nextId : model.selectedId,
    entries: nextEntries,
  };
}
