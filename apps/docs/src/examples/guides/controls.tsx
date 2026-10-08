/**
 * Plain form controls shared by the concept and guide examples. They hold no
 * color logic, so each example's source stays about color-kit.
 */
import { useId, type ReactNode } from 'react';

export function Range({
  label,
  value,
  min,
  max,
  step,
  format = (v) => String(v),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[7ch_1fr_8ch] items-center gap-3 text-[13px]">
      <label htmlFor={id} className="text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${label} ${format(value)}`}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full accent-foreground"
      />
      <output
        htmlFor={id}
        className="tnum text-right [font-family:var(--font-mono)]"
      >
        {format(value)}
      </output>
    </div>
  );
}

export function Toggle<T extends string>({
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
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 text-[13px]"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className="rounded-sm border border-border px-2 py-0.5 [font-family:var(--font-mono)] text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** A square painted with any CSS color string. */
export function Chip({ css, label }: { css: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block size-8 shrink-0 rounded-sm border border-border"
      style={{ background: css }}
    />
  );
}

/** A two-column list of labelled values. */
export function Readout({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[13px]">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="tnum m-0 [font-family:var(--font-mono)] break-all text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
