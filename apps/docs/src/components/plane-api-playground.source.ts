import demoSourceRaw from './plane-api-playground.demo.tsx?raw';
import labSourceRaw from './plane-api-playground-lab.demo.tsx?raw';

const SANDBOX_PACKAGE_ROOT = '/node_modules/color-kit';
const SANDBOX_PACKAGE_ENTRY = '../../color-kit-core/index.ts' as const;

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
export const planeApiPlaygroundSandboxPackageEntrySource = `export * from '${SANDBOX_PACKAGE_ENTRY}';`;

function trimBlankEdges(text: string): string {
  return text.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
}

export const planeApiPlaygroundSource = trimBlankEdges(
  demoSourceRaw.replace(/\r\n/g, '\n'),
);

export const planeApiPlaygroundLabSource = trimBlankEdges(
  labSourceRaw.replace(/\r\n/g, '\n'),
);
