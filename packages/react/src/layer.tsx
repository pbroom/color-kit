import { forwardRef, type HTMLAttributes } from 'react';

export type LayerKind =
  | 'background'
  | 'plane'
  | 'overlay'
  | 'annotation'
  | 'ui';

export interface LayerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Semantic grouping label for style and debug affordances.
   * @default 'overlay'
   */
  kind?: LayerKind;
  /** Explicit z-index for layer ordering. */
  zIndex?: number;
  /** Whether pointer events are enabled for this layer. @default false */
  interactive?: boolean;
}

/**
 * Generic stacking and grouping primitive for ColorArea.
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
