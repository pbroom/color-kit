import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import type { LabPageKey } from './types.js';

export { LAB_PAGE_NAVIGATION } from './lab-page-runtime.js';

type ActiveLabPageComponent = ComponentType<{
  isActive?: boolean;
}>;

const LAB_PAGE_LOADERS: Record<
  LabPageKey,
  () => Promise<{ default: ActiveLabPageComponent }>
> = {
  plane: () =>
    import('./pages/color-plane.js').then((module) => ({
      default: module.PlaneLabActivePage,
    })),
  input: () =>
    import('./pages/input.js').then((module) => ({
      default: module.InputLabActivePage,
    })),
  inputMulti: () =>
    import('./pages/input-multi.js').then((module) => ({
      default: module.InputMultiLabActivePage,
    })),
  checkbox: () =>
    import('./pages/checkbox.js').then((module) => ({
      default: module.CheckboxLabActivePage,
    })),
  slider: () =>
    import('./pages/slider.js').then((module) => ({
      default: module.SliderLabActivePage,
    })),
  tooltip: () =>
    import('./pages/tooltip.js').then((module) => ({
      default: module.TooltipLabActivePage,
    })),
  menu: () =>
    import('./pages/menu.js').then((module) => ({
      default: module.MenuLabActivePage,
    })),
  select: () =>
    import('./pages/select.js').then((module) => ({
      default: module.SelectLabActivePage,
    })),
  toggleButton: () =>
    import('./pages/toggle-button.js').then((module) => ({
      default: module.ToggleButtonLabActivePage,
    })),
  toggle: () =>
    import('./pages/toggle-group.js').then((module) => ({
      default: module.ToggleGroupLabActivePage,
    })),
};

const LAZY_LAB_PAGES = Object.fromEntries(
  Object.entries(LAB_PAGE_LOADERS).map(([key, loader]) => [key, lazy(loader)]),
) as Record<LabPageKey, LazyExoticComponent<ActiveLabPageComponent>>;

export function LazyActiveLabPage({
  activePage,
  isActive = true,
}: {
  activePage: LabPageKey;
  isActive?: boolean;
}) {
  const ActiveLabPage = LAZY_LAB_PAGES[activePage];

  return (
    <Suspense fallback={null}>
      <ActiveLabPage isActive={isActive} />
    </Suspense>
  );
}
