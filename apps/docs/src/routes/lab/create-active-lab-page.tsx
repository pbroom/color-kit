import { type ComponentType } from 'react';
import type { LabPageDescriptor, LabPageKey } from './types.js';
import type { LabPageRuntimeOutput } from './lab-page-runtime.js';
import {
  LabPanelTooltipPropsSlot,
  LabPreviewSlot,
  LabPropertiesSlot,
} from './lab-page-slots.js';

type ActiveLabPageProps = {
  isActive?: boolean;
};

export function createActiveLabPage<TKey extends LabPageKey, TController>(
  descriptor: LabPageDescriptor<TKey, TController>,
  getExtras?: (controller: TController) => Partial<LabPageRuntimeOutput>,
): ComponentType<ActiveLabPageProps> {
  return function ActiveLabPage({ isActive = true }: ActiveLabPageProps) {
    const controller = descriptor.useController();
    const extras = getExtras?.(controller);

    return (
      <>
        <LabPreviewSlot enabled={isActive}>
          {descriptor.renderPreview(controller)}
        </LabPreviewSlot>
        <LabPropertiesSlot enabled={isActive}>
          {descriptor.renderProperties(controller)}
        </LabPropertiesSlot>
        {extras?.panelTooltipProviderProps ? (
          <LabPanelTooltipPropsSlot
            enabled={isActive}
            panelTooltipProviderProps={extras.panelTooltipProviderProps}
          />
        ) : null}
      </>
    );
  };
}
