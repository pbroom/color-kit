import { useCallback, useState } from 'react';
import {
  Check,
  Circle,
  Menu as MenuIcon,
  MousePointer2,
  Sparkles,
  User,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  TextConfigField,
  ToggleField,
} from '../components/panel/config-fields.js';
import {
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
} from '../components/panel/panel-section.js';
import { SegmentedField } from '../components/panel/segmented-field.js';
import { MenuPlaygroundStage } from '../components/playgrounds/menu.js';
import {
  CONFIGURABLE_MENU_ITEM_IDS,
  CONFIGURABLE_MENU_ITEM_LABELS,
  DEFAULT_CONFIGURABLE_MENU_ITEMS,
  type ConfigurableMenuItemConfig,
  type ConfigurableMenuItemId,
} from '../fixtures/menu-items.js';
import type { SelectOptionId } from '../fixtures/select-options.js';
import { createActiveLabPage } from '../create-active-lab-page.js';
import type { LabPageDescriptor } from '../types.js';

function useMenuLabPageController() {
  const [, setValue] = useState<SelectOptionId>('copy');
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showSubmenus, setShowSubmenus] = useState(true);
  const [showDividers, setShowDividers] = useState(true);
  const [showDisabledOptions, setShowDisabledOptions] = useState(true);
  const [showOnOffItems, setShowOnOffItems] = useState(true);
  const [showHeadings, setShowHeadings] = useState(false);
  const [showLeadingIcons, setShowLeadingIcons] = useState(true);
  const showTrailingHints = true;
  const [configurableItems, setConfigurableItems] = useState(
    DEFAULT_CONFIGURABLE_MENU_ITEMS,
  );

  const setConfigurableItemConfig = useCallback(
    <K extends keyof ConfigurableMenuItemConfig>(
      itemId: ConfigurableMenuItemId,
      key: K,
      value: ConfigurableMenuItemConfig[K],
    ) => {
      setConfigurableItems((current) => ({
        ...current,
        [itemId]: {
          ...current[itemId],
          [key]: value,
        },
      }));
    },
    [],
  );

  return {
    configurableItems,
    setConfigurableItemConfig,
    setShowDisabledOptions,
    setShowDividers,
    setShowHeadings,
    setShowLeadingIcons,
    setShowOnOffItems,
    setShowShortcuts,
    setShowSubmenus,
    setValue,
    showDisabledOptions,
    showDividers,
    showHeadings,
    showLeadingIcons,
    showOnOffItems,
    showShortcuts,
    showSubmenus,
    showTrailingHints,
  };
}

type MenuLabPageController = ReturnType<typeof useMenuLabPageController>;

function renderMenuPreview(controller: MenuLabPageController) {
  return (
    <MenuPlaygroundStage
      onValueChange={controller.setValue}
      configurableItems={controller.configurableItems}
      showShortcuts={controller.showShortcuts}
      onShowShortcutsChange={controller.setShowShortcuts}
      showSubmenus={controller.showSubmenus}
      onShowSubmenusChange={controller.setShowSubmenus}
      showDividers={controller.showDividers}
      onShowDividersChange={controller.setShowDividers}
      showDisabledOptions={controller.showDisabledOptions}
      showOnOffItems={controller.showOnOffItems}
      showHeadings={controller.showHeadings}
      showLeadingIcons={controller.showLeadingIcons}
      showTrailingHints={controller.showTrailingHints}
    />
  );
}

function renderMenuProperties(controller: MenuLabPageController) {
  return (
    <>
      <PanelSection
        title="Configurable Items"
        description="Tune the three-item menu shown above the reusable menu preview."
      >
        <div className="space-y-5">
          {CONFIGURABLE_MENU_ITEM_IDS.map((itemId) => {
            const item = controller.configurableItems[itemId];

            return (
              <div key={itemId} className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                  {CONFIGURABLE_MENU_ITEM_LABELS[itemId]}
                </p>
                <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                  <SegmentedField
                    label="Item type"
                    value={item.type}
                    onChange={(value) =>
                      controller.setConfigurableItemConfig(
                        itemId,
                        'type',
                        value,
                      )
                    }
                    options={[
                      {
                        value: 'default',
                        label: 'Default',
                        icon: (
                          <MousePointer2
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'Default item',
                      },
                      {
                        value: 'onOff',
                        label: 'On/Off',
                        icon: (
                          <Check
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'On/off item',
                      },
                      {
                        value: 'submenu',
                        label: 'Submenu',
                        icon: (
                          <MenuIcon
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'Submenu item',
                      },
                    ]}
                  />
                  <SegmentedField
                    label="Leading item"
                    value={item.leading}
                    onChange={(value) =>
                      controller.setConfigurableItemConfig(
                        itemId,
                        'leading',
                        value,
                      )
                    }
                    options={[
                      {
                        value: 'none',
                        label: 'None',
                        icon: (
                          <Circle
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'No leading item',
                      },
                      {
                        value: 'icon',
                        label: 'Icon',
                        icon: (
                          <Sparkles
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'Icon leading item',
                      },
                      {
                        value: 'avatar',
                        label: 'Avatar',
                        icon: (
                          <User
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ),
                        tooltip: 'Avatar leading item',
                      },
                    ]}
                  />
                </div>
                {item.type === 'onOff' ? (
                  <ToggleField
                    label="Checked"
                    checked={item.checked ?? true}
                    onChange={(checked) =>
                      controller.setConfigurableItemConfig(
                        itemId,
                        'checked',
                        checked,
                      )
                    }
                  />
                ) : null}
                {item.type !== 'submenu' ? (
                  <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-3">
                    <TextConfigField
                      label="Label"
                      value={item.label}
                      onChange={(value) =>
                        controller.setConfigurableItemConfig(
                          itemId,
                          'label',
                          value,
                        )
                      }
                      maxLength={32}
                      showLabel={false}
                    />
                    <TextConfigField
                      label="Shortcut/Secondary text"
                      value={item.secondaryText}
                      onChange={(value) =>
                        controller.setConfigurableItemConfig(
                          itemId,
                          'secondaryText',
                          value,
                        )
                      }
                      maxLength={16}
                      showLabel={false}
                      placeholder="Shortcut"
                    />
                  </div>
                ) : (
                  <TextConfigField
                    label="Label"
                    value={item.label}
                    onChange={(value) =>
                      controller.setConfigurableItemConfig(
                        itemId,
                        'label',
                        value,
                      )
                    }
                    maxLength={32}
                    showLabel={false}
                  />
                )}
                <ToggleField
                  label="Disabled"
                  checked={item.disabled}
                  onChange={(checked) =>
                    controller.setConfigurableItemConfig(
                      itemId,
                      'disabled',
                      checked,
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </PanelSection>

      <Separator className="bg-white/8" />

      <PanelSection
        title="Menu"
        description="Preview the reusable UI3 menu surface used by the Select demo."
      >
        <div className="space-y-3">
          <ToggleField
            label="Show on/off items"
            checked={controller.showOnOffItems}
            onChange={controller.setShowOnOffItems}
          />
          <ToggleField
            label="Show headings"
            checked={controller.showHeadings}
            onChange={controller.setShowHeadings}
          />
          <ToggleField
            label="Show leading icons"
            checked={controller.showLeadingIcons}
            onChange={controller.setShowLeadingIcons}
          />
          <ToggleField
            label="Show shortcuts"
            checked={controller.showShortcuts}
            onChange={controller.setShowShortcuts}
          />
          <ToggleField
            label="Show submenus"
            checked={controller.showSubmenus}
            onChange={controller.setShowSubmenus}
          />
          <ToggleField
            label="Show dividers"
            checked={controller.showDividers}
            onChange={controller.setShowDividers}
          />
          <ToggleField
            label="Show disabled options"
            checked={controller.showDisabledOptions}
            onChange={controller.setShowDisabledOptions}
          />
        </div>
      </PanelSection>
    </>
  );
}

export const menuLabPage: LabPageDescriptor<'menu', MenuLabPageController> = {
  key: 'menu',
  label: 'Menu',
  useController: useMenuLabPageController,
  renderPreview: renderMenuPreview,
  renderProperties: renderMenuProperties,
};

export type { MenuLabPageController };

export const MenuLabActivePage = createActiveLabPage(menuLabPage);
