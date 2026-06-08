import { readFile } from 'node:fs/promises';

const COLOR_INPUT_SOURCE = 'registry/components/color-input.tsx';
const REGISTRY_MANIFEST = 'registry/registry.json';
const CONTROL_KIT_REGISTRY_DEPENDENCY =
  '@color-kit/control-kit@github:pbroom/control-kit#b9cd2cbb9427707f10751a694bb3c9ac8b5f7289';

function findMissingValues(source, values) {
  return values.filter((value) => !source.includes(value));
}

async function main() {
  const errors = [];
  const [colorInputSource, registryRaw] = await Promise.all([
    readFile(COLOR_INPUT_SOURCE, 'utf8'),
    readFile(REGISTRY_MANIFEST, 'utf8'),
  ]);
  const registry = JSON.parse(registryRaw);
  const colorInputEntry = registry.items?.find(
    (item) => item.name === 'color-input',
  );

  if (!colorInputEntry) {
    errors.push(`${REGISTRY_MANIFEST}: missing color-input item`);
  }

  if (
    colorInputEntry &&
    !colorInputEntry.registryDependencies?.includes('color')
  ) {
    errors.push(
      `${REGISTRY_MANIFEST}: color-input must depend on the registry color provider`,
    );
  }

  if (
    colorInputEntry &&
    !colorInputEntry.dependencies?.includes(CONTROL_KIT_REGISTRY_DEPENDENCY)
  ) {
    errors.push(
      `${REGISTRY_MANIFEST}: color-input must install pinned @color-kit/control-kit from the standalone repo`,
    );
  }

  if (!/from ['"]@color-kit\/control-kit['"]/.test(colorInputSource)) {
    errors.push(
      `${COLOR_INPUT_SOURCE}: must import primitive input behavior from @color-kit/control-kit`,
    );
  }

  if (!/from ['"]color-kit\/react['"]/.test(colorInputSource)) {
    errors.push(
      `${COLOR_INPUT_SOURCE}: must import color input API helpers from color-kit/react`,
    );
  }

  const requiredColorApiHelpers = [
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
  for (const missing of findMissingValues(
    colorInputSource,
    requiredColorApiHelpers,
  )) {
    errors.push(`${COLOR_INPUT_SOURCE}: missing ${missing}`);
  }

  const bannedForkMarkers = [
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
  for (const marker of bannedForkMarkers) {
    if (colorInputSource.includes(marker)) {
      errors.push(`${COLOR_INPUT_SOURCE}: contains fork marker ${marker}`);
    }
  }

  const lineCount = colorInputSource.split('\n').length;
  if (lineCount > 500) {
    errors.push(
      `${COLOR_INPUT_SOURCE}: expected a thin registry adapter, found ${lineCount} lines`,
    );
  }

  if (errors.length > 0) {
    console.error('Registry sync guard failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Registry sync guard passed.');
}

await main();
