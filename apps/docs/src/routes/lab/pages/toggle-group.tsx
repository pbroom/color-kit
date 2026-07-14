import { useState } from 'react';
import { PanelSection } from '../components/panel/panel-section.js';
import { SegmentedField } from '../components/panel/segmented-field.js';
import { ToggleGroupPlaygroundStage } from '../components/playgrounds/toggle-group.js';
import type { ToggleGroupIconMode } from '../types.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useToggleGroupLabPageController() {
  const [value, setValue] = useState('plane');
  const [iconMode, setIconMode] = useState<ToggleGroupIconMode>('none');

  return {
    iconMode,
    setIconMode,
    setValue,
    value,
  };
}

type ToggleGroupLabPageController = ReturnType<
  typeof useToggleGroupLabPageController
>;

function renderToggleGroupPreview(controller: ToggleGroupLabPageController) {
  return (
    <ToggleGroupPlaygroundStage
      value={controller.value}
      onValueChange={controller.setValue}
      iconMode={controller.iconMode}
    />
  );
}

function renderToggleGroupProperties(controller: ToggleGroupLabPageController) {
  return (
    <PanelSection
      title="Icon"
      description="Preview the toggle group icon layout."
    >
      <div className="space-y-3">
        <SegmentedField
          label="Icon"
          value={controller.iconMode}
          onChange={controller.setIconMode}
          options={[
            { value: 'none', label: 'None' },
            { value: 'leading', label: 'Leading' },
            { value: 'trailing', label: 'Trailing' },
            { value: 'iconOnly', label: 'No text' },
          ]}
        />
      </div>
    </PanelSection>
  );
}

export const toggleGroupLabPage: LabPageDescriptor<
  'toggle',
  ToggleGroupLabPageController
> = {
  key: 'toggle',
  label: 'Toggle Group',
  useController: useToggleGroupLabPageController,
  renderPreview: renderToggleGroupPreview,
  renderProperties: renderToggleGroupProperties,
};

export type { ToggleGroupLabPageController };

export const ToggleGroupLabActivePage = createActiveLabPage(toggleGroupLabPage);
