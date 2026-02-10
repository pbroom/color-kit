import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DocsInspectorTab = 'outline' | 'properties';
export type ColorAreaAxis = 'l' | 'c' | 'h';
export type ColorAreaDemoId = 'requested' | 'analysis';

export interface ColorAreaInspectorState {
  selectedDemo: ColorAreaDemoId;
  gamut: 'display-p3' | 'srgb';
  xAxis: ColorAreaAxis;
  yAxis: ColorAreaAxis;
  showCheckerboard: boolean;
  showP3Boundary: boolean;
  showSrgbBoundary: boolean;
  showContrastRegion: boolean;
}

const COLOR_AREA_DEMOS: Array<{ id: ColorAreaDemoId; label: string }> = [
  { id: 'requested', label: 'Requested vs Displayed' },
  { id: 'analysis', label: 'Boundary + Contrast' },
];

const DEFAULT_COLOR_AREA_STATE: ColorAreaInspectorState = {
  selectedDemo: 'requested',
  gamut: 'display-p3',
  xAxis: 'c',
  yAxis: 'l',
  showCheckerboard: true,
  showP3Boundary: false,
  showSrgbBoundary: false,
  showContrastRegion: false,
};

const COLOR_AREA_DEMO_PRESETS: Record<
  ColorAreaDemoId,
  Pick<
    ColorAreaInspectorState,
    | 'showCheckerboard'
    | 'showP3Boundary'
    | 'showSrgbBoundary'
    | 'showContrastRegion'
  >
> = {
  requested: {
    showCheckerboard: true,
    showP3Boundary: false,
    showSrgbBoundary: false,
    showContrastRegion: false,
  },
  analysis: {
    showCheckerboard: false,
    showP3Boundary: true,
    showSrgbBoundary: true,
    showContrastRegion: true,
  },
};

function normalizeColorAreaState(
  state: ColorAreaInspectorState,
): ColorAreaInspectorState {
  const next = { ...state };
  if (next.xAxis === next.yAxis) {
    next.yAxis = next.yAxis === 'l' ? 'c' : 'l';
  }
  return next;
}

interface DocsInspectorContextValue {
  activeTab: DocsInspectorTab;
  setActiveTab: (tab: DocsInspectorTab) => void;
  colorAreaDemos: Array<{ id: ColorAreaDemoId; label: string }>;
  colorAreaState: ColorAreaInspectorState;
  setColorAreaState: (patch: Partial<ColorAreaInspectorState>) => void;
  cycleColorAreaDemo: (direction: 1 | -1) => void;
}

const DocsInspectorContext = createContext<DocsInspectorContextValue | null>(
  null,
);

export function DocsInspectorProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<DocsInspectorTab>('outline');
  const [colorAreaState, setColorAreaStateInternal] = useState(
    DEFAULT_COLOR_AREA_STATE,
  );

  const setColorAreaState = useCallback(
    (patch: Partial<ColorAreaInspectorState>) => {
      setColorAreaStateInternal((current) => {
        const next = { ...current, ...patch };
        if (patch.selectedDemo && patch.selectedDemo !== current.selectedDemo) {
          Object.assign(next, COLOR_AREA_DEMO_PRESETS[patch.selectedDemo]);
        }
        return normalizeColorAreaState(next);
      });
    },
    [],
  );

  const cycleColorAreaDemo = useCallback((direction: 1 | -1) => {
    setColorAreaStateInternal((current) => {
      const index = COLOR_AREA_DEMOS.findIndex(
        (demo) => demo.id === current.selectedDemo,
      );
      const nextIndex =
        (index + direction + COLOR_AREA_DEMOS.length) % COLOR_AREA_DEMOS.length;
      const selectedDemo = COLOR_AREA_DEMOS[nextIndex].id;
      return normalizeColorAreaState({
        ...current,
        selectedDemo,
        ...COLOR_AREA_DEMO_PRESETS[selectedDemo],
      });
    });
  }, []);

  const value = useMemo<DocsInspectorContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      colorAreaDemos: COLOR_AREA_DEMOS,
      colorAreaState,
      setColorAreaState,
      cycleColorAreaDemo,
    }),
    [activeTab, colorAreaState, setColorAreaState, cycleColorAreaDemo],
  );

  return (
    <DocsInspectorContext.Provider value={value}>
      {children}
    </DocsInspectorContext.Provider>
  );
}

export function useDocsInspector(): DocsInspectorContextValue {
  const context = useContext(DocsInspectorContext);
  if (!context) {
    throw new Error(
      'useDocsInspector must be used inside <DocsInspectorProvider>',
    );
  }
  return context;
}

export function useOptionalDocsInspector(): DocsInspectorContextValue | null {
  return useContext(DocsInspectorContext);
}
