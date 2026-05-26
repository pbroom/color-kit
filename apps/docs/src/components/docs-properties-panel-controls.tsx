import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedOptions<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SegmentedOption<T>>;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      className="docs-segmented w-full justify-start"
      aria-label={label}
      onValueChange={(next) => {
        if (next) {
          onChange(next as T);
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={`${label}: ${option.label}`}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
