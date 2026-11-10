---
'@pbroom/color-kit': minor
---

`@pbroom/color-kit/driver` keeps the color-specific channel math and drops the generic number-field helpers.

Why: the driver's "color input" family was left over from the removed `ColorInput` component. Expression parsing, draft handling and key stepping are number-field behavior and belong to a component library such as control-kit; reading and writing one channel of a color is color-kit's part.

Removed, with no replacement:

- `parseColorInputExpression` and `ParseColorInputExpressionOptions` (the math-expression parser), `ColorInputPrimitiveExpressionOptions`
- `resolveColorInputDraftValue` and `ResolveColorInputDraftValueOptions`
- `colorFromColorInputKey` and `ColorInputKey`
- `getColorInputChannelGlyph`
- `getColorInputPrecisionFromStep`

To step a channel from the keyboard, add a step from `resolveColorChannelSteps` to `getColorChannelValue`, pass the sum through `normalizeColorChannelValue`, and write it with `colorFromColorChannelValue`.

Renamed, with no aliases (behavior unchanged):

| Before                            | After                             |
| --------------------------------- | --------------------------------- |
| `getColorInputChannelValue`       | `getColorChannelValue`            |
| `colorFromColorInputChannelValue` | `colorFromColorChannelValue`      |
| `formatColorInputChannelValue`    | `formatColorChannelValue`         |
| `normalizeColorInputValue`        | `normalizeColorChannelValue`      |
| `resolveColorInputRange`          | `resolveColorChannelRange`        |
| `resolveColorInputWrap`           | `resolveColorChannelWrap`         |
| `resolveColorInputSteps`          | `resolveColorChannelSteps`        |
| `getColorInputLabel`              | `getColorChannelLabel`            |
| `getColorInputChangedChannel`     | `getChangedColorChannel`          |
| `COLOR_INPUT_DEFAULT_RANGES`      | `COLOR_CHANNEL_DEFAULT_RANGES`    |
| `ColorInputModel`                 | `ColorChannelModel`               |
| `ColorInputChannel`               | `ColorModelChannel`               |
| `ColorInputChannelFor`            | `ColorModelChannelFor`            |
| `OklchColorInputChannel`          | `OklchColorModelChannel`          |
| `RgbColorInputChannel`            | `RgbColorModelChannel`            |
| `HslColorInputChannel`            | `HslColorModelChannel`            |
| `ColorInputSpec`                  | `ColorChannelSpec`                |
| `ColorInputStepConfig`            | `ColorChannelStepConfig`          |
| `ResolveColorInputStepsOptions`   | `ResolveColorChannelStepsOptions` |

`ColorChannel` (the OKLCH channels of picker state) is unchanged; `ColorModelChannel` is a channel of any of the three models. The error for a channel that does not belong to its model now reads `Invalid color channel "…" for "…" model.`
