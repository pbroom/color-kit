import { useCallback, useState } from 'react';
import {
  ArrowBigUp,
  ArrowLeftToLine,
  ArrowRightToLine,
  Braces,
  Diff,
  Infinity as InfinityIcon,
  Option,
  RotateCw,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  BoundsConfigInput,
  PrecisionConfigInput,
  StepConfigInput,
  ToggleField,
} from '../components/panel/config-fields.js';
import {
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
} from '../components/panel/panel-section.js';
import { SegmentedField } from '../components/panel/segmented-field.js';
import { MultiInputPlaygroundStage } from '../components/playgrounds/multi-input.js';
import {
  DEFAULT_MULTI_INPUT_CONFIG,
  MULTI_INPUT_FIELD_BY_ID,
  MULTI_INPUT_FIELDS,
  type MultiInputConfig,
  type MultiInputFieldId,
} from '../fixtures/multi-input-fields.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useInputMultiLabPageController() {
  const [values, setValues] = useState<Record<MultiInputFieldId, number>>({
    l: 0.64,
    c: 0.24,
    h: 28,
    a: 1,
  });
  const [activeField, setActiveField] = useState<MultiInputFieldId>('l');
  const [config, setConfig] = useState<MultiInputConfig>(
    DEFAULT_MULTI_INPUT_CONFIG,
  );

  const setFieldValue = useCallback(
    (field: MultiInputFieldId, value: number) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );
  const setFieldConfig = useCallback(
    <K extends keyof MultiInputConfig[MultiInputFieldId]>(
      field: MultiInputFieldId,
      key: K,
      value: MultiInputConfig[MultiInputFieldId][K],
    ) => {
      setConfig((current) => {
        const fieldConfig = current[field];
        const nextFieldConfig = {
          ...fieldConfig,
          [key]: value,
        };

        if (key === 'min') {
          nextFieldConfig.min = Math.min(Number(value), fieldConfig.max);
        } else if (key === 'max') {
          nextFieldConfig.max = Math.max(Number(value), fieldConfig.min);
        }

        return {
          ...current,
          [field]: nextFieldConfig,
        };
      });
    },
    [],
  );
  const activeConfig = config[activeField];
  const activeFieldDefinition = MULTI_INPUT_FIELD_BY_ID[activeField];
  const activeDisplayScale = activeFieldDefinition.unit === '%' ? 100 : 1;

  return {
    activeConfig,
    activeDisplayScale,
    activeField,
    activeFieldDefinition,
    config,
    setActiveField,
    setFieldConfig,
    setFieldValue,
    values,
  };
}

type InputMultiLabPageController = ReturnType<
  typeof useInputMultiLabPageController
>;

function renderInputMultiPreview(controller: InputMultiLabPageController) {
  return (
    <MultiInputPlaygroundStage
      values={controller.values}
      config={controller.config}
      onFieldChange={controller.setFieldValue}
    />
  );
}

function renderInputMultiProperties(controller: InputMultiLabPageController) {
  return (
    <>
      <PanelSection
        title="Input Multi"
        description="Configure the selected color channel input."
      >
        <div className="space-y-4">
          <SegmentedField
            label="Segment"
            value={controller.activeField}
            onChange={controller.setActiveField}
            options={MULTI_INPUT_FIELDS.map((field) => ({
              value: field.value,
              label: field.label,
              tooltip: field.tooltip,
            }))}
          />
          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
            <BoundsConfigInput
              label="Min"
              value={
                controller.activeConfig.min * controller.activeDisplayScale
              }
              onValueChange={(nextValue) =>
                controller.setFieldConfig(
                  controller.activeField,
                  'min',
                  nextValue / controller.activeDisplayScale,
                )
              }
              leadingElement={
                <ArrowLeftToLine
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={1.75}
                />
              }
              step={
                controller.activeFieldDefinition.step *
                controller.activeDisplayScale
              }
              fineStep={
                controller.activeFieldDefinition.fineStep *
                controller.activeDisplayScale
              }
              coarseStep={
                controller.activeFieldDefinition.coarseStep *
                controller.activeDisplayScale
              }
              pageStep={
                controller.activeFieldDefinition.pageStep *
                controller.activeDisplayScale
              }
              precision={controller.activeConfig.precision}
            />
            <BoundsConfigInput
              label="Max"
              value={
                controller.activeConfig.max * controller.activeDisplayScale
              }
              onValueChange={(nextValue) =>
                controller.setFieldConfig(
                  controller.activeField,
                  'max',
                  nextValue / controller.activeDisplayScale,
                )
              }
              leadingElement={
                <ArrowRightToLine
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={1.75}
                />
              }
              step={
                controller.activeFieldDefinition.step *
                controller.activeDisplayScale
              }
              fineStep={
                controller.activeFieldDefinition.fineStep *
                controller.activeDisplayScale
              }
              coarseStep={
                controller.activeFieldDefinition.coarseStep *
                controller.activeDisplayScale
              }
              pageStep={
                controller.activeFieldDefinition.pageStep *
                controller.activeDisplayScale
              }
              precision={controller.activeConfig.precision}
            />
          </div>
          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
            <PrecisionConfigInput
              value={controller.activeConfig.precision}
              onChange={(nextValue) =>
                controller.setFieldConfig(
                  controller.activeField,
                  'precision',
                  nextValue,
                )
              }
            />
            <SegmentedField
              label="Bounds"
              value={controller.activeConfig.wrapMode}
              onChange={(nextValue) =>
                controller.setFieldConfig(
                  controller.activeField,
                  'wrapMode',
                  nextValue,
                )
              }
              controlClassName="translate-y-px"
              options={[
                {
                  value: 'clamp',
                  label: 'Clamp',
                  icon: (
                    <Braces
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  ),
                  tooltip: 'Clamp values',
                },
                {
                  value: 'wrap',
                  label: 'Wrap',
                  icon: (
                    <RotateCw
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  ),
                  tooltip: 'Wrap values',
                },
                {
                  value: 'free',
                  label: 'Free',
                  icon: (
                    <InfinityIcon
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  ),
                  tooltip: 'Unbounded values',
                },
              ]}
            />
          </div>
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection title="Stepping">
        <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
          <StepConfigInput
            label="Step"
            value={controller.activeConfig.step * controller.activeDisplayScale}
            onValueChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'step',
                nextValue / controller.activeDisplayScale,
              )
            }
            leadingElement={
              <Diff aria-hidden="true" className="size-3" strokeWidth={1.75} />
            }
            step={0.1}
          />
          <StepConfigInput
            label="Fine"
            value={
              controller.activeConfig.fineStep * controller.activeDisplayScale
            }
            onValueChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'fineStep',
                nextValue / controller.activeDisplayScale,
              )
            }
            leadingElement={
              <Option
                aria-hidden="true"
                className="size-3"
                strokeWidth={1.75}
              />
            }
            step={0.1}
          />
          <StepConfigInput
            label="Coarse"
            value={
              controller.activeConfig.coarseStep * controller.activeDisplayScale
            }
            onValueChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'coarseStep',
                nextValue / controller.activeDisplayScale,
              )
            }
            leadingElement={
              <ArrowBigUp
                aria-hidden="true"
                className="size-3"
                strokeWidth={1.75}
              />
            }
            step={1}
          />
          <StepConfigInput
            label="Page"
            value={
              controller.activeConfig.pageStep * controller.activeDisplayScale
            }
            onValueChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'pageStep',
                nextValue / controller.activeDisplayScale,
              )
            }
            leadingElement={
              <ArrowRightToLine
                aria-hidden="true"
                className="size-3"
                strokeWidth={1.75}
              />
            }
            step={1}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection title="Behavior">
        <div className="space-y-3">
          <ToggleField
            label="Trim trailing zeros"
            checked={controller.activeConfig.autoTrim}
            onChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'autoTrim',
                nextValue,
              )
            }
          />
          <ToggleField
            label="Disabled"
            checked={controller.activeConfig.disabled}
            onChange={(nextValue) =>
              controller.setFieldConfig(
                controller.activeField,
                'disabled',
                nextValue,
              )
            }
          />
        </div>
      </PanelSection>
    </>
  );
}

export const inputMultiLabPage: LabPageDescriptor<
  'inputMulti',
  InputMultiLabPageController
> = {
  key: 'inputMulti',
  label: 'Input Multi',
  useController: useInputMultiLabPageController,
  renderPreview: renderInputMultiPreview,
  renderProperties: renderInputMultiProperties,
};

export type { InputMultiLabPageController };

export const InputMultiLabActivePage = createActiveLabPage(inputMultiLabPage);
