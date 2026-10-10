---
'color-kit': patch
---

Two fixes to how `color-kit/driver` channel inputs handle numbers:

- `parseColorInputExpression` (and through it `resolveColorInputDraftValue` and `ColorInput`) now treats every `%` number in an absolute expression as a position in the range, the same as a lone `50%`. Before, each percent was taken as a fraction of the span and `range[0]` was added once to the whole result, which was wrong when the range does not start at 0 and the expression multiplies or combines percents. On `[100, 200]`, `50% * 2` is now `300` (was `200`), and `50% + 10` stays `160`. Relative input such as `+10%` still adds a fraction of the span.
- `getColorInputPrecisionFromStep` returns `6`, the formatter's maximum, for steps finer than `1e-6`, such as `1e-9`. It used to return `0`, which showed tiny-step values as whole numbers.
