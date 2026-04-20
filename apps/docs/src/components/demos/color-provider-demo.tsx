import {
  Background,
  Color,
  ColorArea,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  useColorContext,
} from 'color-kit/react';
import { useMemo } from 'react';
import { ContextDisplaySwatch, getOklchSliderRail } from './shared.js';

function ColorProviderDemoContent() {
  const color = useColorContext();
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
      <ColorArea className="ck-color-area">
        <Background checkerboard />
        <ColorPlane />
      </ColorArea>
      <ColorSlider
        channel="h"
        className="ck-slider ck-slider-v2"
        data-color-space={hueRail.colorSpace}
        style={hueRail.style}
      />
      <ColorSlider
        channel="alpha"
        className="ck-slider ck-slider-v2"
        data-color-space={alphaRail.colorSpace}
        style={alphaRail.style}
      />
      <div className="ck-row">
        <ColorStringInput className="ck-input" />
        <ContextDisplaySwatch className="ck-color-display" />
      </div>
    </div>
  );
}

export function ColorProviderDemo() {
  return (
    <Color defaultColor="#3b82f6">
      <ColorProviderDemoContent />
    </Color>
  );
}
