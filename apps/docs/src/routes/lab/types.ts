import type { ReactNode } from 'react';

export type LabPageKey =
  | 'plane'
  | 'input'
  | 'inputMulti'
  | 'checkbox'
  | 'slider'
  | 'tooltip'
  | 'menu'
  | 'select'
  | 'toggleButton'
  | 'toggle';

export type OutputGamut = 'display-p3' | 'srgb';
export type PrimitiveHandleContent = 'none' | 'letter' | 'icon' | 'swatch';
export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
export type PlacementSide = TooltipSide;
export type PlacementAlign = 'start' | 'center' | 'end';
export type ToggleButtonSelectionState = 'off' | 'on';
export type ToggleButtonInteractionState =
  | 'default'
  | 'hovered'
  | 'pressedDown';
export type ToggleButtonContent = 'iconOnly' | 'iconLabel' | 'label';
export type ToggleGroupIconMode = 'none' | 'leading' | 'trailing' | 'iconOnly';
export type SelectTriggerContent = 'icon' | 'iconText' | 'text';
export type SelectTriggerIconTextPlacement = 'leading' | 'trailing' | 'both';
export type SelectTriggerBehavior = 'press' | 'release';
export type SliderOrientation = 'horizontal' | 'vertical';
export type SliderMarkerMode = 'auto' | 'off';

export type LabPageNavigationItem = {
  value: LabPageKey;
  label: string;
};

export type LabPanelTooltipProviderProps = {
  delayDuration: number;
  skipDelayDuration: number;
};

export type LabPageDescriptor<TKey extends LabPageKey, TController> = {
  key: TKey;
  label: string;
  useController: () => TController;
  renderPreview: (controller: TController) => ReactNode;
  renderProperties: (controller: TController) => ReactNode;
};
