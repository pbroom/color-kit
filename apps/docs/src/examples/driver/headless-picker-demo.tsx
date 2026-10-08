import { useEffect, useRef } from 'react';
import { parse } from 'color-kit';
import { bindPicker } from './headless-picker';

const thumbClass =
  'absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.5)]';

/** Static markup only; `bindPicker` owns every update after mount. */
export default function HeadlessPickerDemo() {
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);
  const hueThumb = useRef<HTMLDivElement>(null);
  const swatch = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !area.current ||
      !canvas.current ||
      !thumb.current ||
      !hue.current ||
      !hueThumb.current ||
      !swatch.current
    ) {
      return;
    }
    return bindPicker(
      {
        area: area.current,
        canvas: canvas.current,
        thumb: thumb.current,
        hue: hue.current,
        hueThumb: hueThumb.current,
        swatch: swatch.current,
      },
      parse('#3b82f6'),
    );
  }, []);

  return (
    <div className="grid max-w-80 gap-3">
      <div ref={area} className="relative aspect-[3/2] touch-none select-none">
        <canvas
          ref={canvas}
          width={96}
          height={64}
          className="size-full rounded-sm"
          aria-hidden="true"
        />
        <div
          ref={thumb}
          role="slider"
          tabIndex={0}
          aria-label="Lightness and chroma"
          aria-roledescription="2D slider"
          className={thumbClass}
        />
      </div>
      <div
        ref={hue}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        className="relative h-3 touch-none rounded-full select-none"
      >
        <div ref={hueThumb} className={`${thumbClass} top-1/2`} />
      </div>
      <div
        ref={swatch}
        className="h-8 rounded-sm border border-border"
        role="img"
        aria-label="Selected color"
      />
    </div>
  );
}
