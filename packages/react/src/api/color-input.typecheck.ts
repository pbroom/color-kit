import {
  getColorInputChannelGlyph,
  getColorInputLabel,
  resolveColorInputRange,
  type ColorInputChannelFor,
  type ColorInputSpec,
} from './color-input.js';

type IsEqual<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <
    Value,
  >() => Value extends Expected ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;

export type _RgbChannelsAreCorrelated = Assert<
  IsEqual<ColorInputChannelFor<'rgb'>, 'r' | 'g' | 'b' | 'alpha'>
>;
export type _HslChannelsAreCorrelated = Assert<
  IsEqual<ColorInputChannelFor<'hsl'>, 'h' | 's' | 'l' | 'alpha'>
>;
export type _OklchChannelsAreCorrelated = Assert<
  IsEqual<ColorInputChannelFor<'oklch'>, 'l' | 'c' | 'h' | 'alpha'>
>;

const rgbSpec: ColorInputSpec<'rgb'> = { model: 'rgb', channel: 'r' };
const hslSpec: ColorInputSpec<'hsl'> = { model: 'hsl', channel: 's' };
const oklchSpec: ColorInputSpec<'oklch'> = {
  model: 'oklch',
  channel: 'c',
};

// @ts-expect-error RGB inputs do not expose OKLCH lightness.
getColorInputLabel('rgb', 'l');
// @ts-expect-error HSL inputs do not expose RGB blue.
resolveColorInputRange('hsl', 'b');
// @ts-expect-error OKLCH inputs do not expose RGB red.
getColorInputChannelGlyph('oklch', 'r');
// @ts-expect-error Discriminated specs reject model/channel mismatches.
const invalidRgbSpec: ColorInputSpec<'rgb'> = { model: 'rgb', channel: 'h' };

void rgbSpec;
void hslSpec;
void oklchSpec;
void invalidRgbSpec;
