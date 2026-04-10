import {
  ChromaMarkers,
  Color,
  ColorInput,
  ColorSlider,
  ColorStringInput,
  useColor,
  useColorContext,
} from 'color-kit/react';
import { useEffect, useMemo, useRef } from 'react';
import { useOptionalDocsInspector } from '../docs-inspector-context.js';
import {
  ContextDisplaySwatch,
  DemoDisplaySwatch,
  getOklchSliderRail,
} from './shared.js';

export function ColorSliderDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state =
    inspectorDriven && inspector ? inspector.colorSliderState : null;
  const channel = state?.channel ?? 'c';
  const color = useColor({
    defaultColor: '#8b5cf6',
    defaultGamut: state?.gamut ?? 'display-p3',
  });
  const sliderGamut = state?.gamut;
  const sliderGamutSetterRef = useRef(color.setActiveGamut);

  useEffect(() => {
    sliderGamutSetterRef.current = color.setActiveGamut;
  }, [color.setActiveGamut]);

  useEffect(() => {
    if (!sliderGamut) return;
    if (color.activeGamut === sliderGamut) return;
    sliderGamutSetterRef.current(sliderGamut, 'programmatic');
  }, [sliderGamut, color.activeGamut]);

  const sliderRail = useMemo(
    () => getOklchSliderRail(channel, color.requested, color.activeGamut),
    [channel, color.activeGamut, color.requested],
  );
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorSlider
        channel={channel}
        className="ck-slider ck-slider-v2"
        data-color-space={sliderRail.colorSpace}
        requested={color.requested}
        onChangeRequested={color.setRequested}
        style={sliderRail.style}
      >
        {channel === 'c' ? <ChromaMarkers /> : null}
      </ColorSlider>
      <ColorInput
        model="oklch"
        channel={channel}
        className="ck-input"
        requested={color.requested}
        onChangeRequested={color.setRequested}
      />
      <DemoDisplaySwatch
        className="ck-color-display"
        requested={color.requested}
        gamut={color.activeGamut}
      />
      {inspectorDriven ? (
        <>
          <ColorSlider
            channel="h"
            className="ck-slider ck-slider-v2"
            data-color-space={hueRail.colorSpace}
            requested={color.requested}
            onChangeRequested={color.setRequested}
            style={hueRail.style}
          />
          <ColorSlider
            channel="alpha"
            className="ck-slider ck-slider-v2"
            data-color-space={alphaRail.colorSpace}
            requested={color.requested}
            onChangeRequested={color.setRequested}
            style={alphaRail.style}
          />
        </>
      ) : null}
    </div>
  );
}

function ColorSliderHueDemoContent() {
  const color = useColorContext();
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <div className="ck-row">
        <ContextDisplaySwatch className="ck-color-display" />
        <ColorStringInput className="ck-input" />
      </div>
    </div>
  );
}

export function ColorSliderHueDemo() {
  return (
    <Color defaultColor="#ef4444">
      <ColorSliderHueDemoContent />
    </Color>
  );
}

function ColorSliderAlphaDemoContent() {
  const color = useColorContext();
  const alphaRail = useMemo(
    () => getOklchSliderRail('alpha', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );

  return (
    <div className="ck-demo-stack">
      <ContextDisplaySwatch className="ck-color-display ck-checker" />
      <ColorSlider
        channel="alpha"
        className="ck-slider ck-slider-v2"
        data-color-space={alphaRail.colorSpace}
        style={alphaRail.style}
      />
      <ColorInput model="oklch" channel="alpha" className="ck-input" />
    </div>
  );
}

export function ColorSliderAlphaDemo() {
  return (
    <Color defaultColor="oklch(0.72 0.2 220 / 0.65)">
      <ColorSliderAlphaDemoContent />
    </Color>
  );
}
