import type {
  MultiInputConfig as ControlMultiInputConfig,
  MultiInputField,
} from '@color-kit/control-kit';

export type MultiInputFieldId = 'l' | 'c' | 'h' | 'a';
export type MultiInputConfig = ControlMultiInputConfig<MultiInputFieldId>;
export type PrimitiveScrubFieldId = 'dragStep' | 'stepDragDistance';
export type PrimitiveScrubConfig =
  ControlMultiInputConfig<PrimitiveScrubFieldId>;

export type LabMultiInputField = MultiInputField<MultiInputFieldId> & {
  min: number;
  max: number;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: number;
};

export const MULTI_INPUT_FIELDS: Array<LabMultiInputField> = [
  {
    value: 'l',
    label: 'L',
    tooltip: 'Lightness',
    min: 0,
    max: 1,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.1,
    pageStep: 0.1,
    precision: 3,
    weight: 'flex-[0_1_44px]',
  },
  {
    value: 'c',
    label: 'C',
    tooltip: 'Chroma',
    min: 0,
    max: 0.4,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.05,
    pageStep: 0.05,
    precision: 3,
    weight: 'flex-[0_1_44px]',
  },
  {
    value: 'h',
    label: 'H',
    tooltip: 'Hue',
    min: 0,
    max: 360,
    step: 1,
    fineStep: 0.1,
    coarseStep: 15,
    pageStep: 30,
    precision: 1,
    weight: 'flex-[0_1_44px]',
  },
  {
    value: 'a',
    label: 'O',
    tooltip: 'Opacity',
    min: 0,
    max: 1,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.1,
    pageStep: 0.1,
    precision: 3,
    unit: '%',
    weight: 'flex-[1_1_65px]',
  },
];

export const COLOR_PLANE_MULTI_INPUT_FIELDS = MULTI_INPUT_FIELDS.filter(
  (field) => field.value !== 'a',
).map(({ weight: _weight, ...field }) => field);

export const DEFAULT_MULTI_INPUT_CONFIG: MultiInputConfig =
  MULTI_INPUT_FIELDS.reduce(
    (config, field) => ({
      ...config,
      [field.value]: {
        min: field.min,
        max: field.max,
        step: field.step,
        fineStep: field.fineStep,
        coarseStep: field.coarseStep,
        pageStep: field.pageStep,
        precision: field.unit === '%' ? 1 : field.precision,
        autoTrim: true,
        wrapMode: field.value === 'h' ? 'wrap' : 'clamp',
        disabled: false,
      },
    }),
    {} as MultiInputConfig,
  );

export const MULTI_INPUT_FIELD_BY_ID = MULTI_INPUT_FIELDS.reduce(
  (fields, field) => ({
    ...fields,
    [field.value]: field,
  }),
  {} as Record<MultiInputFieldId, (typeof MULTI_INPUT_FIELDS)[number]>,
);

export const PRIMITIVE_SCRUB_FIELDS: Array<
  MultiInputField<PrimitiveScrubFieldId>
> = [
  {
    value: 'dragStep',
    label: 'D',
    tooltip: 'Drag step',
  },
  {
    value: 'stepDragDistance',
    label: '',
    tooltip: 'Step drag distance',
    unit: 'px',
  },
];

export const PRIMITIVE_SCRUB_CONFIG: PrimitiveScrubConfig = {
  dragStep: {
    min: 0,
    max: 1000,
    step: 0.1,
    fineStep: 0.01,
    coarseStep: 1,
    pageStep: 1,
    precision: 6,
    autoTrim: true,
    wrapMode: 'free',
    disabled: false,
  },
  stepDragDistance: {
    min: 0.01,
    max: 1000,
    step: 0.5,
    fineStep: 0.1,
    coarseStep: 2,
    pageStep: 4,
    precision: 2,
    autoTrim: true,
    wrapMode: 'clamp',
    disabled: false,
  },
};
