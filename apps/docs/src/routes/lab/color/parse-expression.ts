import type { PrimitiveExpressionParser } from '@color-kit/control-kit';
import * as ColorApi from 'color-kit/driver';

export const parsePrimitiveExpression: PrimitiveExpressionParser = (
  draft,
  options,
) => ColorApi.parseColorInputExpression(draft, options);
