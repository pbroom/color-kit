import { forwardRef, type HTMLAttributes } from 'react';

/**
 * Semantic role of a {@link Layer}. `background`, `plane` and `overlay`
 * layers clip to the area; `annotation` and `ui` layers may overflow it.
 */
export type LayerKind =
  | 'background'
  | 'plane'
  | 'overlay'
  | 'annotation'
  | 'ui';

/** Props for {@link Layer}; other `div` attributes are forwarded. */
export interface LayerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Semantic grouping label for style and debug affordances (exposed as
   * `data-layer-kind`); also decides whether the layer clips to the area.
   * @defaultValue 'overlay'
   */
  kind?: LayerKind;
  /** Explicit z-index for layer ordering. */
  zIndex?: number;
  /**
   * Whether pointer events are enabled for this layer; otherwise pointer
   * input passes through to the {@link ColorArea}.
   * @defaultValue false
   */
  interactive?: boolean;
}

/**
 * Absolutely positioned stacking and grouping primitive that fills its
 * {@link ColorArea}.
 *
 * Layers ignore pointer input unless `interactive`, inherit the area's
 * border radius, and clip their content for the `background`, `plane` and
 * `overlay` kinds. Use one to stack custom markup (labels, SVG, markers
 * positioned with {@link Point}) over the plane.
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane, Layer, Point } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <Layer kind="annotation" zIndex={1}>
 *         <Point x={0.5} y={0.5}>center</Point>
 *       </Layer>
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export const Layer = forwardRef<HTMLDivElement, LayerProps>(function Layer(
  { kind = 'overlay', zIndex, interactive = false, style, ...props },
  ref,
) {
  const shouldClipToArea =
    kind === 'background' || kind === 'plane' || kind === 'overlay';

  return (
    <div
      {...props}
      ref={ref}
      data-color-area-layer=""
      data-layer-kind={kind}
      data-layer-interactive={interactive || undefined}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex,
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
        overflow: shouldClipToArea ? 'hidden' : 'visible',
      }}
    />
  );
});
