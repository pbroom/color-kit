import { useMemo, useState, type ReactNode } from 'react';
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
import {
  BoundsConfigInput,
  DragStepConfigInput,
  DragThresholdConfigInput,
  DynamicLucideIcon,
  LucideIconPicker,
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
  PrecisionConfigInput,
  PrimitiveValueInput,
  PropertyFieldTooltip,
  SegmentedField,
  Separator,
  StepConfigInput,
  TextConfigField,
  ToggleField,
  parsePrimitiveExpression,
  type PrimitiveDensity,
  type PrimitiveHandleContent,
  type PrimitiveHandleSide,
  type PrimitivePrecision,
  type PrimitiveSize,
  type PrimitiveVisualState,
  type PrimitiveWrapMode,
} from '../shared.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useInputLabPageController() {
  const [value, setValue] = useState(42);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(100);
  const [wrapMode, setWrapMode] = useState<PrimitiveWrapMode>('clamp');
  const [step, setStep] = useState(1);
  const [fineStep, setFineStep] = useState(0.1);
  const [coarseStep, setCoarseStep] = useState(10);
  const pageStep = 10;
  const [precision, setPrecision] = useState<PrimitivePrecision>(3);
  const [autoTrim, setAutoTrim] = useState(true);
  const [allowExpressions, setAllowExpressions] = useState(true);
  const [selectAllOnFocus, setSelectAllOnFocus] = useState(true);
  const [commitOnBlur, setCommitOnBlur] = useState(true);
  const [horizontalArrowKeysMoveCaret, setHorizontalArrowKeysMoveCaret] =
    useState(true);
  const [scrubEnabled, setScrubEnabled] = useState(true);
  const [pointerLockEnabled, setPointerLockEnabled] = useState(true);
  const [scrubThreshold, setScrubThreshold] = useState(2);
  const [stepDragDistance, setStepDragDistance] = useState(1);
  const [handleContent, setHandleContent] =
    useState<PrimitiveHandleContent>('letter');
  const [handleSide, setHandleSide] = useState<PrimitiveHandleSide>('leading');
  const [handleLetter, setHandleLetter] = useState('V');
  const [handleLucideSlug, setHandleLucideSlug] = useState('mouse-pointer-2');
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [visualState, setVisualState] = useState<PrimitiveVisualState>('auto');
  const size: PrimitiveSize = 'sm';
  const [density, setDensity] = useState<PrimitiveDensity>('compact');
  const [placeholder, setPlaceholder] = useState('0');

  const handleElement = useMemo<ReactNode>(() => {
    switch (handleContent) {
      case 'none':
        return null;
      case 'letter':
        return handleLetter.trim().slice(0, 2);
      case 'icon':
        return (
          <DynamicLucideIcon
            slug={handleLucideSlug}
            className="size-3"
            strokeWidth={1.75}
          />
        );
      case 'swatch':
        return (
          <span
            aria-hidden="true"
            className="size-3 rounded-[3px] border border-white/20 bg-[conic-gradient(from_180deg,#ff5f6d,#ffc371,#47d16c,#4cc9f0,#845ef7,#ff5f6d)]"
          />
        );
    }
  }, [handleContent, handleLetter, handleLucideSlug]);

  return {
    allowExpressions,
    autoTrim,
    coarseStep,
    commitOnBlur,
    density,
    disabled,
    fineStep,
    handleContent,
    handleElement,
    handleLetter,
    handleLucideSlug,
    handleSide,
    horizontalArrowKeysMoveCaret,
    max,
    min,
    pageStep,
    placeholder,
    pointerLockEnabled,
    precision,
    readOnly,
    scrubEnabled,
    scrubThreshold,
    selectAllOnFocus,
    setAllowExpressions,
    setAutoTrim,
    setCoarseStep,
    setCommitOnBlur,
    setDensity,
    setDisabled,
    setFineStep,
    setHandleContent,
    setHandleLetter,
    setHandleLucideSlug,
    setHandleSide,
    setHorizontalArrowKeysMoveCaret,
    setMax,
    setMin,
    setPlaceholder,
    setPointerLockEnabled,
    setPrecision,
    setReadOnly,
    setScrubEnabled,
    setScrubThreshold,
    setSelectAllOnFocus,
    setStep,
    setStepDragDistance,
    setValue,
    setVisualState,
    setWrapMode,
    size,
    step,
    stepDragDistance,
    value,
    visualState,
    wrapMode,
  };
}

type InputLabPageController = ReturnType<typeof useInputLabPageController>;

function renderInputPreview(controller: InputLabPageController) {
  return (
    <PrimitiveValueInput
      value={controller.value}
      onValueChange={controller.setValue}
      placeholder={controller.placeholder}
      handleElement={controller.handleElement}
      handleSide={controller.handleSide}
      min={controller.min}
      max={controller.max}
      wrapMode={controller.wrapMode}
      step={controller.step}
      fineStep={controller.fineStep}
      coarseStep={controller.coarseStep}
      pageStep={controller.pageStep}
      precision={controller.precision}
      autoTrim={controller.autoTrim}
      allowExpressions={controller.allowExpressions}
      parseExpression={parsePrimitiveExpression}
      selectAllOnFocus={controller.selectAllOnFocus}
      commitOnBlur={controller.commitOnBlur}
      scrubEnabled={controller.scrubEnabled}
      stepDragDistance={controller.stepDragDistance}
      scrubThreshold={controller.scrubThreshold}
      pointerLockEnabled={controller.pointerLockEnabled}
      horizontalArrowKeysMoveCaret={controller.horizontalArrowKeysMoveCaret}
      disabled={controller.disabled}
      readOnly={controller.readOnly}
      visualState={controller.visualState}
      size={controller.size}
      density={controller.density}
    />
  );
}

function renderInputProperties(controller: InputLabPageController) {
  return (
    <>
      <PanelSection title="Input">
        <div className="w-full min-w-0 max-w-full space-y-4">
          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
            <PropertyFieldTooltip label="Value">
              <label className="block w-full min-w-0 max-w-full space-y-2">
                <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                  Value
                </span>
                <PrimitiveValueInput
                  value={controller.value}
                  onValueChange={controller.setValue}
                  ariaLabel="Value"
                  placeholder={controller.placeholder}
                  handleElement={controller.handleElement}
                  handleSide={controller.handleSide}
                  min={controller.min}
                  max={controller.max}
                  wrapMode={controller.wrapMode}
                  step={controller.step}
                  fineStep={controller.fineStep}
                  coarseStep={controller.coarseStep}
                  pageStep={controller.pageStep}
                  precision={controller.precision}
                  autoTrim={controller.autoTrim}
                  allowExpressions={controller.allowExpressions}
                  parseExpression={parsePrimitiveExpression}
                  selectAllOnFocus={controller.selectAllOnFocus}
                  commitOnBlur={controller.commitOnBlur}
                  scrubEnabled={controller.scrubEnabled}
                  stepDragDistance={controller.stepDragDistance}
                  scrubThreshold={controller.scrubThreshold}
                  pointerLockEnabled={controller.pointerLockEnabled}
                  horizontalArrowKeysMoveCaret={
                    controller.horizontalArrowKeysMoveCaret
                  }
                  disabled={controller.disabled}
                  readOnly={controller.readOnly}
                  visualState={controller.visualState}
                  size="full"
                />
              </label>
            </PropertyFieldTooltip>
            <TextConfigField
              label="Placeholder"
              value={controller.placeholder}
              onChange={controller.setPlaceholder}
              maxLength={12}
            />
          </div>
          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
            <BoundsConfigInput
              label="Min"
              value={controller.min}
              onValueChange={controller.setMin}
              leadingElement={
                <ArrowLeftToLine
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={1.75}
                />
              }
            />
            <BoundsConfigInput
              label="Max"
              value={controller.max}
              onValueChange={controller.setMax}
              leadingElement={
                <ArrowRightToLine
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={1.75}
                />
              }
            />
          </div>
          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
            <PrecisionConfigInput
              value={controller.precision}
              onChange={controller.setPrecision}
            />
            <SegmentedField
              label="Bounds"
              value={controller.wrapMode}
              onChange={controller.setWrapMode}
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

      <PanelSection
        title="Drag Handle"
        description="Choose what appears inside the scrub handle."
      >
        <div className="space-y-3">
          <SegmentedField
            label="Content"
            value={controller.handleContent}
            onChange={controller.setHandleContent}
            options={[
              { value: 'none', label: 'None' },
              { value: 'letter', label: 'Letter' },
              { value: 'icon', label: 'Icon' },
              { value: 'swatch', label: 'Swatch' },
            ]}
          />
          <SegmentedField
            label="Side"
            value={controller.handleSide}
            onChange={controller.setHandleSide}
            options={[
              { value: 'leading', label: 'Leading' },
              { value: 'trailing', label: 'Trailing' },
            ]}
          />
          {controller.handleContent === 'letter' ? (
            <TextConfigField
              label="Letter"
              value={controller.handleLetter}
              onChange={controller.setHandleLetter}
              maxLength={2}
            />
          ) : null}
          {controller.handleContent === 'icon' ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                Icon
              </p>
              <LucideIconPicker
                value={controller.handleLucideSlug}
                onChange={controller.setHandleLucideSlug}
              />
            </div>
          ) : null}
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection title="Stepping">
        <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
          <StepConfigInput
            label="Step"
            value={controller.step}
            onValueChange={controller.setStep}
            leadingElement={
              <Diff aria-hidden="true" className="size-3" strokeWidth={1.75} />
            }
            step={0.1}
          />
          <DragStepConfigInput
            dragStep={controller.step}
            stepDragDistance={controller.stepDragDistance}
            onDragStepChange={controller.setStep}
            onStepDragDistanceChange={controller.setStepDragDistance}
          />
          <StepConfigInput
            label="Fine"
            value={controller.fineStep}
            onValueChange={controller.setFineStep}
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
            value={controller.coarseStep}
            onValueChange={controller.setCoarseStep}
            leadingElement={
              <ArrowBigUp
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

      <PanelSection
        title="Behavior"
        description="Toggle text-entry affordances for the focused input."
      >
        <div className="space-y-3">
          <ToggleField
            label="Select all on focus"
            checked={controller.selectAllOnFocus}
            onChange={controller.setSelectAllOnFocus}
          />
          <ToggleField
            label="Allow expressions"
            checked={controller.allowExpressions}
            onChange={controller.setAllowExpressions}
          />
          <ToggleField
            label="Commit on blur"
            checked={controller.commitOnBlur}
            onChange={controller.setCommitOnBlur}
          />
          <ToggleField
            label="Horizontal arrows move caret"
            checked={controller.horizontalArrowKeysMoveCaret}
            onChange={controller.setHorizontalArrowKeysMoveCaret}
          />
          <ToggleField
            label="Trim trailing zeros"
            checked={controller.autoTrim}
            onChange={controller.setAutoTrim}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Scrub"
        description="Adjust how far the pointer moves per channel step."
      >
        <div className="space-y-3">
          <ToggleField
            label="Enable scrub handle"
            checked={controller.scrubEnabled}
            onChange={controller.setScrubEnabled}
          />
          <ToggleField
            label="Use pointer lock"
            checked={controller.pointerLockEnabled}
            onChange={controller.setPointerLockEnabled}
          />
          <DragThresholdConfigInput
            value={controller.scrubThreshold}
            onValueChange={controller.setScrubThreshold}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Visual State"
        description="Preview primitive sizing and state variants."
      >
        <div className="space-y-3">
          <SegmentedField
            label="Density"
            value={controller.density}
            onChange={controller.setDensity}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfort' },
            ]}
          />
          <SegmentedField
            label="Validity"
            value={controller.visualState}
            onChange={controller.setVisualState}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'valid', label: 'Valid' },
              { value: 'invalid', label: 'Invalid' },
            ]}
          />
          <ToggleField
            label="Disabled"
            checked={controller.disabled}
            onChange={controller.setDisabled}
          />
          <ToggleField
            label="Read only"
            checked={controller.readOnly}
            onChange={controller.setReadOnly}
          />
        </div>
      </PanelSection>
    </>
  );
}

export const inputLabPage: LabPageDescriptor<'input', InputLabPageController> =
  {
    key: 'input',
    label: 'Input Primitive',
    useController: useInputLabPageController,
    renderPreview: renderInputPreview,
    renderProperties: renderInputProperties,
  };

export type { InputLabPageController };

export const InputLabActivePage = createActiveLabPage(inputLabPage);
