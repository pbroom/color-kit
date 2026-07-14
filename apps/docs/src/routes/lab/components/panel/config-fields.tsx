import {
  Checkbox,
  MultiInputControl,
  PrimitiveValueInput,
  normalizePrimitivePrecision,
  type PrimitivePrecision,
} from '@color-kit/control-kit';
import { DecimalsArrowRight, Radius } from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import { parsePrimitiveExpression } from '../../color/parse-expression.js';
import {
  PRIMITIVE_SCRUB_CONFIG,
  PRIMITIVE_SCRUB_FIELDS,
  type PrimitiveScrubFieldId,
} from '../../fixtures/multi-input-fields.js';
import { PropertyFieldTooltip } from './panel-section.js';

const MAX_PRIMITIVE_PRECISION_DIGITS = 12;

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox checked={checked} onCheckedChange={onChange}>
      {label}
    </Checkbox>
  );
}

export function NumberConfigField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 5000,
  precision = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onChange(Math.min(max, Math.max(min, nextValue)))
          }
          ariaLabel={label}
          leadingElement={null}
          min={min}
          max={max}
          wrapMode="clamp"
          step={step}
          fineStep={step / 10}
          coarseStep={step * 10}
          pageStep={step * 10}
          precision={precision}
          autoTrim
          allowExpressions
          parseExpression={parsePrimitiveExpression}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

export function TextConfigField({
  label,
  value,
  onChange,
  maxLength,
  showLabel = true,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showLabel?: boolean;
  placeholder?: string;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label
        className={`block w-full min-w-0 max-w-full ${showLabel ? 'space-y-2' : ''}`}
      >
        <span
          className={
            showLabel
              ? 'block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45'
              : 'sr-only'
          }
        >
          {label}
        </span>
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={showLabel ? undefined : (placeholder ?? label)}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-full min-w-0 max-w-full rounded-[4px] border border-transparent bg-[#383838] px-2 text-[11px] font-medium text-white outline-none transition-[border-color] placeholder:text-white/35 hover:border-[#4C4C4C] focus:border-[#5288db]"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

export function PrecisionConfigInput({
  value,
  onChange,
}: {
  value: PrimitivePrecision;
  onChange: (value: PrimitivePrecision) => void;
}) {
  return (
    <PropertyFieldTooltip label="Precision">
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Precision
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onChange(normalizePrimitivePrecision(nextValue))
          }
          ariaLabel="Precision"
          leadingElement={
            <DecimalsArrowRight
              aria-hidden="true"
              className="size-3"
              strokeWidth={1.75}
            />
          }
          min={0}
          max={MAX_PRIMITIVE_PRECISION_DIGITS}
          wrapMode="clamp"
          step={1}
          fineStep={1}
          coarseStep={2}
          pageStep={3}
          precision={0}
          autoTrim
          allowExpressions={false}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

export function StepConfigInput({
  label,
  value,
  onValueChange,
  leadingElement,
  step,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
  step: number;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingElement={leadingElement}
          min={0}
          max={1000}
          wrapMode="free"
          step={step}
          fineStep={step / 10}
          coarseStep={step * 10}
          pageStep={step * 10}
          precision={6}
          autoTrim
          allowExpressions
          parseExpression={parsePrimitiveExpression}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

export function DragStepConfigInput({
  dragStep,
  stepDragDistance,
  onDragStepChange,
  onStepDragDistanceChange,
}: {
  dragStep: number;
  stepDragDistance: number;
  onDragStepChange: (value: number) => void;
  onStepDragDistanceChange: (value: number) => void;
}) {
  const values = useMemo<Record<PrimitiveScrubFieldId, number>>(
    () => ({
      dragStep,
      stepDragDistance,
    }),
    [dragStep, stepDragDistance],
  );
  const handleFieldChange = useCallback(
    (field: PrimitiveScrubFieldId, nextValue: number) => {
      if (field === 'dragStep') {
        onDragStepChange(nextValue);
        return;
      }

      const normalized = Number.isFinite(nextValue)
        ? Math.min(1000, Math.max(0.01, Number(nextValue.toFixed(4))))
        : 1;
      onStepDragDistanceChange(normalized);
    },
    [onDragStepChange, onStepDragDistanceChange],
  );

  return (
    <div className="w-full min-w-0 max-w-full">
      <MultiInputControl
        values={values}
        config={PRIMITIVE_SCRUB_CONFIG}
        fields={PRIMITIVE_SCRUB_FIELDS}
        onFieldChange={handleFieldChange}
        parseExpression={parsePrimitiveExpression}
        showLeadingLabels
      />
    </div>
  );
}

export function BoundsConfigInput({
  label,
  value,
  onValueChange,
  leadingElement,
  step = 1,
  fineStep = 0.1,
  coarseStep = 10,
  pageStep = 10,
  precision = 6,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
  step?: number;
  fineStep?: number;
  coarseStep?: number;
  pageStep?: number;
  precision?: PrimitivePrecision;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingElement={leadingElement}
          min={-1000}
          max={1000}
          wrapMode="free"
          step={step}
          fineStep={fineStep}
          coarseStep={coarseStep}
          pageStep={pageStep}
          precision={precision}
          autoTrim
          allowExpressions
          parseExpression={parsePrimitiveExpression}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

export function DragThresholdConfigInput({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <PropertyFieldTooltip label="Drag threshold">
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel="Drag threshold"
          leadingElement={
            <Radius aria-hidden="true" className="size-3" strokeWidth={1.75} />
          }
          min={0}
          max={1000}
          wrapMode="clamp"
          step={1}
          fineStep={0.1}
          coarseStep={10}
          pageStep={10}
          precision={6}
          autoTrim
          allowExpressions
          parseExpression={parsePrimitiveExpression}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}
