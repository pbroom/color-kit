import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTROL_KIT_REGISTRY_DEPENDENCY,
  REQUIRED_COLOR_API_HELPERS,
  validateRegistrySync,
} from './check-registry-sync.mjs';

function makeRegistry(overrides = {}) {
  return {
    items: [
      {
        name: 'color-input',
        registryDependencies: ['color'],
        dependencies: [CONTROL_KIT_REGISTRY_DEPENDENCY],
        ...overrides,
      },
    ],
  };
}

function makeColorInputSource(extraLines = []) {
  return [
    "import { PrimitiveValueInput } from '@color-kit/control-kit';",
    "import { ColorApi } from 'color-kit/driver';",
    ...REQUIRED_COLOR_API_HELPERS.map((helper) => `void ${helper};`),
    ...extraLines,
  ].join('\n');
}

test('accepts the driver-only registry adapter contract', () => {
  assert.deepEqual(
    validateRegistrySync({
      colorInputSource: makeColorInputSource(),
      registry: makeRegistry(),
    }),
    [],
  );
});

test('rejects registry adapters that still import from React entries', () => {
  for (const reactEntry of ['color-kit/react', '@color-kit/react']) {
    const errors = validateRegistrySync({
      colorInputSource: makeColorInputSource([
        `import { ColorApi as ReactColorApi } from '${reactEntry}';`,
      ]),
      registry: makeRegistry(),
    });

    assert.match(errors.join('\n'), /must not import from color-kit\/react/);
  }
});

test('rejects adapters that only partially cut over to the driver helpers', () => {
  const sourceWithoutDriverImport = makeColorInputSource().replace(
    "import { ColorApi } from 'color-kit/driver';",
    "import { ColorApi } from 'color-kit/react';",
  );

  const errors = validateRegistrySync({
    colorInputSource: sourceWithoutDriverImport,
    registry: makeRegistry(),
  });

  assert.match(
    errors.join('\n'),
    /must import color input API helpers from color-kit\/driver/,
  );
  assert.match(errors.join('\n'), /must not import from color-kit\/react/);
});

test('keeps registry dependency and helper coverage requirements active', () => {
  const errors = validateRegistrySync({
    colorInputSource: makeColorInputSource().replace(
      'ColorApi.resolveColorInputWrap',
      'ColorApi.someOtherHelper',
    ),
    registry: makeRegistry({ dependencies: [] }),
  });

  assert.match(
    errors.join('\n'),
    /must install pinned @color-kit\/control-kit/,
  );
  assert.match(errors.join('\n'), /missing ColorApi\.resolveColorInputWrap/);
});
