# Notes

## Strategy

- Use OKLAB/OKLCH as the source of truth
- Support
  - OKLCH
  - OKLAB
  - HSL
  - HSV/HSB
  - Hex
  - RGB

| OKLAB Channel | CSS Reference Range | Description |
|--------------|---------------------|-------------|
| `l` | `[0, 1]` | Lightness |
| `a` | `[-0.4, 0.4]` | Green–red component |
| `b` | `[-0.4, 0.4]` | Blue–yellow component |

| OKLCH Channel | Range | Description |
|---------------|-------|-------------|
| `l` | `[0, 1]` | Lightness |
| `c` | `[0, 0.4]` | Chroma |
| `h` | `[0, 360]` | Hue |

## API

- Store a color
- Manage multiple colors in various models
- Manage color state
- Convert a color
- 

## Components

- Color // provider component
- Slider
- Area
- Swatch
- Input
- Histogram
- Model