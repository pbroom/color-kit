import { useState } from 'react';
import {
  Color,
  ColorStringInput,
  useColorContext,
  type ColorStringInputFormat,
} from 'color-kit/react';

const FORMATS: ColorStringInputFormat[] = ['hex', 'rgb', 'hsl', 'oklch'];

const field =
  'grid grid-cols-[6ch_1fr] items-center gap-3 text-[13px] [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-border [&_input]:bg-transparent [&_input]:px-2 [&_input]:py-1 [&_input]:[font-family:var(--font-mono)] [&_input]:text-[13px]';

function Chip() {
  const { displayedCss } = useColorContext();
  return (
    <div
      className="h-10 rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
      style={{ background: displayedCss() }}
    />
  );
}

export default function ColorStringInputExample() {
  const [rejected, setRejected] = useState<string | null>(null);
  return (
    <Color defaultColor="#2f9e78">
      <div className="grid max-w-96 gap-3">
        <Chip />
        {/* Four views of one color: commit any CSS color in any of them. */}
        {FORMATS.map((format) => (
          <div key={format} className={field}>
            <span className="text-muted-foreground" aria-hidden="true">
              {format}
            </span>
            <ColorStringInput
              format={format}
              aria-label={`Color as ${format}`}
              onFocus={() => setRejected(null)}
              onInvalidCommit={(draft) => setRejected(draft)}
            />
          </div>
        ))}
        <p className="m-0 min-h-5 text-[13px]" role="status">
          {rejected === null ? '' : `“${rejected}” is not a color; reverted.`}
        </p>
      </div>
    </Color>
  );
}
