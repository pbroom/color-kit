import { useCallback, useMemo, useState } from 'react';
import {
  ColorApi,
  NumberConfigField,
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
  SLIDER_RANGE_EPSILON,
  SegmentedField,
  SliderPlaygroundStage,
  type ColorSliderChannel,
  type OutputGamut,
  type SliderHueGradientMode,
  type SliderMarkerMode,
  type SliderOrientation,
} from '../shared.js';
import type { LabPageDescriptor } from '../types.js';

function useSliderLabPageController() {
  const [channel, setChannel] = useState<ColorSliderChannel>('c');
  const [gamut, setGamut] = useState<OutputGamut>('display-p3');
  const [orientation, setOrientation] =
    useState<SliderOrientation>('horizontal');
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(0.4);
  const [hueGradientMode, setHueGradientMode] =
    useState<SliderHueGradientMode>('static');
  const [dragEpsilon, setDragEpsilon] = useState(0.0005);
  const [maxPointerRate, setMaxPointerRate] = useState(60);
  const [markerMode, setMarkerMode] = useState<SliderMarkerMode>('auto');

  const rangeBounds = useMemo(
    () => ColorApi.resolveColorSliderRange(channel),
    [channel],
  );
  const range = useMemo<[number, number]>(() => {
    const [lowerBound, upperBound] = rangeBounds;
    const min = Math.max(
      lowerBound,
      Math.min(rangeMin, rangeMax - SLIDER_RANGE_EPSILON),
    );
    const max = Math.min(
      upperBound,
      Math.max(rangeMax, min + SLIDER_RANGE_EPSILON),
    );
    return [min, max];
  }, [rangeBounds, rangeMin, rangeMax]);
  const rangeMinControlMax = Math.max(
    rangeBounds[0],
    Math.min(
      rangeMax - SLIDER_RANGE_EPSILON,
      rangeBounds[1] - SLIDER_RANGE_EPSILON,
    ),
  );
  const rangeMaxControlMin = Math.min(
    rangeBounds[1],
    Math.max(
      rangeMin + SLIDER_RANGE_EPSILON,
      rangeBounds[0] + SLIDER_RANGE_EPSILON,
    ),
  );
  const setChannelWithDefaultRange = useCallback(
    (nextChannel: ColorSliderChannel) => {
      const [min, max] = ColorApi.resolveColorSliderRange(nextChannel);
      setChannel(nextChannel);
      setRangeMin(min);
      setRangeMax(max);
    },
    [],
  );

  return {
    channel,
    dragEpsilon,
    gamut,
    hueGradientMode,
    markerMode,
    maxPointerRate,
    orientation,
    range,
    rangeBounds,
    rangeMax,
    rangeMaxControlMin,
    rangeMin,
    rangeMinControlMax,
    setChannelWithDefaultRange,
    setDragEpsilon,
    setGamut,
    setHueGradientMode,
    setMarkerMode,
    setMaxPointerRate,
    setOrientation,
    setRangeMax,
    setRangeMin,
  };
}

type SliderLabPageController = ReturnType<typeof useSliderLabPageController>;

function renderSliderPreview(controller: SliderLabPageController) {
  return (
    <SliderPlaygroundStage
      channel={controller.channel}
      gamut={controller.gamut}
      orientation={controller.orientation}
      range={controller.range}
      hueGradientMode={controller.hueGradientMode}
      dragEpsilon={controller.dragEpsilon}
      maxPointerRate={controller.maxPointerRate}
      markerMode={controller.markerMode}
    />
  );
}

function renderSliderProperties(controller: SliderLabPageController) {
  return (
    <PanelSection
      title="Slider"
      description="Preview one ColorSlider instance and tune its slider-specific props."
    >
      <div className="space-y-3">
        <SegmentedField
          label="Channel"
          value={controller.channel}
          onChange={controller.setChannelWithDefaultRange}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
            { value: 'alpha', label: 'A' },
          ]}
        />
        <SegmentedField
          label="Preview gamut"
          value={controller.gamut}
          onChange={controller.setGamut}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
        />
        <SegmentedField
          label="Orientation"
          value={controller.orientation}
          onChange={controller.setOrientation}
          options={[
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ]}
        />
        <SegmentedField
          label="Hue gradient"
          value={controller.hueGradientMode}
          onChange={controller.setHueGradientMode}
          options={[
            { value: 'static', label: 'Static' },
            { value: 'selected-color', label: 'Color' },
          ]}
        />
        <SegmentedField
          label="Markers"
          value={controller.markerMode}
          onChange={controller.setMarkerMode}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'off', label: 'Off' },
          ]}
        />
        <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
          <NumberConfigField
            label="Range min"
            value={controller.rangeMin}
            onChange={controller.setRangeMin}
            step={0.01}
            min={controller.rangeBounds[0]}
            max={controller.rangeMinControlMax}
            precision={4}
          />
          <NumberConfigField
            label="Range max"
            value={controller.rangeMax}
            onChange={controller.setRangeMax}
            step={0.01}
            min={controller.rangeMaxControlMin}
            max={controller.rangeBounds[1]}
            precision={4}
          />
          <NumberConfigField
            label="Drag epsilon"
            value={controller.dragEpsilon}
            onChange={controller.setDragEpsilon}
            step={0.0001}
            min={0}
            max={1}
            precision={4}
          />
          <NumberConfigField
            label="Max pointer rate"
            value={controller.maxPointerRate}
            onChange={controller.setMaxPointerRate}
            step={1}
            min={1}
            max={240}
          />
        </div>
      </div>
    </PanelSection>
  );
}

export const sliderLabPage: LabPageDescriptor<
  'slider',
  SliderLabPageController
> = {
  key: 'slider',
  label: 'Slider',
  useController: useSliderLabPageController,
  renderPreview: renderSliderPreview,
  renderProperties: renderSliderProperties,
};

export type { SliderLabPageController };
