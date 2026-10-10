import type { Color, GamutMapMethod } from '@color-kit/core';
import { parse } from '@color-kit/core';
import {
  createColorState,
  resolveIncomingRequested,
  type ColorChannel,
  type ColorInteraction,
  type ColorSource,
  type ColorState,
  type GamutTarget,
  type ViewModel,
} from './color-state.js';

/** One initial entry of a multi-color model. */
export interface MultiColorEntryInput {
  /** Unique entry id. Later duplicates are ignored. */
  id: string;
  /** OKLCH color, or a CSS color string parsed with `parse`. */
  color: Color | string;
}

/**
 * Initial colors of a multi-color model: an `{ id: color }` record (in key
 * order) or an ordered array of entries.
 */
export type MultiColorInput =
  | Record<string, Color | string>
  | MultiColorEntryInput[];

/**
 * Materialized multi-color state: every entry expanded to a full ColorState
 * that shares one display context (activeGamut/activeView).
 */
export interface MultiColorState {
  /** Full color state of each entry, keyed by id. */
  colors: Record<string, ColorState>;
  /** Entry ids in display order. */
  order: string[];
  /** Id of the selected entry, or `null` when there are no entries. */
  selectedId: string | null;
  /** Gamut every entry renders in. */
  activeGamut: GamutTarget;
  /** Model every entry is shown in. */
  activeView: ViewModel;
}

/** Change notification a multi-color picker emits with its next state. */
export interface MultiColorUpdateEvent {
  /** State after the update. */
  next: MultiColorState;
  /** Input mechanism that caused the update. */
  interaction: ColorInteraction;
  /** Id of the entry the update touched, when it touched one. */
  id?: string;
  /** OKLCH channel the update edited, when it edited exactly one. */
  changedChannel?: ColorChannel;
}

/** Stored data of one multi-color entry. */
export interface MultiColorEntryModel {
  /** Requested OKLCH color, possibly out of gamut. */
  requested: Color;
  /** Source of the entry's last change. */
  source: ColorSource;
  /**
   * Gamut mapping for this entry's displayed colors, kept across updates.
   * @defaultValue 'chroma-reduction'
   */
  gamutMapMethod?: GamutMapMethod;
}

/**
 * Normalized multi-color model: requested colors plus one shared display
 * context. This is the canonical state machine shape; use
 * `materializeMultiColorState` to derive per-entry ColorStates at the
 * consumer boundary.
 */
export interface MultiColorModel {
  /** Entry data keyed by id. */
  entries: Record<string, MultiColorEntryModel>;
  /** Entry ids in display order. */
  order: string[];
  /** Id of the selected entry, or `null` when there are no entries. */
  selectedId: string | null;
  /** Gamut every entry renders in. */
  activeGamut: GamutTarget;
  /** Model every entry is shown in. */
  activeView: ViewModel;
}

/** Options for {@link createMultiColorModel}. */
export interface CreateMultiColorModelOptions {
  /**
   * Initial entries. An empty or missing input creates one entry,
   * `color-1`, with `{ l: 0.6, c: 0.2, h: 250, alpha: 1 }`.
   */
  colors?: MultiColorInput;
  /**
   * Initially selected id. Ignored when it names no entry.
   * @defaultValue the first entry's id
   */
  selectedId?: string;
  /**
   * Gamut every entry renders in.
   * @defaultValue 'display-p3'
   */
  activeGamut?: GamutTarget;
  /**
   * Model every entry is shown in.
   * @defaultValue 'oklch'
   */
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

/**
 * Creates a normalized multi-color model. String colors are parsed; entries
 * start with source `'programmatic'` and the default gamut mapping.
 *
 * @throws {Error} When a color string cannot be parsed.
 *
 * @example
 * ```ts
 * import { createMultiColorModel } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * model.order; // → ['bg', 'fg']
 * model.selectedId; // → 'bg'
 * createMultiColorModel().order; // → ['color-1']
 * ```
 */
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

/**
 * Expands a model into a {@link MultiColorState}: one full
 * {@link ColorState} per entry (with displayed colors and gamut flags), all
 * sharing the model's active gamut and view. Allocates new states on every
 * call.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import {
 *   createMultiColorModel,
 *   materializeMultiColorState,
 * } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const state = materializeMultiColorState(model);
 * toHex(state.colors.fg.displayed.srgb); // → '#3b82f6'
 * state.colors.fg.activeGamut; // → 'display-p3'
 * ```
 */
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
      gamutMapMethod: entry.gamutMapMethod,
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

/**
 * Converts a materialized {@link MultiColorState} back into a model, the
 * inverse of {@link materializeMultiColorState}. Ids listed in `order`
 * without a state are dropped, and a `selectedId` that no longer exists
 * falls back to the first id. A `'chroma-reduction'` mapping method is left
 * implicit so default states round-trip unchanged.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import {
 *   createMultiColorModel,
 *   materializeMultiColorState,
 *   multiColorModelFromState,
 * } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const roundTrip = multiColorModelFromState(materializeMultiColorState(model));
 * roundTrip.order; // → ['bg', 'fg']
 * toHex(roundTrip.entries.fg.requested); // → '#3b82f6'
 * ```
 */
export function multiColorModelFromState(
  state: MultiColorState,
): MultiColorModel {
  const entries: Record<string, MultiColorEntryModel> = {};
  const order: string[] = [];

  for (const id of state.order) {
    const colorState = state.colors[id];
    if (!colorState) continue;
    order.push(id);
    const entry: MultiColorEntryModel = {
      requested: cloneColor(colorState.requested),
      source: colorState.meta.source,
    };
    // Only a non-default method is recorded, so default states round-trip.
    if (colorState.meta.gamutMapMethod !== 'chroma-reduction') {
      entry.gamutMapMethod = colorState.meta.gamutMapMethod;
    }
    entries[id] = entry;
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
// `setMultiColorRequested` and `setMultiColorChannel` only do so for an
// unknown id; for a known id they always return a new model.

/** Options for {@link setMultiColorRequested}. */
export interface SetMultiColorRequestedOptions {
  /**
   * Whether `requested.h` is an OKLCH hue the caller stated. When `false`
   * and `requested` is achromatic, the entry's current requested hue is kept
   * (see {@link resolveIncomingRequested}). Pass `false` for colors converted
   * from hex, RGB, HSL, HSV or any non-OKLCH string.
   * @defaultValue true
   */
  explicitHue?: boolean;
}

/**
 * Replaces an entry's requested color. An achromatic `requested` keeps the
 * entry's current hue when `options.explicitHue` is `false` or its hue is not
 * finite (see {@link resolveIncomingRequested}). The entry's source is set
 * to `source`. Returns `model` unchanged for an unknown `id`; otherwise
 * always a new model, even when nothing changed.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import {
 *   createMultiColorModel,
 *   setMultiColorRequested,
 * } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = setMultiColorRequested(model, 'fg', parse('#808080'), 'user', {
 *   explicitHue: false,
 * });
 * toHex(next.entries.fg.requested); // → '#808080'
 * next.entries.fg.requested.h === model.entries.fg.requested.h; // → true
 * ```
 */
export function setMultiColorRequested(
  model: MultiColorModel,
  id: string,
  incoming: Color,
  source: ColorSource,
  options: SetMultiColorRequestedOptions = {},
): MultiColorModel {
  const existing = model.entries[id];
  if (!existing) return model;
  const requested = resolveIncomingRequested(existing.requested, incoming, {
    explicitHue: options.explicitHue ?? true,
  });

  return {
    ...model,
    entries: {
      ...model.entries,
      [id]: {
        ...existing,
        requested: cloneColor(requested),
        source,
      },
    },
  };
}

/**
 * Sets one OKLCH channel of an entry's requested color (unclamped) and its
 * source. Returns `model` unchanged for an unknown `id`; otherwise always a
 * new model, even when the channel already holds `value`.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import { createMultiColorModel, setMultiColorChannel } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = setMultiColorChannel(model, 'fg', 'l', 0.4, 'user');
 * toHex(next.entries.fg.requested); // → '#003baa'
 * next.entries.fg.source; // → 'user'
 * ```
 */
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
        ...existing,
        requested: {
          ...existing.requested,
          [channel]: value,
        },
        source,
      },
    },
  };
}

/**
 * Switches the shared display gamut and sets every entry's source to
 * `source`. No-op when the gamut is unchanged, whatever `source` is.
 * `gamut` is not validated (see {@link GamutTarget}).
 *
 * @example
 * ```ts
 * import {
 *   createMultiColorModel,
 *   setMultiColorActiveGamut,
 * } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = setMultiColorActiveGamut(model, 'srgb', 'user');
 * next.activeGamut; // → 'srgb'
 * next.entries.fg.source; // → 'user'
 * ```
 */
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

/**
 * Switches the shared view model and sets every entry's source to `source`.
 * No-op when the view is unchanged, whatever `source` is.
 *
 * @example
 * ```ts
 * import {
 *   createMultiColorModel,
 *   setMultiColorActiveView,
 * } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = setMultiColorActiveView(model, 'hsl', 'user');
 * next.activeView; // → 'hsl'
 * next.entries.bg.source; // → 'user'
 * ```
 */
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

/**
 * Selects an entry. No-op for an unknown `id` or the already selected one.
 *
 * @example
 * ```ts
 * import { createMultiColorModel, selectMultiColorEntry } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * selectMultiColorEntry(model, 'fg').selectedId; // → 'fg'
 * selectMultiColorEntry(model, 'missing') === model; // → true
 * ```
 */
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

/**
 * Appends an entry (string colors are parsed). Selects it only when nothing
 * was selected. No-op when `id` already exists.
 *
 * @param source - Source of the new entry.
 * @throws {Error} When `color` is a string that cannot be parsed.
 *
 * @example
 * ```ts
 * import { addMultiColorEntry, createMultiColorModel } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = addMultiColorEntry(model, 'accent', '#f97316');
 * next.order; // → ['bg', 'fg', 'accent']
 * next.selectedId; // → 'bg'
 * addMultiColorEntry(next, 'accent', '#000') === next; // → true
 * ```
 */
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

/**
 * Removes an entry. Removing the selected entry selects the first remaining
 * one (or `null`). No-op for an unknown `id`.
 *
 * @example
 * ```ts
 * import { createMultiColorModel, removeMultiColorEntry } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * const next = removeMultiColorEntry(model, 'bg');
 * next.order; // → ['fg']
 * next.selectedId; // → 'fg'
 * ```
 */
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

/**
 * Renames an entry in place, keeping its position, color and selection, and
 * sets its source. No-op when `id` is unknown, `nextId` already exists, or
 * the ids are equal.
 *
 * @param source - Source recorded on the renamed entry.
 *
 * @example
 * ```ts
 * import { createMultiColorModel, renameMultiColorEntry } from 'color-kit/driver';
 *
 * const model = createMultiColorModel({ colors: { bg: '#ffffff', fg: '#3b82f6' } });
 * renameMultiColorEntry(model, 'fg', 'text').order; // → ['bg', 'text']
 * renameMultiColorEntry(model, 'fg', 'bg') === model; // → true
 * ```
 */
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
    ...existing,
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
