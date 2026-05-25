import { useCallback, useMemo, useState } from 'react';
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

export interface MultiInputSegmentModel<
  TFieldId extends MultiInputFieldId = string,
> extends Omit<MultiInputField<TFieldId>, 'value'> {
  id: TFieldId;
  value: number;
  config: MultiInputSegmentConfig;
}

export interface CreateMultiInputSegmentsOptions<
  TFieldId extends MultiInputFieldId,
> {
  fields: Array<MultiInputField<TFieldId>>;
  values: MultiInputValues<TFieldId>;
  config: MultiInputConfig<TFieldId>;
}

export function createMultiInputSegments<TFieldId extends MultiInputFieldId>({
  fields,
  values,
  config,
}: CreateMultiInputSegmentsOptions<TFieldId>): Array<
  MultiInputSegmentModel<TFieldId>
> {
  return fields.map((field) => {
    const segmentValue = values[field.value];
    const segmentConfig = config[field.value];

    if (segmentValue === undefined) {
      throw new Error(`Missing multi-input value for field "${field.value}".`);
    }
    if (segmentConfig === undefined) {
      throw new Error(`Missing multi-input config for field "${field.value}".`);
    }

    return {
      id: field.value,
      label: field.label,
      tooltip: field.tooltip,
      unit: field.unit,
      weight: field.weight,
      displayScale: field.displayScale,
      value: segmentValue,
      config: segmentConfig,
    };
  });
}

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
  const handleElement = hasTrailingUnit ? field.unit : leadingElement;
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
            handleElement={handleElement}
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

interface MultiInputControlSharedProps<TFieldId extends MultiInputFieldId> {
  onFieldChange: (field: TFieldId, value: number) => void;
  parseExpression?: PrimitiveExpressionParser;
  showLeadingLabels?: boolean;
}

type MultiInputControlMappedProps<TFieldId extends MultiInputFieldId> = {
  values: MultiInputValues<TFieldId>;
  config: MultiInputConfig<TFieldId>;
  fields: Array<MultiInputField<TFieldId>>;
};

type MultiInputControlSegmentProps<TFieldId extends MultiInputFieldId> = {
  segments: Array<MultiInputSegmentModel<TFieldId>>;
};

export type MultiInputControlProps<TFieldId extends MultiInputFieldId> =
  MultiInputControlSharedProps<TFieldId> &
    (
      | MultiInputControlMappedProps<TFieldId>
      | MultiInputControlSegmentProps<TFieldId>
    );

export function MultiInputControl<TFieldId extends MultiInputFieldId>(
  props: MultiInputControlProps<TFieldId>,
) {
  const { onFieldChange, parseExpression, showLeadingLabels = false } = props;
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [scrubbingField, setScrubbingField] = useState<TFieldId | null>(null);
  const fields = 'fields' in props ? props.fields : undefined;
  const values = 'fields' in props ? props.values : undefined;
  const config = 'fields' in props ? props.config : undefined;
  const segmentModels = 'segments' in props ? props.segments : undefined;
  const segments = useMemo(
    () =>
      fields && values && config
        ? createMultiInputSegments({ fields, values, config })
        : (segmentModels ?? []),
    [config, fields, segmentModels, values],
  );
  const renderedSegments = useMemo(
    () =>
      segments.map((segment) => ({
        segment,
        field: {
          value: segment.id,
          label: segment.label,
          tooltip: segment.tooltip,
          unit: segment.unit,
          weight: segment.weight,
          displayScale: segment.displayScale,
        },
      })),
    [segments],
  );

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
          {renderedSegments.map(({ segment, field }) => {
            return (
              <div
                key={segment.id}
                data-multi-input-segment=""
                className={`min-w-0 max-w-full ${segment.weight ?? 'flex-1'}`}
              >
                <MultiInputSegment
                  field={field}
                  config={segment.config}
                  value={segment.value}
                  onValueChange={(nextValue) =>
                    onFieldChange(segment.id, nextValue)
                  }
                  onScrubbingChange={handleSegmentScrubbingChange}
                  parseExpression={parseExpression}
                  showLeadingLabel={showLeadingLabels}
                />
              </div>
            );
          })}
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
