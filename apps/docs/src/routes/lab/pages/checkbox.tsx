import { useState } from 'react';
import {
  CheckboxPlaygroundStage,
  PanelSection,
  TextConfigField,
  ToggleField,
} from '../shared.js';
import type { LabPageDescriptor } from '../types.js';

function useCheckboxLabPageController() {
  const [checked, setChecked] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [label, setLabel] = useState('Checkbox');

  return {
    checked,
    disabled,
    label,
    setChecked,
    setDisabled,
    setLabel,
  };
}

type CheckboxLabPageController = ReturnType<
  typeof useCheckboxLabPageController
>;

function renderCheckboxPreview(controller: CheckboxLabPageController) {
  return (
    <CheckboxPlaygroundStage
      checked={controller.checked}
      disabled={controller.disabled}
      label={controller.label}
      onCheckedChange={controller.setChecked}
    />
  );
}

function renderCheckboxProperties(controller: CheckboxLabPageController) {
  return (
    <PanelSection
      title="Checkbox"
      description="Preview the compact checkbox row used throughout the properties panel."
    >
      <div className="space-y-3">
        <ToggleField
          label="Checked"
          checked={controller.checked}
          onChange={controller.setChecked}
        />
        <ToggleField
          label="Disabled"
          checked={controller.disabled}
          onChange={controller.setDisabled}
        />
        <TextConfigField
          label="Label"
          value={controller.label}
          onChange={controller.setLabel}
          maxLength={28}
        />
      </div>
    </PanelSection>
  );
}

export const checkboxLabPage: LabPageDescriptor<
  'checkbox',
  CheckboxLabPageController
> = {
  key: 'checkbox',
  label: 'Checkbox',
  useController: useCheckboxLabPageController,
  renderPreview: renderCheckboxPreview,
  renderProperties: renderCheckboxProperties,
};

export type { CheckboxLabPageController };
