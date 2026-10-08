/**
 * The slice of the generated API model that the route registry, sidebar and
 * search need. S2 writes the full model to `src/generated/api.json`; the
 * `?api-routes` import (see `plugins/route-data.ts`) projects it down to this
 * shape at build time, so the main bundle never carries the full model.
 *
 * Until `api.json` exists, `API_ROUTE_FIXTURE` stands in: every entry point,
 * no symbols.
 */
export interface ApiRouteSymbol {
  /** Exported name, case preserved: `/api/core/Color` ≠ `/api/react/Color`. */
  name: string;
  /** TypeDoc-style kind label, e.g. `function`, `interface`, `type`. */
  kind: string;
  /** First sentence of the JSDoc summary, plain text. */
  summary?: string;
  /** Domain group within the entry (`conversion`, `gamut`, …) for the nav tree. */
  group?: string;
}

export interface ApiRouteEntry {
  /** URL slug: `core`, `plane`, `interop`, `compute`, `hct`, `driver`, `react`. */
  slug: string;
  /** Display title, e.g. `color-kit` for core and `color-kit/plane` for plane. */
  title: string;
  /** The specifier users write: `color-kit`, `color-kit/plane`, … */
  importPath: string;
  summary?: string;
  /** Symbols whose canonical home is this entry, in display order. */
  symbols: ApiRouteSymbol[];
}

export interface ApiRouteIndex {
  /** Entry points in package order. */
  entries: ApiRouteEntry[];
}

/** Entry points in package order, as published by `packages/color-kit`. */
export const API_ROUTE_FIXTURE: ApiRouteIndex = {
  entries: [
    {
      slug: 'core',
      title: 'color-kit',
      importPath: 'color-kit',
      summary:
        'Conversion, contrast, gamut mapping, harmony and manipulation, OKLCH-canonical.',
      symbols: [],
    },
    {
      slug: 'plane',
      title: 'color-kit/plane',
      importPath: 'color-kit/plane',
      summary: 'Define 2D color planes and query their regions and boundaries.',
      symbols: [],
    },
    {
      slug: 'interop',
      title: 'color-kit/interop',
      importPath: 'color-kit/interop',
      summary: 'Packed buffers and zero-allocation writers for canvas and GPU.',
      symbols: [],
    },
    {
      slug: 'compute',
      title: 'color-kit/compute',
      importPath: 'color-kit/compute',
      summary: 'Schedule plane compute on the JS backend, with telemetry.',
      symbols: [],
    },
    {
      slug: 'hct',
      title: 'color-kit/hct',
      importPath: 'color-kit/hct',
      summary: 'Material HCT conversion and tonal palettes.',
      symbols: [],
    },
    {
      slug: 'driver',
      title: 'color-kit/driver',
      importPath: 'color-kit/driver',
      summary: 'Headless picker state for any UI framework.',
      symbols: [],
    },
    {
      slug: 'react',
      title: 'color-kit/react',
      importPath: 'color-kit/react',
      summary:
        'React primitives: ColorArea, ColorSlider, ColorInput and hooks.',
      symbols: [],
    },
  ],
};

const generated = import.meta.glob<ApiRouteIndex>('../generated/api.json', {
  eager: true,
  query: '?api-routes',
  import: 'default',
});

/**
 * The API route index: generated data when present, otherwise the fixture.
 * Generated entries without a matching fixture entry are kept; fixture
 * entries missing from the generated data are kept too, so the nav never
 * loses an entry point while S2's generator is being built.
 */
export function loadApiRouteIndex(): ApiRouteIndex {
  const data = Object.values(generated)[0];
  if (!data || data.entries.length === 0) {
    return API_ROUTE_FIXTURE;
  }
  const bySlug = new Map(data.entries.map((entry) => [entry.slug, entry]));
  const ordered = API_ROUTE_FIXTURE.entries.map(
    (entry) => bySlug.get(entry.slug) ?? entry,
  );
  const extra = data.entries.filter(
    (entry) => !API_ROUTE_FIXTURE.entries.some((e) => e.slug === entry.slug),
  );
  return { entries: [...ordered, ...extra] };
}
