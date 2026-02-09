import { parse, toCss } from '@color-kit/core';
import {
  AlphaSlider,
  ColorArea,
  ColorDisplay,
  ColorInput,
  ColorProvider,
  ColorSlider,
  ContrastBadge,
  HueSlider,
  Swatch,
  SwatchGroup,
  useColor,
} from '@color-kit/react';
import { useState } from 'react';

const DOC_SWATCHES = [
  '#fb7185',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
].map((value) => parse(value));

const HUE_GRADIENT =
  'linear-gradient(90deg, #ff0040 0%, #ffa500 16%, #f7f700 33%, #00c950 50%, #00b7ff 66%, #364dff 82%, #ff00b7 100%)';

const ALPHA_GRADIENT =
  'linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 1))';

const SATURATION_GRADIENT =
  'linear-gradient(90deg, oklch(0.65 0 255), oklch(0.65 0.34 255))';

const AREA_GRADIENT =
  'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0)), linear-gradient(to right, #ffffff, #3b82f6)';

export function ColorProviderDemo() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <div className="ck-demo-stack">
        <ColorArea className="ck-color-area" style={{ background: AREA_GRADIENT }} />
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <AlphaSlider className="ck-slider" style={{ background: ALPHA_GRADIENT }} />
        <div className="ck-row">
          <ColorInput className="ck-input" />
          <ColorDisplay className="ck-color-display" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function ColorAreaDemo() {
  return (
    <ColorProvider defaultColor="#2563eb">
      <div className="ck-demo-stack">
        <ColorArea className="ck-color-area" style={{ background: AREA_GRADIENT }} />
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <ColorInput className="ck-input" />
      </div>
    </ColorProvider>
  );
}

export function ColorSliderDemo() {
  return (
    <ColorProvider defaultColor="#8b5cf6">
      <div className="ck-demo-stack">
        <ColorSlider
          channel="c"
          className="ck-slider"
          style={{ background: SATURATION_GRADIENT }}
        />
        <ColorSlider
          channel="l"
          className="ck-slider"
          style={{ background: 'linear-gradient(90deg, #0f172a, #f8fafc)' }}
        />
        <ColorInput format="oklch" className="ck-input" />
      </div>
    </ColorProvider>
  );
}

export function HueSliderDemo() {
  return (
    <ColorProvider defaultColor="#ef4444">
      <div className="ck-demo-stack">
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <div className="ck-row">
          <ColorDisplay className="ck-color-display" />
          <ColorInput className="ck-input" />
        </div>
      </div>
    </ColorProvider>
  );
}

export function AlphaSliderDemo() {
  return (
    <ColorProvider defaultColor="oklch(0.72 0.2 220 / 0.65)">
      <div className="ck-demo-stack">
        <ColorDisplay className="ck-color-display ck-checker" />
        <AlphaSlider className="ck-slider" style={{ background: ALPHA_GRADIENT }} />
        <ColorInput format="rgb" className="ck-input" />
      </div>
    </ColorProvider>
  );
}

export function SwatchDemo() {
  const [selectedIndex, setSelectedIndex] = useState(2);

  return (
    <div className="ck-demo-stack">
      <div className="ck-swatch-row" role="listbox" aria-label="Color options">
        {DOC_SWATCHES.map((color, index) => (
          <Swatch
            key={`${index}-${toCss(color, 'hex')}`}
            className="ck-swatch"
            color={color}
            isSelected={selectedIndex === index}
            onSelect={() => setSelectedIndex(index)}
            aria-label={`Select ${toCss(color, 'hex')}`}
            role="option"
            aria-selected={selectedIndex === index}
          />
        ))}
      </div>
      <div className="ck-caption">Selected: {toCss(DOC_SWATCHES[selectedIndex], 'hex')}</div>
    </div>
  );
}

export function SwatchGroupDemo() {
  return (
    <ColorProvider defaultColor="#22c55e">
      <div className="ck-demo-stack">
        <SwatchGroup colors={DOC_SWATCHES} columns={4} className="ck-swatch-grid" />
        <ColorInput className="ck-input" />
      </div>
    </ColorProvider>
  );
}

export function ColorInputDemo() {
  const colorState = useColor({ defaultColor: '#6366f1' });

  return (
    <div className="ck-demo-stack">
      <ColorInput
        className="ck-input"
        format="hex"
        color={colorState.color}
        onChange={colorState.setColor}
      />
      <ColorInput
        className="ck-input"
        format="oklch"
        color={colorState.color}
        onChange={colorState.setColor}
      />
      <ColorDisplay className="ck-color-display" color={colorState.color} />
    </div>
  );
}

export function ColorDisplayDemo() {
  return (
    <ColorProvider defaultColor="#10b981">
      <div className="ck-demo-stack">
        <ColorDisplay className="ck-color-display" />
        <HueSlider className="ck-slider" style={{ background: HUE_GRADIENT }} />
        <AlphaSlider className="ck-slider" style={{ background: ALPHA_GRADIENT }} />
      </div>
    </ColorProvider>
  );
}

export function ContrastBadgeDemo() {
  const foreground = useColor({ defaultColor: '#111827' });
  const background = useColor({ defaultColor: '#f8fafc' });

  return (
    <div className="ck-demo-stack">
      <div className="ck-row">
        <ColorInput
          className="ck-input"
          format="hex"
          color={foreground.color}
          onChange={foreground.setColor}
          aria-label="Foreground color"
        />
        <ColorInput
          className="ck-input"
          format="hex"
          color={background.color}
          onChange={background.setColor}
          aria-label="Background color"
        />
      </div>
      <div
        className="ck-contrast-sample"
        style={{
          color: toCss(foreground.color, 'rgb'),
          backgroundColor: toCss(background.color, 'rgb'),
        }}
      >
        The quick brown fox jumps over the lazy dog.
      </div>
      <ContrastBadge
        className="ck-contrast-badge"
        foreground={foreground.color}
        background={background.color}
        level="AA"
      />
    </div>
  );
}
