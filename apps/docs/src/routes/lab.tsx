import { useState } from 'react';
import {
  getLabPagePanelTooltipProviderProps,
  LAB_PAGE_NAVIGATION,
  renderLabPageSlots,
  useLabPageControllers,
} from './lab/page-registry.js';
import { LabPageFrame, type LabPageKey } from './lab/shared.js';

export function LabPage() {
  const [activePage, setActivePage] = useState<LabPageKey>('plane');
  const controllers = useLabPageControllers();
  const slots = renderLabPageSlots(activePage, controllers);

  return (
    <LabPageFrame
      activePage={activePage}
      onPageChange={setActivePage}
      pages={LAB_PAGE_NAVIGATION}
      panelTooltipProviderProps={getLabPagePanelTooltipProviderProps(
        controllers,
      )}
      preview={slots.preview}
      properties={slots.properties}
    />
  );
}
