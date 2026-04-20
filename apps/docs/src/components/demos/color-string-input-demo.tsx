import { ColorStringInput, useColor } from 'color-kit/react';
import { DemoDisplaySwatch } from './shared.js';

export function ColorStringInputDemo() {
  const colorState = useColor({ defaultColor: '#6366f1' });

  return (
    <div className="ck-demo-stack">
      <ColorStringInput
        className="ck-input"
        format="hex"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="Hex string input"
      />
      <ColorStringInput
        className="ck-input"
        format="oklch"
        requested={colorState.requested}
        onChangeRequested={colorState.setRequested}
        aria-label="OKLCH string input"
      />
      <DemoDisplaySwatch
        className="ck-color-display"
        requested={colorState.requested}
        gamut={colorState.activeGamut}
      />
    </div>
  );
}
