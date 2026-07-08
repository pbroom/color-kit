import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const COLOR_INPUT_SOURCE = 'registry/components/color-input.tsx';
export const REGISTRY_MANIFEST = 'registry/registry.json';
export const CONTROL_KIT_REGISTRY_DEPENDENCY =
  '@color-kit/control-kit@github:pbroom/control-kit#b9cd2cbb9427707f10751a694bb3c9ac8b5f7289';

export const REQUIRED_COLOR_API_HELPERS = [
  'ColorApi.colorFromColorInputChannelValue',
  'ColorApi.formatColorInputChannelValue',
  'ColorApi.getColorInputChangedChannel',
  'ColorApi.getColorInputChannelGlyph',
  'ColorApi.getColorInputChannelValue',
  'ColorApi.getColorInputLabel',
  'ColorApi.getColorInputPrecisionFromStep',
  'ColorApi.parseColorInputExpression',
  'ColorApi.resolveColorInputRange',
  'ColorApi.resolveColorInputSteps',
  'ColorApi.resolveColorInputWrap',
];

export const BANNED_FORK_MARKERS = [
  'COMMIT_NOOP_EPSILON',
  'InputSelectionSnapshot',
  'ReactKeyboardEvent',
  'ScrubSnapshot',
  'parseExpressionValue',
  'resolvePointerClientX',
  'tokenizeExpression',
  'useLayoutEffect',
  'useRef',
  'useState',
  'onPointerDown={',
  'onPointerMove={',
];

export function findMissingValues(source, values) {
  return values.filter((value) => !source.includes(value));
}

export function validateRegistrySync({
  colorInputSource,
  registry,
  colorInputPath = COLOR_INPUT_SOURCE,
  registryManifestPath = REGISTRY_MANIFEST,
}) {
  const errors = [];
  const colorInputEntry = registry.items?.find(
    (item) => item.name === 'color-input',
  );

  if (!colorInputEntry) {
    errors.push(`${registryManifestPath}: missing color-input item`);
  }

  if (
    colorInputEntry &&
    !colorInputEntry.registryDependencies?.includes('color')
  ) {
    errors.push(
      `${registryManifestPath}: color-input must depend on the registry color provider`,
    );
  }

  if (
    colorInputEntry &&
    !colorInputEntry.dependencies?.includes(CONTROL_KIT_REGISTRY_DEPENDENCY)
  ) {
    errors.push(
      `${registryManifestPath}: color-input must install pinned @color-kit/control-kit from the standalone repo`,
    );
  }

  if (!/from ['"]@color-kit\/control-kit['"]/.test(colorInputSource)) {
    errors.push(
      `${colorInputPath}: must import primitive input behavior from @color-kit/control-kit`,
    );
  }

  if (!/from ['"]color-kit\/driver['"]/.test(colorInputSource)) {
    errors.push(
      `${colorInputPath}: must import color input API helpers from color-kit/driver`,
    );
  }

  if (/from ['"]@?color-kit\/react['"]/.test(colorInputSource)) {
    errors.push(
      `${colorInputPath}: must not import from color-kit/react (or @color-kit/react); the adapter consumes color-kit/driver and local hooks only`,
    );
  }

  for (const missing of findMissingValues(
    colorInputSource,
    REQUIRED_COLOR_API_HELPERS,
  )) {
    errors.push(`${colorInputPath}: missing ${missing}`);
  }

  for (const marker of BANNED_FORK_MARKERS) {
    if (colorInputSource.includes(marker)) {
      errors.push(`${colorInputPath}: contains fork marker ${marker}`);
    }
  }

  const lineCount = colorInputSource.split('\n').length;
  if (lineCount > 500) {
    errors.push(
      `${colorInputPath}: expected a thin registry adapter, found ${lineCount} lines`,
    );
  }

  return errors;
}

export async function readRegistrySyncInputs({
  colorInputPath = COLOR_INPUT_SOURCE,
  registryManifestPath = REGISTRY_MANIFEST,
} = {}) {
  const [colorInputSource, registryRaw] = await Promise.all([
    readFile(colorInputPath, 'utf8'),
    readFile(registryManifestPath, 'utf8'),
  ]);

  return {
    colorInputPath,
    registryManifestPath,
    colorInputSource,
    registry: JSON.parse(registryRaw),
  };
}

export async function main() {
  const errors = validateRegistrySync(await readRegistrySyncInputs());

  if (errors.length > 0) {
    console.error('Registry sync guard failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Registry sync guard passed.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
