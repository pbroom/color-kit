import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DocsInspectorTab = 'outline' | 'properties';
export type DocsInspectorGamut = 'display-p3' | 'srgb';
export type ColorAreaAxis = 'l' | 'c' | 'h';
export type ColorAreaDemoId = 'requested' | 'analysis';
export type ColorSliderDemoChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorInputDemoFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export type SwatchGroupDemoPalette = 'spectrum' | 'nature' | 'neon';
export type ContrastBadgeDemoPreset = 'interface' | 'editorial' | 'alert';

export interface ColorAreaInspectorState {
  selectedDemo: ColorAreaDemoId;
  gamut: DocsInspectorGamut;
  xAxis: ColorAreaAxis;
  yAxis: ColorAreaAxis;
  showCheckerboard: boolean;
  showP3Boundary: boolean;
  showSrgbBoundary: boolean;
  showContrastRegion: boolean;
}

export interface ColorSliderInspectorState {
  channel: ColorSliderDemoChannel;
  gamut: DocsInspectorGamut;
}

export interface ColorInputInspectorState {
  format: ColorInputDemoFormat;
  gamut: DocsInspectorGamut;
}

export interface SwatchGroupInspectorState {
  palette: SwatchGroupDemoPalette;
  columns: 3 | 4 | 5;
}

export interface ContrastBadgeInspectorState {
  preset: ContrastBadgeDemoPreset;
  level: 'AA' | 'AAA';
}

const COLOR_AREA_DEMOS: Array<{ id: ColorAreaDemoId; label: string }> = [
  { id: 'requested', label: 'Requested vs Displayed' },
  { id: 'analysis', label: 'Boundary + Contrast' },
];

const DEFAULT_COLOR_AREA_STATE: ColorAreaInspectorState = {
  selectedDemo: 'requested',
  gamut: 'display-p3',
  xAxis: 'l',
  yAxis: 'c',
  showCheckerboard: true,
  showP3Boundary: false,
  showSrgbBoundary: false,
  showContrastRegion: false,
};

const DEFAULT_COLOR_SLIDER_STATE: ColorSliderInspectorState = {
  channel: 'c',
  gamut: 'display-p3',
};

const DEFAULT_COLOR_INPUT_STATE: ColorInputInspectorState = {
  format: 'hex',
  gamut: 'display-p3',
};

const DEFAULT_SWATCH_GROUP_STATE: SwatchGroupInspectorState = {
  palette: 'spectrum',
  columns: 4,
};

const DEFAULT_CONTRAST_BADGE_STATE: ContrastBadgeInspectorState = {
  preset: 'interface',
  level: 'AA',
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
  colorSliderState: ColorSliderInspectorState;
  setColorSliderState: (patch: Partial<ColorSliderInspectorState>) => void;
  colorInputState: ColorInputInspectorState;
  setColorInputState: (patch: Partial<ColorInputInspectorState>) => void;
  swatchGroupState: SwatchGroupInspectorState;
  setSwatchGroupState: (patch: Partial<SwatchGroupInspectorState>) => void;
  contrastBadgeState: ContrastBadgeInspectorState;
  setContrastBadgeState: (patch: Partial<ContrastBadgeInspectorState>) => void;
}

const DocsInspectorContext = createContext<DocsInspectorContextValue | null>(
  null,
);

export function DocsInspectorProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<DocsInspectorTab>('outline');
  const [colorAreaState, setColorAreaStateInternal] = useState(
    DEFAULT_COLOR_AREA_STATE,
  );
  const [colorSliderState, setColorSliderStateInternal] = useState(
    DEFAULT_COLOR_SLIDER_STATE,
  );
  const [colorInputState, setColorInputStateInternal] = useState(
    DEFAULT_COLOR_INPUT_STATE,
  );
  const [swatchGroupState, setSwatchGroupStateInternal] = useState(
    DEFAULT_SWATCH_GROUP_STATE,
  );
  const [contrastBadgeState, setContrastBadgeStateInternal] = useState(
    DEFAULT_CONTRAST_BADGE_STATE,
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

  const setColorSliderState = useCallback(
    (patch: Partial<ColorSliderInspectorState>) => {
      setColorSliderStateInternal((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const setColorInputState = useCallback(
    (patch: Partial<ColorInputInspectorState>) => {
      setColorInputStateInternal((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const setSwatchGroupState = useCallback(
    (patch: Partial<SwatchGroupInspectorState>) => {
      setSwatchGroupStateInternal((current) => ({
        ...current,
        ...patch,
      }));
    },
    [],
  );

  const setContrastBadgeState = useCallback(
    (patch: Partial<ContrastBadgeInspectorState>) => {
      setContrastBadgeStateInternal((current) => ({
        ...current,
        ...patch,
      }));
    },
    [],
  );

  const value = useMemo<DocsInspectorContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      colorAreaDemos: COLOR_AREA_DEMOS,
      colorAreaState,
      setColorAreaState,
      cycleColorAreaDemo,
      colorSliderState,
      setColorSliderState,
      colorInputState,
      setColorInputState,
      swatchGroupState,
      setSwatchGroupState,
      contrastBadgeState,
      setContrastBadgeState,
    }),
    [
      activeTab,
      colorAreaState,
      setColorAreaState,
      cycleColorAreaDemo,
      colorSliderState,
      setColorSliderState,
      colorInputState,
      setColorInputState,
      swatchGroupState,
      setSwatchGroupState,
      contrastBadgeState,
      setContrastBadgeState,
    ],
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
