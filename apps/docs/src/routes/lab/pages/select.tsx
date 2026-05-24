import { useState } from 'react';
import {
  PanelSection,
  PlacementGridField,
  SegmentedField,
  SelectPlaygroundStage,
  ToggleField,
  type PlacementAlign,
  type PlacementSide,
  type SelectOptionId,
  type SelectTriggerBehavior,
  type SelectTriggerContent,
  type SelectTriggerIconTextPlacement,
} from '../shared.js';
import type { LabPageDescriptor } from '../types.js';

function useSelectLabPageController() {
  const [value, setValue] = useState<SelectOptionId>('copy');
  const [disabled, setDisabled] = useState(false);
  const [side, setSide] = useState<PlacementSide>('bottom');
  const [align, setAlign] = useState<PlacementAlign>('start');
  const [triggerContent, setTriggerContent] =
    useState<SelectTriggerContent>('icon');
  const [triggerIconTextPlacement, setTriggerIconTextPlacement] =
    useState<SelectTriggerIconTextPlacement>('trailing');
  const [triggerBehavior, setTriggerBehavior] =
    useState<SelectTriggerBehavior>('press');
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showSubmenus, setShowSubmenus] = useState(true);
  const [showDividers, setShowDividers] = useState(true);
  const [showLeadingIcons, setShowLeadingIcons] = useState(true);
  const [showTrailingHints, setShowTrailingHints] = useState(true);

  return {
    align,
    disabled,
    setAlign,
    setDisabled,
    setShowDividers,
    setShowLeadingIcons,
    setShowShortcuts,
    setShowSubmenus,
    setShowTrailingHints,
    setSide,
    setTriggerBehavior,
    setTriggerContent,
    setTriggerIconTextPlacement,
    setValue,
    showDividers,
    showLeadingIcons,
    showShortcuts,
    showSubmenus,
    showTrailingHints,
    side,
    triggerBehavior,
    triggerContent,
    triggerIconTextPlacement,
    value,
  };
}

type SelectLabPageController = ReturnType<typeof useSelectLabPageController>;

function renderSelectPreview(controller: SelectLabPageController) {
  return (
    <SelectPlaygroundStage
      value={controller.value}
      onValueChange={controller.setValue}
      align={controller.align}
      disabled={controller.disabled}
      side={controller.side}
      triggerContent={controller.triggerContent}
      triggerIconTextPlacement={controller.triggerIconTextPlacement}
      triggerBehavior={controller.triggerBehavior}
      showShortcuts={controller.showShortcuts}
      showSubmenus={controller.showSubmenus}
      showDividers={controller.showDividers}
      showLeadingIcons={controller.showLeadingIcons}
      showTrailingHints={controller.showTrailingHints}
    />
  );
}

function renderSelectProperties(controller: SelectLabPageController) {
  return (
    <PanelSection
      title="Menu Select"
      description="Preview the UI3 menu trigger state."
    >
      <div className="space-y-3">
        <PlacementGridField
          label="Placement"
          side={controller.side}
          align={controller.align}
          onChange={(placement) => {
            controller.setSide(placement.side);
            controller.setAlign(placement.align);
          }}
        />
        <SegmentedField
          label="Trigger content"
          value={controller.triggerContent}
          onChange={controller.setTriggerContent}
          options={[
            { value: 'icon', label: 'Icon' },
            { value: 'iconText', label: 'Icon + text' },
            { value: 'text', label: 'Text' },
          ]}
        />
        {controller.triggerContent === 'iconText' ? (
          <SegmentedField
            label="Icon position"
            value={controller.triggerIconTextPlacement}
            onChange={controller.setTriggerIconTextPlacement}
            options={[
              { value: 'leading', label: 'Leading' },
              { value: 'trailing', label: 'Trailing' },
              { value: 'both', label: 'Both' },
            ]}
          />
        ) : null}
        <SegmentedField
          label="Trigger behavior"
          value={controller.triggerBehavior}
          onChange={controller.setTriggerBehavior}
          options={[
            { value: 'press', label: 'Press' },
            { value: 'release', label: 'Release' },
          ]}
        />
        <ToggleField
          label="Disabled trigger"
          checked={controller.disabled}
          onChange={controller.setDisabled}
        />
        <ToggleField
          label="Show leading icons"
          checked={controller.showLeadingIcons}
          onChange={controller.setShowLeadingIcons}
        />
        <ToggleField
          label="Show trailing hints"
          checked={controller.showTrailingHints}
          onChange={controller.setShowTrailingHints}
        />
        <ToggleField
          label="Show shortcuts"
          checked={controller.showShortcuts}
          onChange={controller.setShowShortcuts}
        />
        <ToggleField
          label="Show submenus"
          checked={controller.showSubmenus}
          onChange={controller.setShowSubmenus}
        />
        <ToggleField
          label="Show dividers"
          checked={controller.showDividers}
          onChange={controller.setShowDividers}
        />
      </div>
    </PanelSection>
  );
}

export const selectLabPage: LabPageDescriptor<
  'select',
  SelectLabPageController
> = {
  key: 'select',
  label: 'Select',
  useController: useSelectLabPageController,
  renderPreview: renderSelectPreview,
  renderProperties: renderSelectProperties,
};

export type { SelectLabPageController };
