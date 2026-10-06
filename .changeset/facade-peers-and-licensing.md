---
'color-kit': minor
---

Trim the package's peer dependencies and stop shipping an entry that could not be installed.

- **Breaking:** the `color-kit/react/color-input` subpath is removed. `ColorInput` depends on `@color-kit/control-kit`, which is not published to npm, so the entry could not be used from the published package. It will return once control-kit is published. Importing it now fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- `@base-ui/react` and `radix-ui` are no longer listed as required peer dependencies. Nothing in the package imports them, so package managers no longer ask you to install them. The optional `@color-kit/control-kit` peer is gone too. `react` and `react-dom` remain optional peers for `color-kit/react`.
- The tarball now includes `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md`, which carries the Apache-2.0 notice for the bundled Material color utilities HCT solver.
