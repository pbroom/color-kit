import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

/**
 * Screen transform of the map: a layout point (nx, ny) draws at
 * (x + nx·k, H/2 + y + ny·k) inside the canvas, where H is the canvas
 * height. The vertical origin is the canvas middle (an inner `<svg y="50%">`),
 * so the prerendered first view is centered without measuring anything.
 */
export interface View {
  x: number;
  y: number;
  k: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;

/** Must match `.api-map__viewport[data-pristine]` in `map.css`. */
export const NARROW_QUERY = '(max-width: 40rem)';
export function initialView(narrow: boolean): View {
  return narrow ? { x: 16, y: 0, k: 0.8 } : { x: 24, y: 0, k: 1 };
}

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** Pointer travel (px) before a press becomes a pan instead of a click. */
const DRAG_THRESHOLD = 4;

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Gesture {
  startX: number;
  startY: number;
  view: View;
  /** Two-pointer pinch: starting distance and midpoint. */
  pinch?: { distance: number; midX: number; midY: number };
}

/**
 * Pointer pan, pinch and ⌘/Ctrl-wheel zoom for an SVG canvas, without d3-zoom.
 * Plain wheel scrolls the page (the map sits in a long document); a drag
 * pans, two fingers pinch, and a drag never fires the click it started on.
 * `view` is `null` until the first interaction, so the server and the first
 * client render agree and CSS owns the responsive first view.
 */
export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>) {
  const [view, setView] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);

  const current = (): View =>
    view ?? initialView(window.matchMedia(NARROW_QUERY).matches);

  /** Canvas size and the pointer position in view coordinates. */
  const local = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      px: clientX - rect.left,
      py: clientY - rect.top - rect.height / 2,
    };
  };

  const zoomAround = (base: View, px: number, py: number, k: number): View => {
    const next = clampZoom(k);
    const ratio = next / base.k;
    return {
      x: px - (px - base.x) * ratio,
      y: py - (py - base.y) * ratio,
      k: next,
    };
  };

  // React's onWheel is passive; zooming must cancel the page's own zoom.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top - rect.height / 2;
      // Trackpad pinches send many small deltas, mouse wheels a few large
      // ones (lines in Firefox): cap each event at about 1.4×.
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      const factor = 2 ** Math.max(-0.5, Math.min(0.5, -delta * 0.01));
      setView((prev) => {
        const base =
          prev ?? initialView(window.matchMedia(NARROW_QUERY).matches);
        return zoomAround(base, px, py, base.k * factor);
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    dragged.current = false;
    const base = current();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current = {
        startX: mid.px,
        startY: mid.py,
        view: base,
        pinch: {
          distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          midX: mid.px,
          midY: mid.py,
        },
      };
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      gesture.current = {
        startX: event.clientX,
        startY: event.clientY,
        view: base,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      // Released outside before capture began: drop the stale gesture.
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const start = gesture.current;
    if (start.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const scale = Math.hypot(a.x - b.x, a.y - b.y) / start.pinch.distance;
      const zoomed = zoomAround(
        start.view,
        start.pinch.midX,
        start.pinch.midY,
        start.view.k * scale,
      );
      setView({
        x: zoomed.x + (mid.px - start.pinch.midX),
        y: zoomed.y + (mid.py - start.pinch.midY),
        k: zoomed.k,
      });
      return;
    }
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!dragged.current) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragged.current = true;
      // Capture only once it is a drag, so plain clicks reach their links.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setView({ x: start.view.x + dx, y: start.view.y + dy, k: start.view.k });
  };

  const onPointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    } else if (gesture.current?.pinch) {
      // One finger lifted: continue as a pan from here.
      const [rest] = [...pointers.current.values()] as [
        { x: number; y: number },
      ];
      gesture.current = { startX: rest.x, startY: rest.y, view: current() };
    }
  };

  /** Swallow the click that ends a drag. */
  const onClickCapture = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (dragged.current) {
      dragged.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const zoomBy = (factor: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const base = current();
    setView(zoomAround(base, rect.width / 2, 0, base.k * factor));
  };

  /** Fit `bounds` (layout units); tall trees start at their top instead. */
  const fit = (bounds: Bounds, { maxZoom = 1, minZoom = MIN_ZOOM } = {}) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const pad = 24;
    const width = Math.max(1, bounds.right - bounds.left);
    const height = Math.max(1, bounds.bottom - bounds.top);
    const k = clampZoom(
      Math.max(
        minZoom,
        Math.min(
          maxZoom,
          (rect.width - pad * 2) / width,
          (rect.height - pad * 2) / height,
        ),
      ),
    );
    const x =
      pad -
      bounds.left * k +
      Math.max(0, (rect.width - pad * 2 - width * k) / 2);
    const fitsTall = height * k <= rect.height - pad * 2;
    const y = fitsTall
      ? -((bounds.top + bounds.bottom) / 2) * k
      : pad - rect.height / 2 - bounds.top * k;
    setView({ x, y, k });
  };

  /**
   * Pan so the layout point (nx, ny) is comfortably inside the canvas;
   * `center` always recenters it.
   */
  const reveal = (nx: number, ny: number, center = false) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const base = current();
    const sx = base.x + nx * base.k;
    const sy = rect.height / 2 + base.y + ny * base.k;
    const inside =
      sx > 40 && sx < rect.width - 160 && sy > 28 && sy < rect.height - 28;
    if (inside && !center) return;
    const targetX = rect.width > 720 ? rect.width * 0.38 : rect.width * 0.3;
    setView({
      x: targetX - nx * base.k,
      y: -ny * base.k,
      k: base.k,
    });
  };

  return {
    view,
    setView,
    zoomBy,
    fit,
    reveal,
    reset: () => setView(null),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
  };
}
