import type { ReactNode } from 'react';
import type { LabPageKey } from './shared.js';

export type { LabPageNavigationItem } from './shared.js';

export type LabPageDescriptor<TKey extends LabPageKey, TController> = {
  key: TKey;
  label: string;
  useController: () => TController;
  renderPreview: (controller: TController) => ReactNode;
  renderProperties: (controller: TController) => ReactNode;
};
