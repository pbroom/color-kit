import { useState } from 'react';
import type { PrimitiveDensity } from '@color-kit/control-kit';
import { Separator } from '@/components/ui/separator';
import {
  TextConfigField,
  ToggleField,
} from '../components/panel/config-fields.js';
import { PanelSection } from '../components/panel/panel-section.js';
import { SegmentedField } from '../components/panel/segmented-field.js';
import { ToggleButtonPlaygroundStage } from '../components/playgrounds/toggle-button.js';
import type {
  ToggleButtonContent,
  ToggleButtonInteractionState,
  ToggleButtonSelectionState,
} from '../types.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useToggleButtonLabPageController() {
  const [selectionState, setSelectionState] =
    useState<ToggleButtonSelectionState>('off');
  const [interactionState, setInteractionState] =
    useState<ToggleButtonInteractionState>('default');
  const [disabled, setDisabled] = useState(false);
  const [density, setDensity] = useState<PrimitiveDensity>('compact');
  const [content, setContent] = useState<ToggleButtonContent>('iconOnly');
  const [label, setLabel] = useState('Favorite');

  return {
    content,
    density,
    disabled,
    interactionState,
    label,
    selectionState,
    setContent,
    setDensity,
    setDisabled,
    setInteractionState,
    setLabel,
    setSelectionState,
  };
}

type ToggleButtonLabPageController = ReturnType<
  typeof useToggleButtonLabPageController
>;

function renderToggleButtonPreview(controller: ToggleButtonLabPageController) {
  return (
    <ToggleButtonPlaygroundStage
      selected={controller.selectionState === 'on'}
      interactionState={controller.interactionState}
      disabled={controller.disabled}
      density={controller.density}
      content={controller.content}
      label={controller.label}
      onSelectedChange={(selected) =>
        controller.setSelectionState(selected ? 'on' : 'off')
      }
    />
  );
}

function renderToggleButtonProperties(
  controller: ToggleButtonLabPageController,
) {
  return (
    <>
      <PanelSection
        title="Button"
        description="Preview selection separately from interaction feedback."
      >
        <div className="space-y-3">
          <SegmentedField
            label="Selected"
            value={controller.selectionState}
            onChange={controller.setSelectionState}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
          />
          <SegmentedField
            label="Interaction"
            value={controller.interactionState}
            onChange={controller.setInteractionState}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'hovered', label: 'Hover' },
              {
                value: 'pressedDown',
                label: 'Down',
                tooltip: 'Interaction: pressed down',
              },
            ]}
          />
          <ToggleField
            label="Disabled"
            checked={controller.disabled}
            onChange={controller.setDisabled}
          />
          <SegmentedField
            label="Density"
            value={controller.density}
            onChange={controller.setDensity}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfort' },
            ]}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection title="Content">
        <div className="space-y-3">
          <SegmentedField
            label="Content"
            value={controller.content}
            onChange={controller.setContent}
            options={[
              { value: 'iconOnly', label: 'Icon' },
              { value: 'iconLabel', label: 'Icon + label' },
              { value: 'label', label: 'Label' },
            ]}
          />
          <TextConfigField
            label="Label"
            value={controller.label}
            onChange={controller.setLabel}
            maxLength={18}
          />
        </div>
      </PanelSection>
    </>
  );
}

export const toggleButtonLabPage: LabPageDescriptor<
  'toggleButton',
  ToggleButtonLabPageController
> = {
  key: 'toggleButton',
  label: 'Toggle Button',
  useController: useToggleButtonLabPageController,
  renderPreview: renderToggleButtonPreview,
  renderProperties: renderToggleButtonProperties,
};

export type { ToggleButtonLabPageController };

export const ToggleButtonLabActivePage =
  createActiveLabPage(toggleButtonLabPage);
