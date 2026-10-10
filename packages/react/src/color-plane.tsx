import { forwardRef, useCallback, type CanvasHTMLAttributes } from 'react';
import type { GamutTarget } from '@color-kit/core';
import { assignRef } from './assign-ref.js';
import { useColorAreaContext } from './color-area-context.js';
import {
  useColorPlaneRenderer,
  type ColorPlaneEdgeBehavior,
  type ColorPlaneRenderer as PlaneRendererMode,
  type ColorPlaneSource,
} from './use-color-plane-renderer.js';

export type {
  ColorPlaneEdgeBehavior,
  ColorPlaneSource,
} from './use-color-plane-renderer.js';

/**
 * {@link ColorPlane} rasterizer: `'gpu'` (WebGL), `'cpu'` (2D canvas), or
 * `'auto'` (WebGL with a CPU fallback). `'canvas2d'` is a deprecated alias
 * of `'cpu'`.
 */
export type ColorPlaneRenderer = PlaneRendererMode | 'canvas2d';

let warnedCanvasAlias = false;

/** Props for {@link ColorPlane}; other `canvas` attributes are forwarded. */
export interface ColorPlaneProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'onChange'
> {
  /**
   * Paint the gamut-mapped `displayed` colors or the raw `requested` colors.
   * @defaultValue 'displayed'
   */
  source?: ColorPlaneSource;
  /**
   * Gamut the displayed pixels are mapped into. Defaults to the provider's
   * active gamut, or `'display-p3'` without a `<Color>` provider.
   */
  displayGamut?: GamutTarget;
  /**
   * Rasterizer. `'auto'` uses WebGL and falls back to the CPU renderer when
   * WebGL is unavailable or its context is lost. `'canvas2d'` is a
   * deprecated alias of `'cpu'`.
   * @defaultValue 'auto'
   */
  renderer?: ColorPlaneRenderer;
  /**
   * Out-of-gamut behavior for displayed source pixels.
   * - 'transparent': keep out-of-gamut pixels transparent.
   * - 'clamp': clamp out-of-gamut pixels to the nearest in-gamut edge.
   * @defaultValue 'clamp'
   */
  edgeBehavior?: ColorPlaneEdgeBehavior;
  /**
   * Extra backing-store scale factor beyond DPR (non-positive or non-finite
   * values count as 1). The effective scale, including the performance
   * profile's multiplier, is clamped to [0.35, 2.5].
   * @defaultValue 1
   */
  resolutionScale?: number;
}

function resolveRenderer(renderer: ColorPlaneRenderer): PlaneRendererMode {
  if (renderer === 'canvas2d') {
    if (!warnedCanvasAlias) {
      warnedCanvasAlias = true;
      console.warn(
        '[ColorPlane] renderer="canvas2d" is deprecated; use renderer="cpu".',
      );
    }
    return 'cpu';
  }
  return renderer;
}

/**
 * Canvas that rasterizes the {@link ColorArea}'s color plane: every pixel is
 * the requested color with the two axis channels set to that position.
 *
 * Renders with WebGL by default and falls back to a CPU renderer. With the
 * default `source="displayed"`, pixels are mapped into the display gamut
 * (`edgeBehavior` decides whether out-of-gamut pixels clamp or turn
 * transparent). Resolution follows the device pixel ratio, `resolutionScale`
 * and the area's adaptive quality level; the canvas fills the area and
 * ignores pointer events. `data-renderer` reports the renderer in use
 * (`gpu` or `cpu`). Must be rendered inside a ColorArea.
 *
 * @throws {Error} When rendered outside a `<ColorArea>`.
 * @see {@link OutOfGamutLayer}
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6" defaultGamut="srgb">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane edgeBehavior="transparent" />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export const ColorPlane = forwardRef<HTMLCanvasElement, ColorPlaneProps>(
  function ColorPlane(
    {
      source = 'displayed',
      displayGamut,
      renderer = 'auto',
      edgeBehavior,
      resolutionScale = 1,
      style,
      ...props
    },
    ref,
  ) {
    const { requested, axes, qualityLevel, performanceProfile, isDragging } =
      useColorAreaContext();
    const plane = useColorPlaneRenderer(
      { color: requested, axes },
      {
        source,
        displayGamut,
        renderer: resolveRenderer(renderer),
        edgeBehavior,
        resolutionScale,
        quality: qualityLevel,
        performanceProfile,
        isDragging,
      },
    );
    const planeRef = plane.ref;
    const setCanvasRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        const detachPlane = planeRef(node);
        const detachForwarded = assignRef(ref, node);
        return () => {
          if (typeof detachPlane === 'function') detachPlane();
          detachForwarded();
        };
      },
      [planeRef, ref],
    );

    return (
      <canvas
        {...props}
        key={plane.canvasKey}
        ref={setCanvasRef}
        data-color-area-plane=""
        data-source={source}
        data-renderer={plane.renderer}
        data-edge-behavior={plane.edgeBehavior}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          ...style,
        }}
      />
    );
  },
);
