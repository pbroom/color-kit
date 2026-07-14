import type {
  ConfigurableMenuItemConfig,
  ConfigurableMenuItemId,
} from '../../fixtures/menu-items.js';
import type { SelectOptionId } from '../../fixtures/select-options.js';
import {
  InlineConfigurableMenuContent,
  InlineLabMenuContent,
} from './menu-content.js';

export function MenuPlaygroundStage({
  onValueChange,
  configurableItems,
  showShortcuts,
  onShowShortcutsChange,
  showSubmenus,
  onShowSubmenusChange,
  showDividers,
  onShowDividersChange,
  showDisabledOptions,
  showOnOffItems,
  showHeadings,
  showLeadingIcons,
  showTrailingHints,
}: {
  onValueChange: (value: SelectOptionId) => void;
  configurableItems: Record<ConfigurableMenuItemId, ConfigurableMenuItemConfig>;
  showShortcuts: boolean;
  onShowShortcutsChange: (showShortcuts: boolean) => void;
  showSubmenus: boolean;
  onShowSubmenusChange: (showSubmenus: boolean) => void;
  showDividers: boolean;
  onShowDividersChange: (showDividers: boolean) => void;
  showDisabledOptions: boolean;
  showOnOffItems: boolean;
  showHeadings: boolean;
  showLeadingIcons: boolean;
  showTrailingHints: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <InlineConfigurableMenuContent items={configurableItems} />
      <InlineLabMenuContent
        onValueChange={onValueChange}
        showShortcuts={showShortcuts}
        onShowShortcutsChange={onShowShortcutsChange}
        showSubmenus={showSubmenus}
        onShowSubmenusChange={onShowSubmenusChange}
        showDividers={showDividers}
        onShowDividersChange={onShowDividersChange}
        showDisabledOptions={showDisabledOptions}
        showOnOffItems={showOnOffItems}
        showHeadings={showHeadings}
        showLeadingIcons={showLeadingIcons}
        showTrailingHints={showTrailingHints}
      />
    </div>
  );
}
