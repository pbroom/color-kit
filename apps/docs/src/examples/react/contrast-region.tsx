import { useId, useState } from 'react';
import { parse, type Color } from 'color-kit';
import type { ColorAreaAxes } from 'color-kit/driver';
import { useColor, useContrastRegion } from 'color-kit/react';
import { PlanePicker, type PlaneOverlayProps } from './plane-picker';

const BACKGROUNDS = { white: parse('#ffffff'), black: parse('#000000') };
type Background = keyof typeof BACKGROUNDS;
type Level = 'AA' | 'AAA';

const AXES: ColorAreaAxes = {
  x: { channel: 'l' },
  y: { channel: 'c', range: [0, 0.3] },
};

/** Text colors of this hue that pass WCAG `level` on `reference`. */
function ContrastOverlay({
  color,
  axes,
  isDragging,
  quality,
  reference,
  level,
}: PlaneOverlayProps & { reference: Color; level: Level }) {
  const region = useContrastRegion(
    { color, axes },
    { reference, level, isDragging, quality },
  );
  return (
    <>
      <path d={region.fillPath} fill="#fff" fillOpacity={0.24} />
      <path
        d={region.path}
        fill="none"
        stroke="#fff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex items-center gap-2 border-0 p-0 text-[13px]">
      <legend className="float-left mr-1 p-0 text-muted-foreground">
        {label}
      </legend>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

export default function ContrastRegionExample() {
  const [background, setBackground] = useState<Background>('white');
  const [level, setLevel] = useState<Level>('AA');
  const { requested, displayed, setRequested } = useColor({
    defaultColor: 'oklch(0.5 0.16 150)',
  });
  return (
    <div className="grid max-w-96 gap-3">
      <PlanePicker
        color={requested}
        displayed={displayed}
        onChange={setRequested}
        label="Text color lightness and chroma"
        axes={AXES}
        className="aspect-[4/3] w-full rounded-md"
      >
        {(plane) => (
          <ContrastOverlay
            {...plane}
            reference={BACKGROUNDS[background]}
            level={level}
          />
        )}
      </PlanePicker>
      <Choice
        label="Background"
        options={['white', 'black'] as const}
        value={background}
        onChange={setBackground}
      />
      <Choice
        label="Level"
        options={['AA', 'AAA'] as const}
        value={level}
        onChange={setLevel}
      />
    </div>
  );
}
