import type {
  ColorModelChannelFor,
  ColorChannelSpec,
} from './color-channel.js';

type IsEqual<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <
    Value,
  >() => Value extends Expected ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type AssertFalse<Condition extends false> = Condition;
type IsAssignable<Actual, Expected> = Actual extends Expected ? true : false;

export type _RgbChannelsAreCorrelated = Assert<
  IsEqual<ColorModelChannelFor<'rgb'>, 'r' | 'g' | 'b' | 'alpha'>
>;
export type _HslChannelsAreCorrelated = Assert<
  IsEqual<ColorModelChannelFor<'hsl'>, 'h' | 's' | 'l' | 'alpha'>
>;
export type _OklchChannelsAreCorrelated = Assert<
  IsEqual<ColorModelChannelFor<'oklch'>, 'l' | 'c' | 'h' | 'alpha'>
>;

export type _RgbSpecAcceptsRgbChannel = Assert<
  IsAssignable<{ model: 'rgb'; channel: 'r' }, ColorChannelSpec<'rgb'>>
>;
export type _HslSpecAcceptsHslChannel = Assert<
  IsAssignable<{ model: 'hsl'; channel: 's' }, ColorChannelSpec<'hsl'>>
>;
export type _OklchSpecAcceptsOklchChannel = Assert<
  IsAssignable<{ model: 'oklch'; channel: 'c' }, ColorChannelSpec<'oklch'>>
>;

export type _RgbRejectsOklchLightness = AssertFalse<
  IsAssignable<'l', ColorModelChannelFor<'rgb'>>
>;
export type _HslRejectsRgbBlue = AssertFalse<
  IsAssignable<'b', ColorModelChannelFor<'hsl'>>
>;
export type _OklchRejectsRgbRed = AssertFalse<
  IsAssignable<'r', ColorModelChannelFor<'oklch'>>
>;
export type _RgbSpecRejectsHueChannel = AssertFalse<
  IsAssignable<{ model: 'rgb'; channel: 'h' }, ColorChannelSpec<'rgb'>>
>;
