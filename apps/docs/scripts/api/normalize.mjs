// Step 2 of the API reference: TypeDoc's JSON (`.typedoc/api.json`) → the
// site's model (`src/generated/api.json` plus per-entry and per-symbol page
// files), typed by `src/api/model.ts`.
//
// - Entry points come from `packages/color-kit/package.json#exports`.
// - A declaration exported from several entries gets one page, in its
//   canonical entry: a subpath beats the root; among subpaths, the one whose
//   source folder holds the declaration, then the one exporting the most
//   from the same file, then package order. Other entries list it as a
//   re-export and the page lists them under "Also exported from".
// - Domains come from the source folder (or file, for flat packages).
// - Links (`{@link}`, type references) resolve to page paths here, so the
//   site never resolves anything at runtime.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { facadeRoot, repoRoot } from './entries.mjs';
import { firstSentence, parseFence, toRichText } from './rich-text.mjs';
import { createTypePrinter } from './types.mjs';

const KIND = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  Accessor: 262144,
  GetSignature: 524288,
  TypeAlias: 2097152,
  Reference: 4194304,
};

/**
 * Domain slugs that read better merged or renamed, per entry. Keys are the
 * raw source folder or file stem; anything not listed is used as is.
 */
const DOMAIN_ALIASES = {
  core: { utils: 'utilities' },
  plane: {
    'query-specs': 'queries',
    query: 'queries',
    'gamut-region': 'queries',
    'model-specs': 'models',
    compile: 'compile',
    resolve: 'compile',
    mapping: 'mapping',
    transforms: 'mapping',
    operations: 'operations',
    geometry: 'types',
    gamut: 'gamut',
    trace: 'tracing',
  },
  compute: {
    index: 'scheduling',
    scheduler: 'scheduling',
    backends: 'scheduling',
    pack: 'packing',
    unpack: 'packing',
    plane: 'packing',
    trace: 'types',
  },
  hct: { index: 'hct' },
  interop: { pack: 'buffers', readers: 'readers', writers: 'writers' },
  driver: {
    'color-input-parser': 'color-input',
    'color-display': 'color-state',
    'multi-color-state': 'multi-color',
  },
  react: {
    color: 'color',
    context: 'color',
    'color-store': 'color',
    'use-color': 'color',
    'use-multi-color': 'color',
    'use-color-plane-renderer': 'plane-renderer',
    'color-plane-raster': 'plane-renderer',
    'use-gamut-boundary': 'plane-geometry',
    'use-chroma-band': 'plane-geometry',
    'use-contrast-region': 'plane-geometry',
    'use-fallback-points': 'plane-geometry',
    'use-plane-line-query': 'plane-geometry',
    'plane-spec': 'plane-geometry',
    'plane-quality': 'plane-geometry',
    'use-adaptive-quality': 'performance',
  },
};

const DOMAIN_TITLES = {
  hct: 'HCT',
  utilities: 'Utilities',
  types: 'Types',
};

function domainTitle(slug) {
  return (
    DOMAIN_TITLES[slug] ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
  );
}

function readRepository() {
  const manifest = JSON.parse(
    readFileSync(path.join(facadeRoot, 'package.json'), 'utf8'),
  );
  const url = manifest.repository?.url ?? manifest.repository ?? '';
  return String(url)
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/');
}

function readCommit() {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'main';
  }
}

/** `Color` → `-color`; mirrors `symbolFileName` in src/api/model.ts. */
export function symbolFileName(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function symbolHref(entry, name) {
  return `/api/${entry}/${encodeURIComponent(name)}`;
}

/**
 * @param {object} options
 * @param {any} options.project TypeDoc JSON project.
 * @param {import('./entries.mjs').EntryPoint[]} options.entries
 * @param {(code: string, lang: string) => string} options.highlight
 */
export function normalize({ project, entries, highlight }) {
  const repository = readRepository();
  const commit = readCommit();

  // Every reflection by id, with its parent.
  const byId = new Map();
  const parentOf = new Map();
  const index = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'number') {
      byId.set(node.id, node);
      if (parent) parentOf.set(node.id, parent);
    }
    for (const key of [
      'children',
      'signatures',
      'parameters',
      'indexSignatures',
      'typeParameters',
    ]) {
      for (const child of node[key] ?? []) index(child, node);
    }
    if (node.getSignature) index(node.getSignature, node);
    if (node.setSignature) index(node.setSignature, node);
    if (node.type?.type === 'reflection') index(node.type.declaration, node);
  };
  index(project, null);

  const resolveReference = (node) => {
    let current = node;
    for (let i = 0; i < 10 && current?.kind === KIND.Reference; i++) {
      current = byId.get(current.target);
    }
    return current;
  };

  // Exports per entry, grouped by declaration identity.
  const modules = new Map(
    (project.children ?? []).map((module) => [module.name, module]),
  );
  /** @type {Map<number, {decl: any, exports: Array<{entry: any, name: string}>}>} */
  const decls = new Map();
  const exportsByEntry = new Map();
  for (const entry of entries) {
    const module = modules.get(entry.importPath);
    if (!module) {
      throw new Error(`TypeDoc produced no module for ${entry.importPath}.`);
    }
    const list = [];
    for (const child of module.children ?? []) {
      const decl = resolveReference(child);
      if (!decl) {
        throw new Error(
          `${entry.importPath}: cannot resolve the export ${child.name}.`,
        );
      }
      const record = decls.get(decl.id) ?? { decl, exports: [] };
      record.exports.push({ entry, name: child.name });
      decls.set(decl.id, record);
      list.push({ name: child.name, decl });
    }
    exportsByEntry.set(entry.slug, list);
  }

  const fileOf = (decl) => decl.sources?.[0]?.fileName ?? '';
  const affinity = (entry, file) =>
    exportsByEntry.get(entry.slug).filter(({ decl }) => fileOf(decl) === file)
      .length;
  const depthIfContains = (entry, file) =>
    file.startsWith(`${entry.sourceDir}/`)
      ? entry.sourceDir.split('/').length
      : 0;

  // Canonical home per declaration.
  /** @type {Map<number, {entry: any, name: string}>} */
  const canonical = new Map();
  for (const [id, { decl, exports }] of decls) {
    const file = fileOf(decl);
    const ranked = [...exports].sort((a, b) => {
      const root =
        Number(a.entry.subpath === '.') - Number(b.entry.subpath === '.');
      if (root !== 0) return root;
      const depth =
        depthIfContains(b.entry, file) - depthIfContains(a.entry, file);
      if (depth !== 0) return depth;
      const near = affinity(b.entry, file) - affinity(a.entry, file);
      if (near !== 0) return near;
      return a.entry.order - b.entry.order;
    });
    // Prefer the declared name when the canonical entry exports it twice.
    const home = ranked[0].entry;
    const names = ranked.filter((item) => item.entry === home);
    canonical.set(
      id,
      names.find((item) => item.name === decl.name) ?? names[0],
    );
  }

  const hrefForId = (id) => {
    let node = byId.get(id);
    if (node?.kind === KIND.Reference) node = resolveReference(node);
    let member = null;
    while (node) {
      const home = canonical.get(node.id);
      if (home) {
        const href = symbolHref(home.entry.slug, home.name);
        return member ? `${href}#prop-${member}` : href;
      }
      if (
        node.kind === KIND.Property ||
        node.kind === KIND.Method ||
        node.kind === KIND.Accessor
      ) {
        member = node.name;
      }
      node = parentOf.get(node.id);
    }
    return undefined;
  };

  const types = createTypePrinter(hrefForId);
  const richContext = {
    highlight,
    resolveLink(target, text) {
      if (typeof target === 'number') return hrefForId(target);
      if (typeof target === 'string' && /^https?:/.test(target)) return target;
      if (typeof text === 'string' && /^https?:/.test(text)) return text;
      return undefined;
    },
  };
  const rich = (parts) => toRichText(parts, richContext);
  const tag = (comment, name) =>
    (comment?.blockTags ?? []).filter((block) => block.tag === name);
  const tagText = (block) =>
    block.content
      .map((part) => part.text)
      .join('')
      .trim()
      .replace(/^```\w*\n?|\n?```$/g, '')
      .replace(/^`|`$/g, '')
      .trim();

  const buildComment = (comment) => ({
    summary: rich(comment?.summary),
    remarks: tag(comment, '@remarks').flatMap((block) => rich(block.content)),
    returns: tag(comment, '@returns').flatMap((block) => rich(block.content)),
    examples: tag(comment, '@example').flatMap((block) => buildExamples(block)),
    throws: tag(comment, '@throws').map((block) => rich(block.content)),
    see: tag(comment, '@see').flatMap((block) => rich(block.content)),
  });

  const buildExamples = (block) => {
    const out = [];
    let caption = '';
    for (const part of block.content) {
      if (part.kind === 'code' && part.text.startsWith('```')) {
        const { lang, code } = parseFence(part.text);
        out.push({
          ...(caption.trim() ? { caption: caption.trim() } : {}),
          lang,
          code,
          html: highlight(code, lang),
        });
        caption = '';
      } else {
        caption += part.text;
      }
    }
    if (out.length === 0 && caption.trim()) {
      const code = caption.trim();
      out.push({ lang: 'ts', code, html: highlight(code, 'ts') });
    }
    return out;
  };

  const deprecationOf = (...comments) => {
    for (const comment of comments) {
      const block = tag(comment, '@deprecated')[0];
      if (block) return tagText(block);
      if (comment?.modifierTags?.includes('@deprecated')) return '';
    }
    return undefined;
  };

  const defaultOf = (comment) => {
    const block = [
      ...tag(comment, '@defaultValue'),
      ...tag(comment, '@default'),
    ][0];
    return block ? tagText(block) : undefined;
  };

  const buildParam = (param) => {
    const declaration =
      param.type?.type === 'reflection' ? param.type.declaration : undefined;
    const children =
      declaration?.children?.length && !declaration.signatures?.length
        ? declaration.children.map((child) => ({
            name: child.name,
            type: types.print(child.type),
            optional: Boolean(child.flags?.isOptional),
            rest: false,
            ...(defaultOf(child.comment)
              ? { default: defaultOf(child.comment) }
              : {}),
            description: rich(child.comment?.summary),
          }))
        : undefined;
    const fallback =
      param.defaultValue && param.defaultValue !== '...'
        ? param.defaultValue
        : undefined;
    const type = types.print(param.type);
    // Destructured parameters have no name of their own.
    const name = /^__/.test(param.name)
      ? /Props\b/.test(type.text)
        ? 'props'
        : 'options'
      : param.name;
    return {
      name,
      type,
      optional: Boolean(param.flags?.isOptional || param.defaultValue),
      rest: Boolean(param.flags?.isRest),
      ...(fallback ? { default: fallback } : {}),
      description: rich(param.comment?.summary),
      ...(children ? { children } : {}),
    };
  };

  const buildTypeParameters = (list) =>
    (list ?? []).map((param) => ({
      name: param.name,
      ...(param.type ? { constraint: types.print(param.type) } : {}),
      ...(param.default ? { default: types.print(param.default) } : {}),
    }));

  const sameComment = (a, b) =>
    a === b || (a && b && JSON.stringify(a) === JSON.stringify(b));

  const buildSignature = (signature, shared) => ({
    typeParameters: buildTypeParameters(signature.typeParameters),
    params: (signature.parameters ?? []).map(buildParam),
    returns: types.print(signature.type),
    // The comment that heads the page is not repeated per signature.
    comment: buildComment(
      sameComment(signature.comment, shared) ? undefined : signature.comment,
    ),
  });

  const buildMember = (child) => {
    const signatures = child.signatures ?? [];
    const getter = child.getSignature;
    let kind = 'property';
    let type;
    if (child.kind === KIND.Method) {
      kind = 'method';
      type = types.printSignature(signatures[0]);
    } else if (child.kind === KIND.Accessor) {
      kind = 'accessor';
      type = types.print(
        getter?.type ?? child.setSignature?.parameters?.[0]?.type,
      );
    } else {
      type = types.print(child.type);
    }
    const comment =
      child.comment ?? signatures[0]?.comment ?? getter?.comment ?? undefined;
    const deprecated = deprecationOf(comment);
    return {
      name: child.name,
      kind,
      type,
      optional: Boolean(child.flags?.isOptional),
      readonly: Boolean(
        child.flags?.isReadonly || (getter && !child.setSignature),
      ),
      static: Boolean(child.flags?.isStatic),
      ...(defaultOf(comment) ? { default: defaultOf(comment) } : {}),
      description: rich(comment?.summary),
      ...(deprecated !== undefined ? { deprecated } : {}),
      ...(kind === 'method'
        ? {
            signatures: signatures.map((signature) =>
              buildSignature(signature, comment),
            ),
          }
        : {}),
    };
  };

  const buildMembers = (declaration) => [
    ...(declaration.children ?? [])
      .filter((child) => child.kind !== KIND.Constructor)
      .map(buildMember),
    ...(declaration.indexSignatures ?? []).map((signature) => {
      const parameter = signature.parameters[0];
      return {
        name: `[${parameter.name}]`,
        kind: 'index',
        indexParameter: {
          name: parameter.name,
          type: types.print(parameter.type),
        },
        type: types.print(signature.type),
        optional: false,
        readonly: Boolean(signature.flags?.isReadonly),
        static: false,
        description: rich(signature.comment?.summary),
      };
    }),
  ];

  // TypeDoc preserves forwardRef's external React type instead of creating
  // declaration signatures. Restrict this to React's actual wrapper type so
  // contexts and other capitalized constants do not become components.
  const forwardRefProps = (decl, entry) =>
    entry.slug === 'react' &&
    decl.kind === KIND.Variable &&
    decl.type?.type === 'reference' &&
    decl.type.package === '@types/react' &&
    decl.type.qualifiedName === 'React.ForwardRefExoticComponent'
      ? decl.type.typeArguments?.[0]
      : undefined;

  const propsDeclaration = (type) => {
    if (type?.type === 'intersection') {
      return type.types.map(propsDeclaration).find(Boolean);
    }
    if (type?.type !== 'reference' || typeof type.target !== 'number')
      return undefined;
    const target = resolveReference(byId.get(type.target));
    return target?.kind === KIND.Interface ? target : undefined;
  };

  const kindOf = (decl, entry) => {
    if (forwardRefProps(decl, entry)) return 'component';
    switch (decl.kind) {
      case KIND.Function:
        return entry.slug === 'react' && /^[A-Z]/.test(decl.name)
          ? 'component'
          : 'function';
      case KIND.Class:
        return 'class';
      case KIND.Interface:
        return 'interface';
      case KIND.TypeAlias:
        return 'type';
      case KIND.Variable:
        return decl.flags?.isConst ? 'const' : 'variable';
      case KIND.Enum:
        return 'enum';
      case KIND.Namespace:
        return 'namespace';
      default:
        return 'variable';
    }
  };

  const domainOf = (file, entry) => {
    const base = file.startsWith(`${entry.sourceDir}/`)
      ? entry.sourceDir
      : file.split('/').slice(0, 3).join('/'); // packages/<pkg>/src
    const segments = file.slice(base.length + 1).split('/');
    const raw =
      segments.length > 1
        ? segments[0]
        : segments[0].replace(/\.(d\.)?tsx?$/, '');
    const aliased = DOMAIN_ALIASES[entry.slug]?.[raw];
    if (aliased) return aliased;
    return raw === 'index' ? entry.slug : raw;
  };

  // Export order as written in each entry's index file.
  const positionsFor = (entry) => {
    const text = readFileSync(path.join(repoRoot, entry.source), 'utf8');
    return (name) => {
      const match = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).exec(
        text,
      );
      return match ? match.index : Number.POSITIVE_INFINITY;
    };
  };

  const buildSymbol = (decl, home) => {
    const entry = home.entry;
    const kind = kindOf(decl, entry);
    const file = fileOf(decl);
    const domain = domainOf(file, entry);
    const forwardedProps = forwardRefProps(decl, entry);
    const signatureNodes = forwardedProps
      ? [
          {
            parameters: [{ name: 'props', type: forwardedProps }],
            // The call contract of React.ForwardRefExoticComponent<P>.
            type: { type: 'reference', name: 'ReactNode' },
          },
        ]
      : decl.kind === KIND.Class
        ? ((decl.children ?? []).find(
            (child) => child.kind === KIND.Constructor,
          )?.signatures ?? [])
        : (decl.signatures ?? []);
    const primaryComment =
      decl.comment ?? signatureNodes.find((node) => node.comment)?.comment;
    const deprecated = deprecationOf(decl.comment, signatureNodes[0]?.comment);
    let members = [];
    let propsType;
    if (decl.kind === KIND.Interface || decl.kind === KIND.Class) {
      members = buildMembers(decl);
    } else if (
      decl.kind === KIND.TypeAlias &&
      decl.type?.type === 'reflection' &&
      decl.type.declaration
    ) {
      members = buildMembers(decl.type.declaration);
    }
    if (kind === 'component') {
      const propsRef = signatureNodes[0]?.parameters?.[0]?.type;
      const target = propsDeclaration(propsRef);
      if (target?.kind === KIND.Interface && target.children?.length) {
        propsType = target.name;
        members = buildMembers(target);
      }
    }
    const source = decl.sources?.[0];
    const alsoFrom = decls
      .get(decl.id)
      .exports.filter((item) => item.entry !== entry)
      .map((item) => ({
        entry: item.entry.slug,
        importPath: item.entry.importPath,
      }))
      .filter(
        (item, i, all) => all.findIndex((x) => x.entry === item.entry) === i,
      );
    const value =
      decl.kind === KIND.Variable &&
      decl.defaultValue &&
      decl.defaultValue !== '...' &&
      decl.defaultValue.length <= 160
        ? decl.defaultValue
        : undefined;
    return {
      name: home.name,
      kind,
      entry: entry.slug,
      canonicalEntry: entry.slug,
      importPath: entry.importPath,
      alsoFrom,
      domain,
      domainTitle: domainTitle(domain),
      ...(deprecated !== undefined ? { deprecated } : {}),
      ...(source
        ? {
            source: {
              path: source.fileName,
              line: source.line,
              url: `${repository}/blob/${commit}/${source.fileName}#L${source.line}`,
            },
          }
        : {}),
      comment: buildComment(primaryComment),
      signatures: signatureNodes.map((signature) =>
        buildSignature(signature, primaryComment),
      ),
      members,
      heritage: [
        ...(decl.extendedTypes ?? []).map((type) => ({
          relation: 'extends',
          type: types.print(type),
        })),
        ...(decl.implementedTypes ?? []).map((type) => ({
          relation: 'implements',
          type: types.print(type),
        })),
      ],
      typeParameters: buildTypeParameters(decl.typeParameters),
      ...(decl.kind === KIND.TypeAlias || decl.kind === KIND.Variable
        ? { type: types.print(decl.type) }
        : {}),
      ...(value ? { value } : {}),
      ...(propsType ? { propsType } : {}),
    };
  };

  const VALUE_KINDS = new Set([
    'function',
    'component',
    'class',
    'const',
    'variable',
    'enum',
    'namespace',
  ]);

  /** @type {Map<string, any[]>} */
  const symbolsByEntry = new Map(entries.map((entry) => [entry.slug, []]));
  for (const [id, home] of canonical) {
    const symbol = buildSymbol(decls.get(id).decl, home);
    symbolsByEntry.get(home.entry.slug).push(symbol);
  }

  const entryModels = entries.map((entry) => {
    const position = positionsFor(entry);
    const symbols = symbolsByEntry.get(entry.slug);
    const order = (a, b) =>
      Number(VALUE_KINDS.has(b.kind)) - Number(VALUE_KINDS.has(a.kind)) ||
      position(a.name) - position(b.name) ||
      a.name.localeCompare(b.name);
    const domains = new Map();
    for (const symbol of symbols) {
      const list = domains.get(symbol.domain) ?? [];
      list.push(symbol);
      domains.set(symbol.domain, list);
    }
    const domainList = [...domains.entries()]
      .map(([slug, list]) => ({
        slug,
        title: domainTitle(slug),
        list: list.sort(order),
        first: Math.min(...list.map((symbol) => position(symbol.name))),
      }))
      .sort((a, b) => a.first - b.first || a.slug.localeCompare(b.slug));
    const ordered = domainList.flatMap((domain) => domain.list);
    const reexports = exportsByEntry
      .get(entry.slug)
      .map(({ name, decl }) => ({ name, home: canonical.get(decl.id) }))
      .filter(({ name, home }) => home.entry !== entry || home.name !== name)
      .map(({ name, home }) => {
        const symbol = symbolsByEntry
          .get(home.entry.slug)
          .find((item) => item.name === home.name);
        const summary = firstSentence(symbol.comment.summary);
        return {
          name,
          kind: symbol.kind,
          ...(summary ? { summary } : {}),
          canonicalEntry: home.entry.slug,
          href: symbolHref(home.entry.slug, home.name),
        };
      })
      .sort((a, b) => position(a.name) - position(b.name));
    const summaries = ordered.map((symbol) => {
      const summary = firstSentence(symbol.comment.summary);
      return {
        name: symbol.name,
        kind: symbol.kind,
        ...(summary ? { summary } : {}),
        domain: symbol.domain,
        ...(symbol.deprecated !== undefined
          ? { deprecated: symbol.deprecated }
          : {}),
      };
    });
    const values = ordered.filter((symbol) => VALUE_KINDS.has(symbol.kind));
    return {
      summary: {
        slug: entry.slug,
        title: entry.importPath,
        importPath: entry.importPath,
        aliases: entry.aliases,
        summary: entry.summary,
        source: entry.source,
        symbols: summaries,
        domains: domainList.map(({ slug, title, list }) => ({
          slug,
          title,
          symbols: list.map((symbol) => symbol.name),
        })),
        counts: {
          symbols: ordered.length,
          values: values.length,
          types: ordered.length - values.length,
          reexports: reexports.length,
        },
      },
      reexports,
      symbols: ordered,
    };
  });

  return {
    model: {
      version: 1,
      commit,
      repository,
      entries: entryModels.map((entry) => entry.summary),
    },
    entries: entryModels.map((entry) => ({
      ...entry.summary,
      reexports: entry.reexports,
    })),
    symbols: entryModels.flatMap((entry) => entry.symbols),
  };
}

export const generatedDir = (docsRoot) =>
  path.join(docsRoot, 'src', 'generated');

/** Write `api.json` and the page files. */
export async function writeModel(docsRoot, { model, entries, symbols }) {
  const dir = generatedDir(docsRoot);
  await rm(path.join(dir, 'api'), { recursive: true, force: true });
  await mkdir(path.join(dir, 'api', 'entries'), { recursive: true });
  await writeFile(path.join(dir, 'api.json'), `${JSON.stringify(model)}\n`);
  for (const entry of entries) {
    await writeFile(
      path.join(dir, 'api', 'entries', `${entry.slug}.json`),
      JSON.stringify(entry),
    );
    await mkdir(path.join(dir, 'api', 'symbols', entry.slug), {
      recursive: true,
    });
  }
  const seen = new Set();
  for (const symbol of symbols) {
    const file = path.join(
      dir,
      'api',
      'symbols',
      symbol.entry,
      `${symbolFileName(symbol.name)}.json`,
    );
    const key = file.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Two symbols map to ${path.relative(docsRoot, file)}.`);
    }
    seen.add(key);
    await writeFile(file, JSON.stringify(symbol));
  }
}
