import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Declaration, declarationLines } from '@/components/api/declaration';
import { SymbolReference } from '@/components/api/symbol-reference';
import type { ApiSymbol } from './model';

const domainsDir = path.resolve('src/generated/api/domains');

/** Every generated symbol of an entry, across its categories' data parts. */
function readEntrySymbols(entry: string): ApiSymbol[] {
  const dir = path.join(domainsDir, entry);
  return readdirSync(dir).flatMap((domain) =>
    readdirSync(path.join(dir, domain)).flatMap(
      (file) =>
        JSON.parse(
          readFileSync(path.join(dir, domain, file), 'utf8'),
        ) as ApiSymbol[],
    ),
  );
}

function readSymbol(entry: string, name: string): ApiSymbol {
  const symbol = readEntrySymbols(entry).find((item) => item.name === name);
  if (!symbol) throw new Error(`${entry}/${name} is not generated`);
  return symbol;
}

function declarationText(symbol: ApiSymbol): string {
  return declarationLines(symbol)
    .map((block) =>
      block.map((line) => line.map((token) => token.text).join('')).join('\n'),
    )
    .join('\n');
}

describe('generated API declaration fidelity', () => {
  it('keeps the real WritableArrayLike numeric index signature', () => {
    const symbol = readSymbol('interop', 'WritableArrayLike');
    const index = symbol.members.find((member) => member.kind === 'index');
    expect(index).toMatchObject({
      readonly: false,
      type: { text: 'number' },
      indexParameter: { name: 'index', type: { text: 'number' } },
    });
    expect(declarationText(symbol)).toContain('[index: number]: number;');
    expect(declarationText(symbol)).toContain('readonly length: number;');
    expect(declarationText(symbol)).not.toContain('readonly [index');
  });

  it('renders readonly index signatures without changing their key or value', () => {
    const symbol = readSymbol('interop', 'WritableArrayLike');
    const index = symbol.members.find((member) => member.kind === 'index');
    expect(index).toBeDefined();
    index!.readonly = true;
    expect(declarationText(symbol)).toContain(
      'readonly [index: number]: number;',
    );
    expect(renderToStaticMarkup(<Declaration symbol={symbol} />)).toContain(
      'readonly',
    );
  });

  it('documents components with their props and hooks as functions', () => {
    const color = readSymbol('react', 'Color');
    expect(color.kind).toBe('component');
    expect(color.signatures).toHaveLength(1);
    expect(color.propsType).toBe('ColorProps');
    expect(color.members.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SymbolReference symbol={color} />
      </MemoryRouter>,
    );
    expect(html).toContain('id="Color-members"');
    expect(html).toContain('>Props</a>');
    for (const name of [
      'useColorPlaneRenderer',
      'useGamutBoundary',
      'useContrastRegion',
    ]) {
      expect(readSymbol('react', name).kind).toBe('function');
    }
    expect(readSymbol('react', 'ColorContext').kind).toBe('const');
  });

  it('every component declaration parameter link has a rendered target', () => {
    const components = readEntrySymbols('react').filter(
      (symbol) => symbol.kind === 'component',
    );
    expect(components.length).toBeGreaterThan(0);
    for (const symbol of components) {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <SymbolReference symbol={symbol} />
        </MemoryRouter>,
      );
      const ids = new Set(
        [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
      );
      const links = [...html.matchAll(/href="#([^"]+)"/g)]
        .map((match) => decodeURIComponent(match[1]!))
        .filter((id) => id.startsWith(`${symbol.name}-param-`));
      for (const link of links)
        expect(ids.has(link), `${symbol.name}: #${link}`).toBe(true);
    }
  });
});
