import type { ReactNode } from 'react';
import type { LabPageKey, LabPanelTooltipProviderProps } from './shared.js';

export type LabPageDescriptor<TKey extends LabPageKey, TController> = {
  key: TKey;
  label: string;
  useController: () => TController;
  renderPreview: (controller: TController) => ReactNode;
  renderProperties: (controller: TController) => ReactNode;
};

export type RegisteredLabPageDescriptor = LabPageDescriptor<
  LabPageKey,
  unknown
>;

export type LabPageNavigationItem = {
  value: LabPageKey;
  label: string;
};

export type LabPagePanelTooltipResolver<TControllers> = (
  controllers: TControllers,
) => LabPanelTooltipProviderProps;
