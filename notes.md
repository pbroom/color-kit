# Notes

## Ideals

- Use OKLAB/OKLCH D65 in the CSS reference range as the source of truth
- Support color models:
  - OKLCH
  - OKLAB
  - HSL
  - HSV/HSB
  - Hex
  - RGB
  - HCT
  - CMYK simulation?
- Accurate presentation
  - Hue sliders should be accurate to their color models (oklch hue at 0 is not the same as hsl hue at 0)
    - The easiest way to get a gradient for a hue slider normally is to define an rgb gradient with stops at rgb(1,0,0), rgb(1,1,0), rgb(0,1,0), rgb(0,1,1), rgb(0,0,1), rgb(1,0,1), and then finally rgb(1,0,0) again to close the loop. You can also do hsl(0,100%,100%), hsl(60,100%,100%), hsl(120,100%,100%), hsl(180,100%,100%), hsl(240,100%,100%), hsl(300,100%,100%), and then finally hsl(360,100%,100%).
    - For OKLCH, you have to take an even sampling of the hue circle, but then find the maximum chroma value for each given hue and the lightness value it exists at, and then use those values to create a gradient.
  - ColorArea channels should map accurately to their axes.
- Screaming fast performance for color calculations and seamless smooth interactivity
- Use culori until we can use something faster
- All components pass thorough accessibility tests
- Maintain the highest possible color precision at all times. The stored precision doesn't change when changing views or switching color models. Precision is only lost when the user explicitely chooses a lower-precision color.
- Gentle, clear communication for correction vs. hard limits. Handles/stops/thumbs only move via user direction or accessibility requirment. Examples:
  - When the user changes a lightness value to zero, the other channels should not change. It doesn't matter to the user that black has no hue, saturation, or chroma value (or at least that they would normally default to zero). The controls for the other channels should remain where they are, as if they were physical sliders or knobs. If the hue is set to #00FF00, a saturation slider should show green as the hue for its saturation gradient. Likewise, a lightness + chroma color area would show green as its hue, regardless of where the thumb is placed.
  - Show the actual value for chroma in addition to the thumb if they are different. This Figma mockup shows how the chroma slider thumb is allowed to rest wherever the user places it while also showing the actual values for the displayed chroma and the max possible chromas for the given lightness+hue and hue. https://www.figma.com/design/LsKRJGa3DdtITEfQ5d8H7v/Plexiform?node-id=890-6031&t=StAXfudPUlXVSB0c-11
  - When the user selects a point like oklch(0.5 .38 200), the thumb for the color area (y mapping to C and x mapping to L), the thumb should rest at the correct coordinate, outside the gamut. The loupe center or inkwell of the thumb should show the fallback color. Fallback indicators styled like a mini-thumbs should show where the actual chroma values fall on the color area.

| OKLAB Channel | CSS Reference Range | Description           |
| ------------- | ------------------- | --------------------- |
| `l`           | `[0, 1]`            | Lightness             |
| `a`           | `[-0.4, 0.4]`       | Green–red component   |
| `b`           | `[-0.4, 0.4]`       | Blue–yellow component |

| OKLCH Channel | Range      | Description |
| ------------- | ---------- | ----------- |
| `l`           | `[0, 1]`   | Lightness   |
| `c`           | `[0, 0.4]` | Chroma      |
| `h`           | `[0, 360]` | Hue         |

## API

- Store a color
- Manage multiple colors in various models
- Manage color state
- Convert a color
- Produce paths and regions for WCAG contrast zones
- Produce paths and regions for P3 and sRGB gamut boundaries
- Calculate fallback colors for out-of-gamut selections while maintaining the user-selected (or "requested") color

## Components

- Color // provider component
- Gradient
  - Gradient Stop
- Slider
- Dial
- Area
  - Background // convenience wrapper around layer
  - ColorPlane // Canvas for rendering P3 color using shaders
  - Layer // composable container layer
  - Point // container for fallback indicators and markers with labels
  - Line // SVG line for boundaries and contrast lines
  - Thumb // input element
- Swatch
- Swatch group
- Input
- Bezier Curves Editor
- Eyedropper
- Histogram
- 3d color space viewer

## Tests
