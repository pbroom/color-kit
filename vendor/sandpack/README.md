# Vendored Sandpack

This directory vendors the patched Sandpack packages used by the Plane API playground in `apps/docs`.

Source snapshot:
- upstream base: `codesandbox/sandpack` `v2.20.0`
- validated local source: `sandunpack/vendor/sandpack`

Included packages:
- `@codesandbox/sandpack-client@2.19.8`
- `@codesandbox/sandpack-react@2.20.0`
- `@codesandbox/sandpack-themes@2.0.21`

Local notes:
- the vendored snapshot includes the Sandpack fixes validated against the `color-kit` Plane API playground
- the preview remount recovery fix has been proposed upstream in `codesandbox/sandpack#1297`
- `vendor/sandpack/sandpack-react/package.json` points `@codesandbox/sandpack-client` at the local vendored sibling so installs stay self-contained

Refresh workflow:
1. Update the validated Sandpack snapshot in the separate `sandunpack` workspace.
2. Rebuild the affected Sandpack packages there.
3. Copy each package's `dist`, `package.json`, and `README.md` into this directory, and keep `LICENSE` in sync.
