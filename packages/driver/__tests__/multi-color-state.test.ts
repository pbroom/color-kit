import { describe, expect, it } from 'vitest';
import {
  addMultiColorEntry,
  createMultiColorModel,
  materializeMultiColorState,
  multiColorModelFromState,
  removeMultiColorEntry,
  renameMultiColorEntry,
  selectMultiColorEntry,
  setMultiColorActiveGamut,
  setMultiColorActiveView,
  setMultiColorChannel,
  setMultiColorRequested,
} from '../src/multi-color-state.js';

function createModel() {
  return createMultiColorModel({
    colors: {
      base: '#3b82f6',
      accent: 'oklch(0.8 0.4 145)',
    },
    selectedId: 'base',
  });
}

describe('createMultiColorModel', () => {
  it('creates a default entry when no colors are provided', () => {
    const model = createMultiColorModel();

    expect(model.order).toEqual(['color-1']);
    expect(model.selectedId).toBe('color-1');
    expect(model.activeGamut).toBe('display-p3');
    expect(model.activeView).toBe('oklch');
  });

  it('parses string colors and preserves entry order', () => {
    const model = createModel();

    expect(model.order).toEqual(['base', 'accent']);
    expect(model.entries.accent.requested.h).toBeCloseTo(145, 6);
    expect(model.entries.base.requested.alpha).toBe(1);
  });

  it('deduplicates ids and falls back to the first entry for unknown selection', () => {
    const model = createMultiColorModel({
      colors: [
        { id: 'a', color: '#ff0000' },
        { id: 'a', color: '#00ff00' },
        { id: 'b', color: '#0000ff' },
      ],
      selectedId: 'missing',
    });

    expect(model.order).toEqual(['a', 'b']);
    expect(model.selectedId).toBe('a');
  });
});

describe('materializeMultiColorState / multiColorModelFromState', () => {
  it('expands entries to ColorStates sharing one display context', () => {
    const model = setMultiColorActiveGamut(createModel(), 'srgb', 'user');
    const state = materializeMultiColorState(model);

    expect(state.order).toEqual(['base', 'accent']);
    expect(state.colors.base.activeGamut).toBe('srgb');
    expect(state.colors.accent.activeGamut).toBe('srgb');
    expect(state.colors.accent.displayed.srgb).toBeDefined();
  });

  it('round-trips through the materialized shape', () => {
    const model = createModel();
    const roundTripped = multiColorModelFromState(
      materializeMultiColorState(model),
    );

    expect(roundTripped).toEqual(model);
  });
});

describe('reducers', () => {
  it('setMultiColorRequested replaces the entry and clones the color', () => {
    const model = createModel();
    const requested = { l: 0.4, c: 0.1, h: 90, alpha: 0.5 };
    const next = setMultiColorRequested(model, 'base', requested, 'user');

    expect(next.entries.base.requested).toEqual(requested);
    expect(next.entries.base.requested).not.toBe(requested);
    expect(next.entries.base.source).toBe('user');
    expect(next.entries.accent).toBe(model.entries.accent);
  });

  it('setMultiColorChannel updates one channel and keeps the rest', () => {
    const model = createModel();
    const next = setMultiColorChannel(model, 'accent', 'h', 220, 'user');

    expect(next.entries.accent.requested.h).toBe(220);
    expect(next.entries.accent.requested.l).toBe(
      model.entries.accent.requested.l,
    );
    expect(next.entries.base).toBe(model.entries.base);
  });

  it('display-context reducers update shared context and entry sources', () => {
    const model = createModel();
    const next = setMultiColorActiveView(
      setMultiColorActiveGamut(model, 'srgb', 'user'),
      'hex',
      'user',
    );

    expect(next.activeGamut).toBe('srgb');
    expect(next.activeView).toBe('hex');
    expect(next.entries.base.source).toBe('user');
    expect(next.entries.accent.source).toBe('user');
  });

  it('add/select/rename/remove manage order and selection', () => {
    let model = createModel();

    model = addMultiColorEntry(model, 'neutral', '#6b7280');
    expect(model.order).toEqual(['base', 'accent', 'neutral']);

    model = renameMultiColorEntry(model, 'neutral', 'neutral-1');
    expect(model.order).toEqual(['base', 'accent', 'neutral-1']);
    expect(model.entries['neutral-1']).toBeDefined();
    expect(model.entries.neutral).toBeUndefined();

    model = selectMultiColorEntry(model, 'accent');
    expect(model.selectedId).toBe('accent');

    model = removeMultiColorEntry(model, 'accent');
    expect(model.order).toEqual(['base', 'neutral-1']);
    // Removing the selected entry falls back to the first remaining entry.
    expect(model.selectedId).toBe('base');
  });

  it('returns the same reference for no-op operations', () => {
    const model = createModel();

    expect(
      setMultiColorRequested(
        model,
        'missing',
        model.entries.base.requested,
        'user',
      ),
    ).toBe(model);
    expect(setMultiColorChannel(model, 'missing', 'h', 1, 'user')).toBe(model);
    expect(setMultiColorActiveGamut(model, model.activeGamut, 'user')).toBe(
      model,
    );
    expect(setMultiColorActiveView(model, model.activeView, 'user')).toBe(
      model,
    );
    expect(selectMultiColorEntry(model, 'base')).toBe(model);
    expect(selectMultiColorEntry(model, 'missing')).toBe(model);
    expect(addMultiColorEntry(model, 'base', '#000000')).toBe(model);
    expect(removeMultiColorEntry(model, 'missing')).toBe(model);
    expect(renameMultiColorEntry(model, 'base', 'base')).toBe(model);
    expect(renameMultiColorEntry(model, 'base', 'accent')).toBe(model);
    expect(renameMultiColorEntry(model, 'missing', 'other')).toBe(model);
  });
});
