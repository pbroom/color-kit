import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  NumberConfigField,
  ToggleField,
} from '../components/panel/config-fields.js';
import {
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
} from '../components/panel/panel-section.js';
import { PlacementGridField } from '../components/panel/placement-grid-field.js';
import { TooltipPlaygroundStage } from '../components/playgrounds/tooltip.js';
import type { PlacementAlign, TooltipSide } from '../types.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useTooltipLabPageController() {
  const [side, setSide] = useState<TooltipSide>('top');
  const [align, setAlign] = useState<PlacementAlign>('center');
  const [delayDuration, setDelayDuration] = useState(1000);
  const [skipDelayDuration, setSkipDelayDuration] = useState(300);
  const [showPointer, setShowPointer] = useState(true);
  const [highContrast, setHighContrast] = useState(true);

  return {
    align,
    delayDuration,
    highContrast,
    setAlign,
    setDelayDuration,
    setHighContrast,
    setShowPointer,
    setSide,
    setSkipDelayDuration,
    showPointer,
    side,
    skipDelayDuration,
  };
}

type TooltipLabPageController = ReturnType<typeof useTooltipLabPageController>;

function renderTooltipPreview(controller: TooltipLabPageController) {
  return (
    <TooltipPlaygroundStage
      align={controller.align}
      delayDuration={controller.delayDuration}
      highContrast={controller.highContrast}
      skipDelayDuration={controller.skipDelayDuration}
      side={controller.side}
      showPointer={controller.showPointer}
    />
  );
}

function renderTooltipProperties(controller: TooltipLabPageController) {
  return (
    <>
      <PanelSection
        title="Timing"
        description="Tune the Radix initial hover delay and the cooldown window that marks tooltip handoffs."
      >
        <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
          <NumberConfigField
            label="Initial delay"
            value={controller.delayDuration}
            onChange={controller.setDelayDuration}
            step={50}
          />
          <NumberConfigField
            label="Handoff"
            value={controller.skipDelayDuration}
            onChange={controller.setSkipDelayDuration}
            step={50}
          />
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Placement"
        description="Move the tooltip around each trigger while preserving the same handoff behavior."
      >
        <PlacementGridField
          label="Placement"
          side={controller.side}
          align={controller.align}
          onChange={(placement) => {
            controller.setSide(placement.side);
            controller.setAlign(placement.align);
          }}
        />
        <div className="mt-3">
          <ToggleField
            label="High contrast"
            checked={controller.highContrast}
            onChange={controller.setHighContrast}
          />
          <ToggleField
            label="Show pointer"
            checked={controller.showPointer}
            onChange={controller.setShowPointer}
          />
        </div>
      </PanelSection>
    </>
  );
}

export const tooltipLabPage: LabPageDescriptor<
  'tooltip',
  TooltipLabPageController
> = {
  key: 'tooltip',
  label: 'Tooltip',
  useController: useTooltipLabPageController,
  renderPreview: renderTooltipPreview,
  renderProperties: renderTooltipProperties,
};

export type { TooltipLabPageController };

export const TooltipLabActivePage = createActiveLabPage(
  tooltipLabPage,
  (controller) => ({
    panelTooltipProviderProps: {
      delayDuration: controller.delayDuration,
      skipDelayDuration: controller.skipDelayDuration,
    },
  }),
);
