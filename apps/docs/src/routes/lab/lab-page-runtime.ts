import type { ReactNode } from 'react';
import type {
  LabPageNavigationItem,
  LabPanelTooltipProviderProps,
} from './types.js';

export type { LabPageNavigationItem } from './types.js';

export type LabPageRuntimeOutput = {
  preview: ReactNode;
  properties: ReactNode;
  panelTooltipProviderProps?: LabPanelTooltipProviderProps;
};

export const DEFAULT_LAB_PANEL_TOOLTIP_PROPS: LabPanelTooltipProviderProps = {
  delayDuration: 1000,
  skipDelayDuration: 300,
};

export const LAB_PAGE_NAVIGATION: readonly LabPageNavigationItem[] = [
  { value: 'plane', label: 'ColorPlane' },
  { value: 'input', label: 'Input Primitive' },
  { value: 'inputMulti', label: 'Input Multi' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'slider', label: 'Slider' },
  { value: 'tooltip', label: 'Tooltip' },
  { value: 'menu', label: 'Menu' },
  { value: 'select', label: 'Select' },
  { value: 'toggleButton', label: 'Toggle Button' },
  { value: 'toggle', label: 'Toggle Group' },
] as const;
