import {
  ChromaMarkers,
  ColorSlider,
  useColor,
  type ColorSliderChannel,
  type SliderHueGradientMode,
} from 'color-kit/react';
import { useEffect, useMemo, useRef } from 'react';
import { getOklchSliderRail } from '../../color/slider-rail.js';
import type {
  OutputGamut,
  SliderMarkerMode,
  SliderOrientation,
} from '../../types.js';

export function SliderPlaygroundStage({
  channel,
  gamut,
  orientation,
  range,
  hueGradientMode,
  dragEpsilon,
  maxPointerRate,
  markerMode,
}: {
  channel: ColorSliderChannel;
  gamut: OutputGamut;
  orientation: SliderOrientation;
  range: [number, number];
  hueGradientMode: SliderHueGradientMode;
  dragEpsilon: number;
  maxPointerRate: number;
  markerMode: SliderMarkerMode;
}) {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.22 35)',
    defaultGamut: gamut,
  });
  const setSliderGamutRef = useRef(color.setActiveGamut);

  useEffect(() => {
    setSliderGamutRef.current = color.setActiveGamut;
  }, [color.setActiveGamut]);

  useEffect(() => {
    if (color.activeGamut === gamut) {
      return;
    }
    setSliderGamutRef.current(gamut, 'programmatic');
  }, [color.activeGamut, gamut]);

  const sliderRail = useMemo(
    () =>
      getOklchSliderRail(
        channel,
        color.requested,
        color.activeGamut,
        hueGradientMode,
        range,
      ),
    [channel, color.activeGamut, color.requested, hueGradientMode, range],
  );

  return (
    <div
      className={
        orientation === 'vertical'
          ? 'ck-demo-stack ck-slider-single-demo ck-slider-single-demo-vertical'
          : 'ck-demo-stack ck-slider-single-demo'
      }
    >
      <ColorSlider
        channel={channel}
        className="ck-slider ck-slider-v2"
        data-color-space={sliderRail.colorSpace}
        orientation={orientation}
        range={range}
        requested={color.requested}
        onChangeRequested={color.setRequested}
        dragEpsilon={dragEpsilon}
        maxPointerRate={maxPointerRate}
        style={sliderRail.style}
      >
        {channel === 'c' && markerMode === 'auto' ? <ChromaMarkers /> : null}
      </ColorSlider>
    </div>
  );
}
