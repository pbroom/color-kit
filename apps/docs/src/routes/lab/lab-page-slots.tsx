import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LAB_PANEL_TOOLTIP_PROPS,
  type LabPageRuntimeOutput,
} from './lab-page-runtime.js';

type LabPageSlotContextValue = {
  setPreview: (preview: ReactNode) => void;
  setProperties: (properties: ReactNode) => void;
  setPanelTooltipProviderProps: (
    props: LabPageRuntimeOutput['panelTooltipProviderProps'],
  ) => void;
};

const LabPageSlotContext = createContext<LabPageSlotContextValue | null>(null);

export function LabPageSlotProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<ReactNode>(null);
  const [properties, setProperties] = useState<ReactNode>(null);
  const [panelTooltipProviderProps, setPanelTooltipProviderProps] = useState<
    LabPageRuntimeOutput['panelTooltipProviderProps']
  >(DEFAULT_LAB_PANEL_TOOLTIP_PROPS);

  const value = useMemo(
    () => ({
      setPreview,
      setProperties,
      setPanelTooltipProviderProps,
    }),
    [],
  );

  const slotContent = useMemo(
    () => ({
      preview,
      properties,
      panelTooltipProviderProps:
        panelTooltipProviderProps ?? DEFAULT_LAB_PANEL_TOOLTIP_PROPS,
    }),
    [panelTooltipProviderProps, preview, properties],
  );

  return (
    <LabPageSlotContext.Provider value={value}>
      <LabPageSlotContentContext.Provider value={slotContent}>
        {children}
      </LabPageSlotContentContext.Provider>
    </LabPageSlotContext.Provider>
  );
}

const LabPageSlotContentContext = createContext<{
  preview: ReactNode;
  properties: ReactNode;
  panelTooltipProviderProps: NonNullable<
    LabPageRuntimeOutput['panelTooltipProviderProps']
  >;
} | null>(null);

export function useLabPageSlotContent() {
  const context = useContext(LabPageSlotContentContext);
  if (!context) {
    throw new Error('Lab page slots must render inside LabPageSlotProvider.');
  }
  return context;
}

function useLabPageSlotContext() {
  const context = useContext(LabPageSlotContext);
  if (!context) {
    throw new Error('Lab page slots must render inside LabPageSlotProvider.');
  }
  return context;
}

export function LabPreviewSlot({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { setPreview } = useLabPageSlotContext();

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    setPreview(children);
    return () => {
      setPreview(null);
    };
  }, [children, enabled, setPreview]);

  return null;
}

export function LabPropertiesSlot({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { setProperties } = useLabPageSlotContext();

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    setProperties(children);
    return () => {
      setProperties(null);
    };
  }, [children, enabled, setProperties]);

  return null;
}

export function LabPanelTooltipPropsSlot({
  panelTooltipProviderProps,
  enabled = true,
}: {
  panelTooltipProviderProps: NonNullable<
    LabPageRuntimeOutput['panelTooltipProviderProps']
  >;
  enabled?: boolean;
}) {
  const { setPanelTooltipProviderProps } = useLabPageSlotContext();
  const { delayDuration, skipDelayDuration } = panelTooltipProviderProps;

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    setPanelTooltipProviderProps(panelTooltipProviderProps);
    return () => {
      setPanelTooltipProviderProps(DEFAULT_LAB_PANEL_TOOLTIP_PROPS);
    };
  }, [
    delayDuration,
    enabled,
    panelTooltipProviderProps,
    setPanelTooltipProviderProps,
    skipDelayDuration,
  ]);

  return null;
}
