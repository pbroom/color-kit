import {
  Background,
  ColorApi,
  ColorArea,
  ColorInput,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  useColor,
  type ColorAreaAxes,
  type ColorAreaChannel,
  type ColorAreaPerformanceProfile,
  type ColorSliderChannel,
  type SliderHueGradientMode,
} from 'color-kit/react';
import {
  toCss,
  toHex,
  toP3Gamut,
  toSrgbGamut,
  type Color as ColorValue,
} from 'color-kit';
import { Github } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ThemeSwitcher } from '../components/theme-switcher.js';

type OutputGamut = 'display-p3' | 'srgb';

type SliderRailStyle = CSSProperties & {
  '--ck-slider-gradient-active': string;
  '--ck-slider-gradient-srgb': string;
  '--ck-slider-fallback-color': string;
  '--ck-slider-rail-start-active': string;
  '--ck-slider-rail-start-srgb': string;
  '--ck-slider-rail-end-active': string;
  '--ck-slider-rail-end-srgb': string;
  '--ck-slider-thumb-fill-active': string;
  '--ck-slider-thumb-fill-srgb': string;
};

function alternateAxis(channel: ColorAreaChannel): ColorAreaChannel {
  if (channel === 'l') return 'c';
  return 'l';
}

function normalizeAxes(
  x: ColorAreaChannel,
  y: ColorAreaChannel,
): { x: ColorAreaChannel; y: ColorAreaChannel } {
  if (x !== y) {
    return { x, y };
  }

  return { x, y: alternateAxis(y) };
}

function getOklchSliderRail(
  channel: ColorSliderChannel,
  requested: ColorValue,
  gamut: OutputGamut,
  hueGradientMode?: SliderHueGradientMode,
): { colorSpace: OutputGamut; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel);
  const gradient = ColorApi.getSliderGradientStyles({
    model: 'oklch',
    channel,
    range,
    baseColor: requested,
    colorSpace: gamut,
    hueGradientMode,
  });
  const startStop = gradient.stops[0];
  const endStop = gradient.stops[gradient.stops.length - 1] ?? startStop;
  const thumbNorm = ColorApi.getColorSliderThumbPosition(
    requested,
    channel,
    range,
  );
  const thumbColor = ColorApi.colorFromColorSliderPosition(
    requested,
    channel,
    thumbNorm,
    range,
  );
  const thumbFillSrgb = toCss(toSrgbGamut(thumbColor), 'rgb');
  const thumbFillActive =
    gradient.colorSpace === 'display-p3'
      ? toCss(toP3Gamut(thumbColor), 'p3')
      : thumbFillSrgb;
  const railStartSrgb = startStop?.srgbCss ?? gradient.srgbBackgroundColor;
  const railEndSrgb = endStop?.srgbCss ?? railStartSrgb;
  const railStartActive = startStop?.activeCss ?? railStartSrgb;
  const railEndActive = endStop?.activeCss ?? railEndSrgb;

  return {
    colorSpace: gradient.colorSpace,
    style: {
      '--ck-slider-gradient-active': gradient.activeBackgroundImage,
      '--ck-slider-gradient-srgb': gradient.srgbBackgroundImage,
      '--ck-slider-fallback-color': gradient.srgbBackgroundColor,
      '--ck-slider-rail-start-active': railStartActive,
      '--ck-slider-rail-start-srgb': railStartSrgb,
      '--ck-slider-rail-end-active': railEndActive,
      '--ck-slider-rail-end-srgb': railEndSrgb,
      '--ck-slider-thumb-fill-active': thumbFillActive,
      '--ck-slider-thumb-fill-srgb': thumbFillSrgb,
    },
  };
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium tracking-tight text-white">{title}</h2>
        {description ? (
          <p className="text-xs leading-relaxed text-white/55">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <ToggleGroup
        type="single"
        value={value}
        className="h-auto w-full justify-start rounded-xl border border-white/8 bg-white/[0.03] p-1"
        onValueChange={(next) => {
          if (next) {
            onChange(next as T);
          }
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-8 flex-1 rounded-lg px-2 text-xs text-white/70 data-[state=on]:bg-white/10 data-[state=on]:text-white data-[state=on]:shadow-none"
            aria-label={`${label}: ${option.label}`}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/78">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-white/20 bg-transparent accent-white"
      />
    </label>
  );
}

export function PlaygroundPage() {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.24 28)',
    defaultGamut: 'display-p3',
  });
  const [axisState, setAxisState] = useState<{
    x: ColorAreaChannel;
    y: ColorAreaChannel;
  }>({
    x: 'l',
    y: 'c',
  });
  const [checkerboard, setCheckerboard] = useState(false);
  const [repeatEdgePixels, setRepeatEdgePixels] = useState(false);
  const [showFallbackPoints, setShowFallbackPoints] = useState(false);
  const [showP3Boundary, setShowP3Boundary] = useState(false);
  const [showSrgbBoundary, setShowSrgbBoundary] = useState(false);
  const [performanceProfile, setPerformanceProfile] =
    useState<ColorAreaPerformanceProfile>('auto');

  const channels = useMemo(
    () => normalizeAxes(axisState.x, axisState.y),
    [axisState.x, axisState.y],
  );
  const axes = useMemo<ColorAreaAxes>(
    () => ({
      x: {
        channel: channels.x,
        range: ColorApi.resolveColorAreaRange(channels.x),
      },
      y: {
        channel: channels.y,
        range: ColorApi.resolveColorAreaRange(channels.y),
      },
    }),
    [channels.x, channels.y],
  );
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const displayedSrgb = useMemo(
    () => toCss(toSrgbGamut(color.requested), 'rgb'),
    [color.requested],
  );
  const displayedActive = useMemo(
    () =>
      color.activeGamut === 'display-p3'
        ? toCss(toP3Gamut(color.requested), 'p3')
        : displayedSrgb,
    [color.activeGamut, color.requested, displayedSrgb],
  );
  const displayedHex = useMemo(
    () => toHex(toSrgbGamut(color.requested)).toUpperCase(),
    [color.requested],
  );

  const setAxis = (axis: 'x' | 'y', channel: ColorAreaChannel) => {
    setAxisState((current) => {
      if (axis === 'x') {
        return channel === current.y
          ? { x: channel, y: alternateAxis(channel) }
          : { ...current, x: channel };
      }

      return channel === current.x
        ? { x: alternateAxis(channel), y: channel }
        : { ...current, y: channel };
    });
  };

  return (
    <div className="ck-shell-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="docs-brand">
              <span className="docs-brand-dot" />
              Color Kit
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/introduction">Docs</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/components/color-area">Components</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/shadcn-registry">Registry</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/playground">Playground</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a
                  href="https://github.com/pbroom/color-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </Button>
            </nav>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-3.5rem)] bg-[#171717] text-white lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
        <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden px-6 py-10 lg:min-h-0 lg:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_42%)]" />
            <div className="relative size-[300px]">
              <ColorArea
                className="ck-color-area overflow-hidden rounded-none border border-white/10 bg-[#0c0c0d] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] [&_[data-color-area-thumb]]:hidden"
                style={{ width: 300, height: 300 }}
                axes={axes}
                requested={color.requested}
                onChangeRequested={color.setRequested}
                performanceProfile={performanceProfile}
              >
                {checkerboard ? <Background checkerboard /> : null}
                <ColorPlane edgeBehavior={repeatEdgePixels ? 'clamp' : 'transparent'} />
                {showP3Boundary ? (
                  <GamutBoundaryLayer
                    gamut="display-p3"
                    steps={128}
                    pathProps={{
                      fill: 'none',
                      stroke: '#ff3b30',
                      strokeWidth: 0.45,
                      strokeLinejoin: 'miter',
                      strokeMiterlimit: 6,
                    }}
                  />
                ) : null}
                {showSrgbBoundary ? (
                  <GamutBoundaryLayer
                    gamut="srgb"
                    steps={128}
                    pathProps={{
                      fill: 'none',
                      stroke: 'rgba(255,255,255,0.88)',
                      strokeWidth: 0.45,
                      strokeDasharray: '1.4 1',
                      strokeLinejoin: 'miter',
                      strokeMiterlimit: 6,
                    }}
                  />
                ) : null}
                {showFallbackPoints ? (
                  <FallbackPointsLayer
                    showP3
                    showSrgb={color.activeGamut === 'srgb'}
                  />
                ) : null}
              </ColorArea>
            </div>
          </section>

          <aside className="border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full rounded-[24px] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-6 p-4">
                  <PanelSection
                    title="Playground"
                    description="Drag inside the color area and tune the plane from this properties rail."
                  >
                    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div
                        className="size-12 shrink-0 rounded-xl border border-white/10"
                        style={{
                          backgroundColor: displayedSrgb,
                          background: displayedActive,
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {displayedHex}
                        </div>
                        <div className="text-xs text-white/55">
                          {color.activeGamut === 'display-p3' ? 'Display P3' : 'sRGB'}{' '}
                          preview
                        </div>
                      </div>
                    </div>
                  </PanelSection>

                  <Separator className="bg-white/8" />

                  <PanelSection title="Color" description="Drive the current sample color.">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                          Hex
                        </p>
                        <ColorStringInput
                          format="hex"
                          className="ck-input"
                          requested={color.requested}
                          onChangeRequested={color.setRequested}
                          aria-label="Hex color input"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                          Hue
                        </p>
                        <ColorSlider
                          channel="h"
                          className="ck-slider ck-slider-v2"
                          data-color-space={hueRail.colorSpace}
                          requested={color.requested}
                          onChangeRequested={color.setRequested}
                          style={hueRail.style}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <ColorInput
                          model="oklch"
                          channel="l"
                          className="ck-input"
                          requested={color.requested}
                          onChangeRequested={color.setRequested}
                          aria-label="Lightness input"
                        />
                        <ColorInput
                          model="oklch"
                          channel="c"
                          className="ck-input"
                          requested={color.requested}
                          onChangeRequested={color.setRequested}
                          aria-label="Chroma input"
                        />
                        <ColorInput
                          model="oklch"
                          channel="h"
                          className="ck-input"
                          requested={color.requested}
                          onChangeRequested={color.setRequested}
                          aria-label="Hue input"
                        />
                      </div>
                    </div>
                  </PanelSection>

                  <Separator className="bg-white/8" />

                  <PanelSection
                    title="Plane"
                    description="Change the displayed gamut and the axes mapped into the square."
                  >
                    <div className="space-y-3">
                      <SegmentedField
                        label="Preview gamut"
                        value={color.activeGamut}
                        onChange={(next) => color.setActiveGamut(next, 'programmatic')}
                        options={[
                          { value: 'display-p3', label: 'P3' },
                          { value: 'srgb', label: 'sRGB' },
                        ]}
                      />
                      <SegmentedField
                        label="X axis"
                        value={axisState.x}
                        onChange={(next) => setAxis('x', next)}
                        options={[
                          { value: 'l', label: 'L' },
                          { value: 'c', label: 'C' },
                          { value: 'h', label: 'H' },
                        ]}
                      />
                      <SegmentedField
                        label="Y axis"
                        value={axisState.y}
                        onChange={(next) => setAxis('y', next)}
                        options={[
                          { value: 'l', label: 'L' },
                          { value: 'c', label: 'C' },
                          { value: 'h', label: 'H' },
                        ]}
                      />
                      <ToggleField
                        label="Repeat edge pixels"
                        checked={repeatEdgePixels}
                        onChange={setRepeatEdgePixels}
                      />
                      <ToggleField
                        label="Checkerboard background"
                        checked={checkerboard}
                        onChange={setCheckerboard}
                      />
                    </div>
                  </PanelSection>

                  <Separator className="bg-white/8" />

                  <PanelSection
                    title="Overlays"
                    description="Optional helpers for reading the active gamut geometry."
                  >
                    <div className="space-y-3">
                      <ToggleField
                        label="Display P3 boundary"
                        checked={showP3Boundary}
                        onChange={setShowP3Boundary}
                      />
                      <ToggleField
                        label="sRGB boundary"
                        checked={showSrgbBoundary}
                        onChange={setShowSrgbBoundary}
                      />
                      <ToggleField
                        label="Fallback points"
                        checked={showFallbackPoints}
                        onChange={setShowFallbackPoints}
                      />
                    </div>
                  </PanelSection>

                  <Separator className="bg-white/8" />

                  <PanelSection
                    title="Rendering"
                    description="Tune how aggressively the area optimizes pointer updates."
                  >
                    <SegmentedField
                      label="Performance profile"
                      value={performanceProfile}
                      onChange={setPerformanceProfile}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'quality', label: 'Quality' },
                        { value: 'balanced', label: 'Balanced' },
                        { value: 'performance', label: 'Perf' },
                      ]}
                    />
                  </PanelSection>
                </div>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
