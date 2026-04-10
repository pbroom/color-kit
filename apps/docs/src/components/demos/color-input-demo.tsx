import { ColorInput, ColorStringInput, useColor } from 'color-kit/react';
import { useEffect } from 'react';
import { useOptionalDocsInspector } from '../docs-inspector-context.js';
import { DemoDisplaySwatch } from './shared.js';

export function ColorInputDemo({
  inspectorDriven = false,
}: {
  inspectorDriven?: boolean;
}) {
  const inspector = useOptionalDocsInspector();
  const state = inspectorDriven && inspector ? inspector.colorInputState : null;
  const colorState = useColor({ defaultColor: '#6366f1' });
  const inputModel = state?.model ?? 'oklch';
  const inputChannel = state?.channel ?? 'h';
  const inputGamut = state?.gamut;
  const setInputGamut = colorState.setActiveGamut;

  useEffect(() => {
    if (!inputGamut) return;
    setInputGamut(inputGamut, 'programmatic');
  }, [inputGamut, setInputGamut]);

  const primaryInput =
    inputModel === 'rgb' ? (
      <ColorInput
        className="ck-input"
        model="rgb"
        channel={
          inputChannel === 'r' ||
          inputChannel === 'g' ||
          inputChannel === 'b' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'r'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    ) : inputModel === 'hsl' ? (
      <ColorInput
        className="ck-input"
        model="hsl"
        channel={
          inputChannel === 'h' ||
          inputChannel === 's' ||
          inputChannel === 'l' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'h'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    ) : (
      <ColorInput
        className="ck-input"
        model="oklch"
        channel={
          inputChannel === 'l' ||
          inputChannel === 'c' ||
          inputChannel === 'h' ||
          inputChannel === 'alpha'
            ? inputChannel
            : 'h'
        }
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Primary channel input"
      />
    );

  return (
    <div className="ck-demo-stack">
      {primaryInput}
      <ColorStringInput
        className="ck-input"
        format="oklch"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Legacy string input"
      />
      <DemoDisplaySwatch
        className="ck-color-display"
        requested={colorState.requested}
        gamut={state?.gamut ?? 'display-p3'}
      />
    </div>
  );
}
