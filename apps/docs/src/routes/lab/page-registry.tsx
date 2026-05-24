import type { ReactNode } from 'react';
import { checkboxLabPage } from './pages/checkbox.js';
import { colorPlaneLabPage } from './pages/color-plane.js';
import { inputLabPage } from './pages/input.js';
import { inputMultiLabPage } from './pages/input-multi.js';
import { menuLabPage } from './pages/menu.js';
import { selectLabPage } from './pages/select.js';
import { sliderLabPage } from './pages/slider.js';
import { toggleButtonLabPage } from './pages/toggle-button.js';
import { toggleGroupLabPage } from './pages/toggle-group.js';
import { tooltipLabPage } from './pages/tooltip.js';
import type { LabPageKey, LabPanelTooltipProviderProps } from './shared.js';
import type { LabPageNavigationItem } from './types.js';

export const LAB_PAGE_DESCRIPTORS = [
  colorPlaneLabPage,
  inputLabPage,
  inputMultiLabPage,
  checkboxLabPage,
  sliderLabPage,
  tooltipLabPage,
  menuLabPage,
  selectLabPage,
  toggleButtonLabPage,
  toggleGroupLabPage,
] as const;

export const LAB_PAGE_NAVIGATION: readonly LabPageNavigationItem[] =
  LAB_PAGE_DESCRIPTORS.map((page) => ({
    value: page.key,
    label: page.label,
  }));

type LabPageControllers = {
  plane: ReturnType<typeof colorPlaneLabPage.useController>;
  input: ReturnType<typeof inputLabPage.useController>;
  inputMulti: ReturnType<typeof inputMultiLabPage.useController>;
  checkbox: ReturnType<typeof checkboxLabPage.useController>;
  slider: ReturnType<typeof sliderLabPage.useController>;
  tooltip: ReturnType<typeof tooltipLabPage.useController>;
  menu: ReturnType<typeof menuLabPage.useController>;
  select: ReturnType<typeof selectLabPage.useController>;
  toggleButton: ReturnType<typeof toggleButtonLabPage.useController>;
  toggle: ReturnType<typeof toggleGroupLabPage.useController>;
};

type LabPageSlots = {
  preview: ReactNode;
  properties: ReactNode;
};

function assertNeverLabPageKey(value: never): never {
  throw new Error(`Unhandled Lab page: ${value}`);
}

export function useLabPageControllers(): LabPageControllers {
  return {
    plane: colorPlaneLabPage.useController(),
    input: inputLabPage.useController(),
    inputMulti: inputMultiLabPage.useController(),
    checkbox: checkboxLabPage.useController(),
    slider: sliderLabPage.useController(),
    tooltip: tooltipLabPage.useController(),
    menu: menuLabPage.useController(),
    select: selectLabPage.useController(),
    toggleButton: toggleButtonLabPage.useController(),
    toggle: toggleGroupLabPage.useController(),
  };
}

export function getLabPagePanelTooltipProviderProps(
  controllers: LabPageControllers,
): LabPanelTooltipProviderProps {
  return {
    delayDuration: controllers.tooltip.delayDuration,
    skipDelayDuration: controllers.tooltip.skipDelayDuration,
  };
}

export function renderLabPageSlots(
  activePage: LabPageKey,
  controllers: LabPageControllers,
): LabPageSlots {
  switch (activePage) {
    case 'plane':
      return {
        preview: colorPlaneLabPage.renderPreview(controllers.plane),
        properties: colorPlaneLabPage.renderProperties(controllers.plane),
      };
    case 'input':
      return {
        preview: inputLabPage.renderPreview(controllers.input),
        properties: inputLabPage.renderProperties(controllers.input),
      };
    case 'inputMulti':
      return {
        preview: inputMultiLabPage.renderPreview(controllers.inputMulti),
        properties: inputMultiLabPage.renderProperties(controllers.inputMulti),
      };
    case 'checkbox':
      return {
        preview: checkboxLabPage.renderPreview(controllers.checkbox),
        properties: checkboxLabPage.renderProperties(controllers.checkbox),
      };
    case 'slider':
      return {
        preview: sliderLabPage.renderPreview(controllers.slider),
        properties: sliderLabPage.renderProperties(controllers.slider),
      };
    case 'tooltip':
      return {
        preview: tooltipLabPage.renderPreview(controllers.tooltip),
        properties: tooltipLabPage.renderProperties(controllers.tooltip),
      };
    case 'menu':
      return {
        preview: menuLabPage.renderPreview(controllers.menu),
        properties: menuLabPage.renderProperties(controllers.menu),
      };
    case 'select':
      return {
        preview: selectLabPage.renderPreview(controllers.select),
        properties: selectLabPage.renderProperties(controllers.select),
      };
    case 'toggleButton':
      return {
        preview: toggleButtonLabPage.renderPreview(controllers.toggleButton),
        properties: toggleButtonLabPage.renderProperties(
          controllers.toggleButton,
        ),
      };
    case 'toggle':
      return {
        preview: toggleGroupLabPage.renderPreview(controllers.toggle),
        properties: toggleGroupLabPage.renderProperties(controllers.toggle),
      };
    default:
      return assertNeverLabPageKey(activePage);
  }
}

export type { LabPageControllers };
