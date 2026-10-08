---
'color-kit': patch
---

`ColorInput` and `ColorStringInput` (`color-kit/react`) now render `aria-label` only once. Before, a consumer's label was set on both the wrapper `div` and the inner input. Now `aria-label` and `aria-labelledby` go only to the inner input: the spinbutton for `ColorInput`, the textbox for `ColorStringInput`. A consumer label replaces the default (`'<channel label> value'` or `'Color value'`). When only `aria-labelledby` is given, the input gets no default `aria-label`.
