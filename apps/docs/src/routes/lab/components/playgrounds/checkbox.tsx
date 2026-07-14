import { Checkbox } from '@color-kit/control-kit';

export function CheckboxPlaygroundStage({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="w-[160px] min-w-0 max-w-full">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      >
        {label.trim() || 'Checkbox'}
      </Checkbox>
    </div>
  );
}
