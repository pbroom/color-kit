import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { SetRequestedOptions } from './use-color.js';

export type {
  MultiColorEntryInput,
  MultiColorInput,
  MultiColorState,
  MultiColorUpdateEvent,
} from '@color-kit/driver';

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

interface PendingMultiColorUpdate {
  sequence: number;
  nextModel: MultiColorModel;
  interaction: ColorInteraction;
  id?: string;
  changedChannel?: ColorChannel;
}

function createPendingUpdate(
  sequence: number,
  nextModel: MultiColorModel,
  interaction: ColorInteraction,
  id?: string,
  changedChannel?: ColorChannel,
): PendingMultiColorUpdate {
  const update: PendingMultiColorUpdate = {
    sequence,
    nextModel,
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
    next: materializeMultiColorState(update.nextModel),
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

  const [internalModel, setInternalModel] = useState<MultiColorModel>(() =>
    createMultiColorModel({
      colors: defaultColors,
      selectedId: defaultSelectedId,
      activeGamut: defaultGamut,
      activeView: defaultView,
    }),
  );
  const pendingUpdateSequence = useRef(0);
  const pendingUpdates = useRef<PendingMultiColorUpdate[]>([]);
  const [pendingUpdateVersion, setPendingUpdateVersion] = useState(0);

  const isControlled = controlledState !== undefined;
  const state = useMemo<MultiColorState>(
    () => controlledState ?? materializeMultiColorState(internalModel),
    [controlledState, internalModel],
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
      updater: (current: MultiColorModel) => MultiColorModel,
      interaction: ColorInteraction,
      id?: string,
      changedChannel?: ColorChannel,
    ) => {
      if (isControlled && controlledState) {
        const current = multiColorModelFromState(controlledState);
        const nextModel = updater(current);
        if (nextModel === current) return;
        onChange?.(
          materializeUpdateEvent(
            createPendingUpdate(0, nextModel, interaction, id, changedChannel),
          ),
        );
        return;
      }

      const sequence = pendingUpdateSequence.current + 1;
      pendingUpdateSequence.current = sequence;

      setInternalModel((current) => {
        const nextModel = updater(current);
        if (nextModel === current) return current;

        pendingUpdates.current.push(
          createPendingUpdate(
            sequence,
            nextModel,
            interaction,
            id,
            changedChannel,
          ),
        );

        return nextModel;
      });
      setPendingUpdateVersion(sequence);
    },
    [controlledState, isControlled, onChange],
  );

  const setRequested = useCallback(
    (id: string, requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveColorSource(interaction, options.source);

      applyUpdate(
        (current) => setMultiColorRequested(current, id, requested, source),
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
    (id: string, _source: ColorSource = 'programmatic') => {
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
