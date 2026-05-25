import type { ColorInputChannelFor, ColorInputSpec } from './color-input.js';

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
  IsEqual<ColorInputChannelFor<'rgb'>, 'r' | 'g' | 'b' | 'alpha'>
>;
export type _HslChannelsAreCorrelated = Assert<
  IsEqual<ColorInputChannelFor<'hsl'>, 'h' | 's' | 'l' | 'alpha'>
>;
export type _OklchChannelsAreCorrelated = Assert<
  IsEqual<ColorInputChannelFor<'oklch'>, 'l' | 'c' | 'h' | 'alpha'>
>;

export type _RgbSpecAcceptsRgbChannel = Assert<
  IsAssignable<{ model: 'rgb'; channel: 'r' }, ColorInputSpec<'rgb'>>
>;
export type _HslSpecAcceptsHslChannel = Assert<
  IsAssignable<{ model: 'hsl'; channel: 's' }, ColorInputSpec<'hsl'>>
>;
export type _OklchSpecAcceptsOklchChannel = Assert<
  IsAssignable<{ model: 'oklch'; channel: 'c' }, ColorInputSpec<'oklch'>>
>;

export type _RgbRejectsOklchLightness = AssertFalse<
  IsAssignable<'l', ColorInputChannelFor<'rgb'>>
>;
export type _HslRejectsRgbBlue = AssertFalse<
  IsAssignable<'b', ColorInputChannelFor<'hsl'>>
>;
export type _OklchRejectsRgbRed = AssertFalse<
  IsAssignable<'r', ColorInputChannelFor<'oklch'>>
>;
export type _RgbSpecRejectsHueChannel = AssertFalse<
  IsAssignable<{ model: 'rgb'; channel: 'h' }, ColorInputSpec<'rgb'>>
>;
