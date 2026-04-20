const SANDBOX_PACKAGE_ROOT = '/node_modules/color-kit';

export const planeApiPlaygroundSandboxPackageJsonFile = `${SANDBOX_PACKAGE_ROOT}/package.json`;
export const planeApiPlaygroundSandboxPackageJsonSource = JSON.stringify(
  {
    name: 'color-kit',
    private: true,
    type: 'module',
    main: './index.js',
    module: './index.js',
    exports: {
      '.': {
        default: './index.js',
      },
      './core': {
        default: './index.js',
      },
    },
  },
  null,
  2,
);
export const planeApiPlaygroundSandboxPackageEntryFile = `${SANDBOX_PACKAGE_ROOT}/index.js`;
export const planeApiPlaygroundSandboxPackageEntrySource = `export {
  definePlane,
  inspectPlaneQuery,
  sense,
  toSvgCompoundPath,
  toSvgPath,
} from '../../color-kit-core/plane/index.ts';
export type { PlaneQueryTraceStage } from '../../color-kit-core/plane/index.ts';
export { parse } from '../../color-kit-core/conversion/index.ts';`;

function trimBlankEdges(text: string): string {
  return text.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
}

export function loadPlaneApiPlaygroundSource(): Promise<string> {
  return import('./plane-api-playground.demo.tsx?raw').then(
    ({ default: source }) => trimBlankEdges(source.replace(/\r\n/g, '\n')),
  );
}

export function loadPlaneApiPlaygroundLabSource(): Promise<string> {
  return import('./plane-api-playground-lab.demo.tsx?raw').then(
    ({ default: source }) => trimBlankEdges(source.replace(/\r\n/g, '\n')),
  );
}
