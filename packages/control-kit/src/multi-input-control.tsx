import { useCallback, useState } from 'react';
import {
  PrimitiveValueInput,
  type PrimitiveExpressionParser,
  type PrimitivePrecision,
  type PrimitiveWrapMode,
} from './primitive-value-input.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip.js';

export type MultiInputFieldId = string;

export interface MultiInputField<TFieldId extends MultiInputFieldId = string> {
  value: TFieldId;
  label: string;
  tooltip: string;
  unit?: string;
  weight?: string;
  displayScale?: number;
}

export interface MultiInputSegmentConfig {
  min: number;
  max: number;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: PrimitivePrecision;
  autoTrim: boolean;
  wrapMode: PrimitiveWrapMode;
  disabled: boolean;
}

export type MultiInputConfig<TFieldId extends MultiInputFieldId = string> =
  Record<TFieldId, MultiInputSegmentConfig>;

export type MultiInputValues<TFieldId extends MultiInputFieldId = string> =
  Record<TFieldId, number>;

interface MultiInputSegmentProps<TFieldId extends MultiInputFieldId> {
  field: MultiInputField<TFieldId>;
  config: MultiInputSegmentConfig;
  value: number;
  onValueChange: (value: number) => void;
  onScrubbingChange: (field: TFieldId, isScrubbing: boolean) => void;
  parseExpression?: PrimitiveExpressionParser;
  showLeadingLabel?: boolean;
}

export function MultiInputSegment<TFieldId extends MultiInputFieldId>({
  field,
  config,
  value,
  onValueChange,
  onScrubbingChange,
  parseExpression,
  showLeadingLabel = false,
}: MultiInputSegmentProps<TFieldId>) {
  const displayScale = field.displayScale ?? (field.unit === '%' ? 100 : 1);
  const hasTrailingUnit = Boolean(field.unit);
  const leadingElement = showLeadingLabel ? field.label : null;
  const handleScrubbingChange = useCallback(
    (isScrubbing: boolean) => {
      onScrubbingChange(field.value, isScrubbing);
    },
    [field.value, onScrubbingChange],
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="block h-6 min-w-0 w-full">
          <PrimitiveValueInput
            value={value * displayScale}
            onValueChange={(nextValue) =>
              onValueChange(nextValue / displayScale)
            }
            ariaLabel={field.tooltip}
            leadingElement={leadingElement}
            trailingElement={hasTrailingUnit ? field.unit : null}
            handleSide={hasTrailingUnit ? 'trailing' : 'leading'}
            handleContentWidth={showLeadingLabel ? 18 : 16}
            min={config.min * displayScale}
            max={config.max * displayScale}
            wrapMode={config.wrapMode}
            step={config.step * displayScale}
            fineStep={config.fineStep * displayScale}
            coarseStep={config.coarseStep * displayScale}
            pageStep={config.pageStep * displayScale}
            precision={config.precision}
            autoTrim={config.autoTrim}
            allowExpressions
            parseExpression={parseExpression}
            selectAllOnFocus
            commitOnBlur
            scrubEnabled
            scrubPixelsPerStep={1}
            scrubThreshold={1}
            pointerLockEnabled={false}
            disabled={config.disabled}
            readOnly={false}
            visualState="auto"
            visualTreatment="embedded"
            onScrubbingChange={handleScrubbingChange}
            size="full"
            density="compact"
          />
        </label>
      </TooltipTrigger>
      <TooltipContent side="bottom">{field.tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface MultiInputControlProps<TFieldId extends MultiInputFieldId> {
  values: MultiInputValues<TFieldId>;
  config: MultiInputConfig<TFieldId>;
  onFieldChange: (field: TFieldId, value: number) => void;
  fields: Array<MultiInputField<TFieldId>>;
  parseExpression?: PrimitiveExpressionParser;
  showLeadingLabels?: boolean;
}

export function MultiInputControl<TFieldId extends MultiInputFieldId>({
  values,
  config,
  onFieldChange,
  fields,
  parseExpression,
  showLeadingLabels = false,
}: MultiInputControlProps<TFieldId>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [scrubbingField, setScrubbingField] = useState<TFieldId | null>(null);

  const handleSegmentScrubbingChange = useCallback(
    (field: TFieldId, isScrubbing: boolean) => {
      setScrubbingField((currentField) => {
        if (isScrubbing) {
          return field;
        }
        return currentField === field ? null : currentField;
      });
    },
    [],
  );
  const borderColor = scrubbingField
    ? '#97c1ef'
    : isFocused
      ? '#5288db'
      : isHovered
        ? '#4C4C4C'
        : 'transparent';

  return (
    <TooltipProvider delayDuration={1000} skipDelayDuration={300}>
      <div
        className="relative h-6 min-h-6 w-full min-w-0 max-w-full overflow-hidden rounded-[4px]"
        data-scrubbing={Boolean(scrubbingField) || undefined}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (
            nextTarget instanceof Node &&
            event.currentTarget.contains(nextTarget)
          ) {
            return;
          }
          setIsFocused(false);
        }}
      >
        <div className="flex h-full w-full min-w-0 max-w-full gap-px bg-transparent">
          {fields.map((field) => (
            <div
              key={field.value}
              data-multi-input-segment=""
              className={`min-w-0 max-w-full ${field.weight ?? 'flex-1'}`}
            >
              <MultiInputSegment
                field={field}
                config={config[field.value]}
                value={values[field.value]}
                onValueChange={(nextValue) =>
                  onFieldChange(field.value, nextValue)
                }
                onScrubbingChange={handleSegmentScrubbingChange}
                parseExpression={parseExpression}
                showLeadingLabel={showLeadingLabels}
              />
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[4px] border"
          style={{ borderColor }}
        />
      </div>
    </TooltipProvider>
  );
}
