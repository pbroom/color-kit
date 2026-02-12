import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { parse, type Color } from '@color-kit/core';
import { createColorState, type ColorState } from '@color-kit/react';

export type DocsInspectorTab = 'outline' | 'properties';
export type DocsInspectorGamut = 'display-p3' | 'srgb';
export type ColorAreaAxis = 'l' | 'c' | 'h';
export type ColorAreaDemoId = 'requested' | 'analysis';
export type ColorAreaFormatRow = 'oklch' | 'hct' | 'hsl' | 'hsb' | 'rgb' | 'hex';
export type EditableColorAreaFormatRow = Exclude<ColorAreaFormatRow, 'hct'>;
export type ColorAreaStylePill = 'solid' | 'dashed' | 'dots';
export type ColorAreaLineWidth = 0.5 | 1;
export type ColorSliderDemoChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorInputDemoFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export type SwatchGroupDemoPalette = 'spectrum' | 'nature' | 'neon';
export type ContrastBadgeDemoPreset = 'interface' | 'editorial' | 'alert';

export interface ColorAreaStrokeControl {
  enabled: boolean;
  style: ColorAreaStylePill;
  width: ColorAreaLineWidth;
}

export interface ColorAreaRegionControl {
  enabled: boolean;
  style: 'dots';
  opacityPercent: number;
}

export interface ColorAreaInspectorState {
  selectedDemo: ColorAreaDemoId;
  gamut: DocsInspectorGamut;
  xAxis: ColorAreaAxis;
  yAxis: ColorAreaAxis;
  activeFormatRow: EditableColorAreaFormatRow;
  colorState: ColorState;
  repeatEdgePixels: boolean;
  background: {
    outOfP3: {
      color: string;
      opacityPercent: number;
    };
    outOfSrgb: {
      color: string;
      opacityPercent: number;
    };
    checkerboard: boolean;
  };
  visualize: {
    p3Fallback: boolean;
    srgbFallback: boolean;
    p3Boundary: ColorAreaStrokeControl;
    srgbBoundary: ColorAreaStrokeControl;
    patternOverlay: {
      enabled: boolean;
      style: 'dots';
      opacityPercent: number;
      dotSize: number;
      dotGap: number;
    };
  };
  chromaBand: {
    mode: 'closest' | 'percentage';
    p3: ColorAreaStrokeControl;
    srgb: ColorAreaStrokeControl;
  };
  contrast: {
    lines: {
      aa3: ColorAreaStrokeControl;
      aa45: ColorAreaStrokeControl;
      aa7: ColorAreaStrokeControl;
    };
    regions: {
      aa3: ColorAreaRegionControl;
      aa45: ColorAreaRegionControl;
      aa7: ColorAreaRegionControl;
    };
  };
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

const REQUESTED_PRESET_COLOR = parse('#2563eb');
const ANALYSIS_PRESET_COLOR = parse('#8b5cf6');

function createControlledColorState(
  color: Color,
  gamut: DocsInspectorGamut,
): ColorState {
  return createColorState(color, {
    activeGamut: gamut,
    activeView: 'oklch',
    source: 'programmatic',
  });
}

function createRequestedPresetState(): ColorAreaInspectorState {
  const gamut: DocsInspectorGamut = 'display-p3';
  return {
    selectedDemo: 'requested',
    gamut,
    xAxis: 'l',
    yAxis: 'c',
    activeFormatRow: 'oklch',
    colorState: createControlledColorState(REQUESTED_PRESET_COLOR, gamut),
    repeatEdgePixels: true,
    background: {
      outOfP3: {
        color: '#1f1f1f',
        opacityPercent: 0,
      },
      outOfSrgb: {
        color: '#1f1f1f',
        opacityPercent: 0,
      },
      checkerboard: true,
    },
    visualize: {
      p3Fallback: false,
      srgbFallback: false,
      p3Boundary: {
        enabled: false,
        style: 'solid',
        width: 0.5,
      },
      srgbBoundary: {
        enabled: false,
        style: 'dashed',
        width: 1,
      },
      patternOverlay: {
        enabled: false,
        style: 'dots',
        opacityPercent: 20,
        dotSize: 2,
        dotGap: 2,
      },
    },
    chromaBand: {
      mode: 'closest',
      p3: {
        enabled: false,
        style: 'solid',
        width: 0.5,
      },
      srgb: {
        enabled: false,
        style: 'dashed',
        width: 0.5,
      },
    },
    contrast: {
      lines: {
        aa3: {
          enabled: false,
          style: 'solid',
          width: 0.5,
        },
        aa45: {
          enabled: false,
          style: 'dashed',
          width: 1,
        },
        aa7: {
          enabled: false,
          style: 'dashed',
          width: 1,
        },
      },
      regions: {
        aa3: {
          enabled: false,
          style: 'dots',
          opacityPercent: 20,
        },
        aa45: {
          enabled: false,
          style: 'dots',
          opacityPercent: 20,
        },
        aa7: {
          enabled: false,
          style: 'dots',
          opacityPercent: 20,
        },
      },
    },
  };
}

function createAnalysisPresetState(): ColorAreaInspectorState {
  const gamut: DocsInspectorGamut = 'display-p3';
  return {
    selectedDemo: 'analysis',
    gamut,
    xAxis: 'l',
    yAxis: 'c',
    activeFormatRow: 'oklch',
    colorState: createControlledColorState(ANALYSIS_PRESET_COLOR, gamut),
    repeatEdgePixels: false,
    background: {
      outOfP3: {
        color: '#1f1f1f',
        opacityPercent: 100,
      },
      outOfSrgb: {
        color: '#1f1f1f',
        opacityPercent: 0,
      },
      checkerboard: true,
    },
    visualize: {
      p3Fallback: true,
      srgbFallback: true,
      p3Boundary: {
        enabled: true,
        style: 'solid',
        width: 0.5,
      },
      srgbBoundary: {
        enabled: true,
        style: 'dashed',
        width: 1,
      },
      patternOverlay: {
        enabled: true,
        style: 'dots',
        opacityPercent: 20,
        dotSize: 2,
        dotGap: 2,
      },
    },
    chromaBand: {
      mode: 'percentage',
      p3: {
        enabled: false,
        style: 'solid',
        width: 0.5,
      },
      srgb: {
        enabled: true,
        style: 'dashed',
        width: 0.5,
      },
    },
    contrast: {
      lines: {
        aa3: {
          enabled: false,
          style: 'solid',
          width: 0.5,
        },
        aa45: {
          enabled: true,
          style: 'dashed',
          width: 1,
        },
        aa7: {
          enabled: false,
          style: 'dashed',
          width: 1,
        },
      },
      regions: {
        aa3: {
          enabled: false,
          style: 'dots',
          opacityPercent: 20,
        },
        aa45: {
          enabled: true,
          style: 'dots',
          opacityPercent: 20,
        },
        aa7: {
          enabled: false,
          style: 'dots',
          opacityPercent: 20,
        },
      },
    },
  };
}

function buildColorAreaPreset(demo: ColorAreaDemoId): ColorAreaInspectorState {
  return demo === 'analysis'
    ? createAnalysisPresetState()
    : createRequestedPresetState();
}

const DEFAULT_COLOR_AREA_STATE: ColorAreaInspectorState =
  createRequestedPresetState();

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

function normalizeColorAreaState(
  state: ColorAreaInspectorState,
): ColorAreaInspectorState {
  const next = { ...state };
  if (next.xAxis === next.yAxis) {
    next.yAxis = next.yAxis === 'l' ? 'c' : 'l';
  }
  if (next.colorState.activeGamut !== next.gamut) {
    next.colorState = {
      ...next.colorState,
      activeGamut: next.gamut,
    };
  }
  return next;
}

interface DocsInspectorContextValue {
  activeTab: DocsInspectorTab;
  setActiveTab: (tab: DocsInspectorTab) => void;
  colorAreaDemos: Array<{ id: ColorAreaDemoId; label: string }>;
  colorAreaState: ColorAreaInspectorState;
  setColorAreaState: (patch: Partial<ColorAreaInspectorState>) => void;
  setColorAreaRequested: (requested: Color) => void;
  setColorAreaColorState: (next: ColorState) => void;
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
        let next: ColorAreaInspectorState;

        if (patch.selectedDemo && patch.selectedDemo !== current.selectedDemo) {
          next = {
            ...buildColorAreaPreset(patch.selectedDemo),
            ...patch,
            selectedDemo: patch.selectedDemo,
          };
        } else {
          next = {
            ...current,
            ...patch,
          };
        }

        if (patch.colorState) {
          next.gamut = patch.colorState.activeGamut as DocsInspectorGamut;
        } else if (patch.gamut && next.colorState.activeGamut !== patch.gamut) {
          next.colorState = {
            ...next.colorState,
            activeGamut: patch.gamut,
          };
        }

        return normalizeColorAreaState(next);
      });
    },
    [],
  );

  const setColorAreaRequested = useCallback((requested: Color) => {
    setColorAreaStateInternal((current) => {
      const nextColorState = createColorState(requested, {
        activeGamut: current.gamut,
        activeView: current.colorState.activeView,
        source: 'programmatic',
      });

      return normalizeColorAreaState({
        ...current,
        colorState: nextColorState,
      });
    });
  }, []);

  const setColorAreaColorState = useCallback((nextColorState: ColorState) => {
    setColorAreaStateInternal((current) =>
      normalizeColorAreaState({
        ...current,
        gamut: nextColorState.activeGamut as DocsInspectorGamut,
        colorState: nextColorState,
      }),
    );
  }, []);

  const cycleColorAreaDemo = useCallback((direction: 1 | -1) => {
    setColorAreaStateInternal((current) => {
      const index = COLOR_AREA_DEMOS.findIndex(
        (demo) => demo.id === current.selectedDemo,
      );
      const nextIndex =
        (index + direction + COLOR_AREA_DEMOS.length) % COLOR_AREA_DEMOS.length;
      const selectedDemo = COLOR_AREA_DEMOS[nextIndex].id;
      return normalizeColorAreaState(buildColorAreaPreset(selectedDemo));
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
      setColorAreaRequested,
      setColorAreaColorState,
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
      setColorAreaRequested,
      setColorAreaColorState,
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
