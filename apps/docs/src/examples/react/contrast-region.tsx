import { useId, useState } from 'react';
import { parse } from 'color-kit';
import {
  Color,
  ColorArea,
  ColorPlane,
  ContrastRegionFill,
  ContrastRegionLayer,
  Thumb,
} from 'color-kit/react';

const BACKGROUNDS = { white: parse('#ffffff'), black: parse('#000000') };
type Background = keyof typeof BACKGROUNDS;
type Level = 'AA' | 'AAA';

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
        <label key={option} className="flex items-center gap-1">
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
  return (
    <Color defaultColor="oklch(0.5 0.16 150)">
      <div className="grid max-w-96 gap-3">
        {/* Text colors of this hue that pass WCAG `level` on `background`. */}
        <ColorArea
          axes={{ x: { channel: 'l' }, y: { channel: 'c', range: [0, 0.3] } }}
          className="aspect-[4/3] w-full touch-none overflow-hidden rounded-md"
        >
          <ColorPlane />
          <ContrastRegionLayer
            reference={BACKGROUNDS[background]}
            level={level}
            pathProps={{
              stroke: '#fff',
              strokeWidth: 1.5,
              vectorEffect: 'non-scaling-stroke',
            }}
          >
            {/* White dots read on both dark and light passing colors. */}
            <ContrastRegionFill fillOpacity={0} dotOpacity={0.55} />
          </ContrastRegionLayer>
          <Thumb
            aria-label="Text color lightness and chroma"
            className="size-4 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.45)]"
          />
        </ColorArea>
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
    </Color>
  );
}
