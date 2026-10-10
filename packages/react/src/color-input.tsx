import { forwardRef, useCallback, useMemo, type HTMLAttributes } from 'react';
import { useColorStoreSelector } from './color-store.js';
import type { Color } from '@color-kit/core';
import {
  usePrimitiveValueInput,
  type PrimitiveExpressionParser,
  type PrimitiveValueChangeDetails,
} from '@color-kit/control-kit';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorInputChannelValue,
  formatColorInputChannelValue,
  getColorInputChangedChannel,
  getColorInputChannelValue,
  getColorInputChannelGlyph,
  getColorInputLabel,
  getColorInputPrecisionFromStep,
  parseColorInputExpression,
  resolveColorInputRange,
  resolveColorInputSteps,
  resolveColorInputWrap,
  type ColorInputPrimitiveExpressionOptions,
  type HslColorInputChannel,
  type OklchColorInputChannel,
  type RgbColorInputChannel,
} from '@color-kit/driver';
import type { SetRequestedOptions } from './use-color.js';

interface ColorInputBaseProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Standalone requested color, used instead of a `<Color>` provider. */
  requested?: Color;
  /** Standalone change handler, used instead of a `<Color>` provider. */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /**
   * Optional channel range override. Defaults per channel: OKLCH `l` [0, 1],
   * `c` [0, 0.4], `h` [0, 360]; RGB [0, 255]; HSL `h` [0, 360], `s`/`l`
   * [0, 100]; `alpha` [0, 1].
   */
  range?: [number, number];
  /** Wrap values across range boundaries (defaults true for hue channels) */
  wrap?: boolean;
  /** Arrow step value (default depends on the channel, e.g. 1 for hue, 0.01 for OKLCH `l`) */
  step?: number;
  /** Option/Alt modifier step value (default depends on the channel) */
  fineStep?: number;
  /** Shift modifier step value (default depends on the channel) */
  coarseStep?: number;
  /** PageUp/PageDown step value (default depends on the channel) */
  pageStep?: number;
  /**
   * Enable arithmetic and relative expressions for text commits (e.g.
   * `+10`, `2*(3+4)`).
   * @defaultValue true
   */
  allowExpressions?: boolean;
  /**
   * Select input text on focus.
   * @defaultValue true
   */
  selectAllOnFocus?: boolean;
  /**
   * Commit draft value on blur.
   * @defaultValue true
   */
  commitOnBlur?: boolean;
  /**
   * Size (px) of the square leading scrub/drag hit area.
   * @defaultValue 24
   */
  scrubHandleSize?: number;
  /**
   * Horizontal pixels per step during scrub drag.
   * @defaultValue 6
   */
  scrubPixelsPerStep?: number;
  /**
   * Minimum channel delta before committing another scrub update.
   * @defaultValue 0.0005
   */
  dragEpsilon?: number;
  /**
   * Maximum scrub update rate while dragging (updates/second).
   * @defaultValue 120
   */
  maxScrubRate?: number;
  /** Number precision for formatted channel values (defaults to the fine step's decimals) */
  precision?: number;
  /** Called when Enter/blur commit receives an invalid draft value */
  onInvalidCommit?: (draft: string) => void;
}

/**
 * Props for `ColorInput`: a `model` with one of its channels, plus the
 * shared input options. Other attributes go to the wrapper `div`.
 */
export type ColorInputProps =
  | ({
      model: 'oklch';
      channel: OklchColorInputChannel;
    } & ColorInputBaseProps)
  | ({
      model: 'rgb';
      channel: RgbColorInputChannel;
    } & ColorInputBaseProps)
  | ({
      model: 'hsl';
      channel: HslColorInputChannel;
    } & ColorInputBaseProps);

const SCRUB_DRAG_START_THRESHOLD_PX = 2;

/**
 * A headless value input that edits one channel in oklch/rgb/hsl.
 *
 * Supports text entry, expression parsing, keyboard stepping, and left-edge scrub dragging.
 * Reads and writes the nearest `<Color>` provider, or the standalone
 * `requested` / `onChangeRequested` props. RGB and HSL edits convert back to
 * the OKLCH requested color; an achromatic result keeps the current hue.
 * Lives on the `@color-kit/react/color-input` subpath because it depends on
 * the optional `@color-kit/control-kit` peer. The public `color-kit` facade
 * does not ship `ColorInput` yet; use the workspace `@color-kit/react`
 * provider with this subpath so both share the same color context.
 *
 * @throws {Error} When there is neither a `<Color>` ancestor nor both
 *   `requested` and `onChangeRequested`.
 *
 * @example
 * ```tsx
 * import { Color } from '@color-kit/react';
 * import { ColorInput } from '@color-kit/react/color-input';
 *
 * export const Channels = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorInput model="oklch" channel="l" />
 *     <ColorInput model="oklch" channel="h" step={5} />
 *     <ColorInput model="rgb" channel="r" />
 *   </Color>
 * );
 * ```
 */
export const ColorInput = forwardRef<HTMLDivElement, ColorInputProps>(
  function ColorInput(
    {
      model,
      channel,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      range,
      wrap,
      step,
      fineStep,
      coarseStep,
      pageStep,
      allowExpressions = true,
      selectAllOnFocus = true,
      commitOnBlur = true,
      scrubHandleSize = 24,
      scrubPixelsPerStep = 6,
      dragEpsilon = 0.0005,
      maxScrubRate = 120,
      precision,
      onInvalidCommit,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextRequested = useColorStoreSelector(
      context?.store ?? null,
      (state) => state?.requested ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorInput requires either a <Color> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const resolvedRange = useMemo(
      () => resolveColorInputRange(model, channel, range),
      [channel, model, range],
    );
    const resolvedWrap = useMemo(
      () => resolveColorInputWrap(model, channel, wrap),
      [channel, model, wrap],
    );
    const resolvedSteps = useMemo(
      () =>
        resolveColorInputSteps(model, channel, {
          step,
          fineStep,
          coarseStep,
          pageStep,
        }),
      [channel, coarseStep, fineStep, model, pageStep, step],
    );
    const resolvedPrecision = useMemo(
      () => precision ?? getColorInputPrecisionFromStep(resolvedSteps.fineStep),
      [precision, resolvedSteps.fineStep],
    );
    const channelValue = useMemo(
      () => getColorInputChannelValue(requested, model, channel),
      [channel, model, requested],
    );
    const channelLabel = useMemo(
      () => getColorInputLabel(model, channel),
      [channel, model],
    );
    const channelGlyph = useMemo(
      () => getColorInputChannelGlyph(model, channel),
      [channel, model],
    );
    const changedChannel = useMemo(
      () => getColorInputChangedChannel(model, channel),
      [channel, model],
    );

    const parseExpression = useCallback<PrimitiveExpressionParser>(
      (draft: string, options: ColorInputPrimitiveExpressionOptions) =>
        parseColorInputExpression(draft, {
          currentValue: options.currentValue,
          range: options.range,
          allowExpressions: options.allowExpressions,
        }),
      [],
    );

    const handlePrimitiveValueChange = useCallback(
      (nextValue: number, details: PrimitiveValueChangeDetails) => {
        const nextColor = colorFromColorInputChannelValue(
          requested,
          model,
          channel,
          nextValue,
        );
        setRequested(nextColor, {
          interaction: details.interaction,
          ...(changedChannel ? { changedChannel } : {}),
          // RGB/HSL edits convert through OKLab: an achromatic result keeps
          // the latest requested hue instead of the converted hue 0. An HSL
          // hue edit states the hue, so a gray takes the typed hue instead.
          ...(model === 'oklch' || (model === 'hsl' && channel === 'h')
            ? {}
            : { explicitHue: false }),
        });
      },
      [changedChannel, channel, model, requested, setRequested],
    );

    const {
      inputRef,
      inputProps,
      scrubHandleRef,
      scrubHandleProps,
      isDraftValid,
      isEditing,
      isScrubbing,
    } = usePrimitiveValueInput({
      value: channelValue,
      onValueChange: handlePrimitiveValueChange,
      min: resolvedRange[0],
      max: resolvedRange[1],
      wrapMode: resolvedWrap ? 'wrap' : 'clamp',
      step: resolvedSteps.step,
      fineStep: resolvedSteps.fineStep,
      coarseStep: resolvedSteps.coarseStep,
      pageStep: resolvedSteps.pageStep,
      precision: resolvedPrecision,
      autoTrim: true,
      allowExpressions,
      parseExpression,
      selectAllOnFocus,
      commitOnBlur,
      scrubEnabled: true,
      scrubPixelsPerStep,
      scrubThreshold: SCRUB_DRAG_START_THRESHOLD_PX,
      scrubCommitThreshold: dragEpsilon,
      scrubMaxCommitRate: maxScrubRate,
      pointerLockEnabled: true,
      horizontalArrowKeysMoveCaret: false,
      disabled: false,
      readOnly: false,
      onInvalidCommit,
    });

    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === 'function') {
          ref(node);
          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    return (
      <div
        {...props}
        ref={setRootRef}
        data-color-input=""
        data-model={model}
        data-channel={channel}
        data-valid={isDraftValid || undefined}
        data-editing={isEditing || undefined}
        data-scrubbing={isScrubbing || undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          columnGap: 0,
          boxSizing: 'border-box',
          touchAction: 'manipulation',
          ...props.style,
        }}
      >
        <div
          ref={scrubHandleRef}
          data-color-input-scrub-handle=""
          aria-hidden="true"
          style={{
            width: `${Math.max(0, scrubHandleSize)}px`,
            height: `${Math.max(0, scrubHandleSize)}px`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ew-resize',
            touchAction: 'none',
            userSelect: 'none',
          }}
          {...scrubHandleProps}
        >
          {channelGlyph}
        </div>
        <input
          ref={inputRef}
          type="text"
          role="spinbutton"
          aria-label={props['aria-label'] ?? `${channelLabel} value`}
          aria-valuemin={resolvedRange[0]}
          aria-valuemax={resolvedRange[1]}
          aria-valuenow={channelValue}
          aria-valuetext={`${formatColorInputChannelValue(
            channelValue,
            resolvedPrecision,
          )} ${channelLabel}`}
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          style={{ flex: 1, minWidth: 0 }}
          {...inputProps}
        />
      </div>
    );
  },
);
