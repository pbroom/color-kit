import type {
  ApiMember,
  ApiSignature,
  ApiSymbol,
  ApiTypeParameter,
  TypePart,
  TypeRef,
} from '@/api/model';
import { TypePartView } from './type-link';

/**
 * The TypeScript declaration of a symbol, laid out like a `.d.ts`: one
 * parameter per line once a signature runs long, members one per line, long
 * unions one member per line. Parameter and member names link to their rows
 * (`#param-<name>`, `#prop-<name>`); named types link across entries.
 *
 * Layout is a pure function of the data, so prerendered and hydrated markup
 * always agree.
 */

/** Longest single-line declaration before it breaks across lines. */
const MAX_LINE = 72;
/**
 * Single-line signatures longer than this also break one parameter per line
 * on narrow screens (CSS swaps the soft tokens below at 40rem).
 */
const NARROW_LINE = 44;

interface Token extends TypePart {
  /** Fragment this token links to on the same page. */
  anchor?: string;
  /** The declared name itself. */
  decl?: boolean;
  /**
   * Responsive token: `wide` text on wide screens, `narrow` text on narrow
   * ones; `break` starts a new line on narrow screens only.
   */
  soft?: { wide: string; narrow: string; break?: boolean };
}

type Line = Token[];

const t = (kind: TypePart['kind'], text: string): Token => ({ kind, text });
const kw = (text: string) => t('keyword', text);
const punct = (text: string) => t('punct', text);
const INDENT = t('text', '  ');

const width = (tokens: Token[]) =>
  tokens.reduce((sum, token) => sum + token.text.length, 0);

const softText = (wide: string, narrow: string): Token => ({
  kind: 'punct',
  text: wide,
  soft: { wide, narrow },
});
const softBreak = (): Token => ({
  kind: 'punct',
  text: '',
  soft: { wide: '', narrow: '', break: true },
});

const typeTokens = (type: TypeRef): Token[] => type.parts;

function typeParamTokens(params: ApiTypeParameter[]): Token[] {
  if (params.length === 0) return [];
  const out: Token[] = [punct('<')];
  params.forEach((param, index) => {
    if (index > 0) out.push(punct(', '));
    out.push(t('param', param.name));
    if (param.constraint)
      out.push(kw(' extends '), ...typeTokens(param.constraint));
    if (param.default) out.push(punct(' = '), ...typeTokens(param.default));
  });
  out.push(punct('>'));
  return out;
}

/** Anchor id of a parameter row; overloads after the first are prefixed. */
export function paramAnchor(name: string, overload = 0): string {
  return overload === 0 ? `param-${name}` : `param-${overload + 1}-${name}`;
}

export function memberAnchor(name: string): string {
  return `prop-${name}`;
}

function paramTokens(
  signature: ApiSignature,
  overload: number,
  linked: boolean,
): Token[][] {
  return signature.params.map((param) => [
    ...(param.rest ? [punct('...')] : []),
    {
      kind: 'name' as const,
      text: param.name,
      ...(linked ? { anchor: paramAnchor(param.name, overload) } : {}),
    },
    punct(param.optional && !param.rest ? '?: ' : ': '),
    ...typeTokens(param.type),
  ]);
}

/** `name<T>(a: A, b?: B): R`, broken one parameter per line when long. */
function signatureLines(
  head: Token[],
  signature: ApiSignature,
  options: {
    overload?: number;
    linked?: boolean;
    indent?: number;
    arrow?: boolean;
    terminator?: string;
  } = {},
): Line[] {
  const {
    overload = 0,
    linked = true,
    indent = 0,
    arrow = false,
    terminator = '',
  } = options;
  const pad: Token[] = Array.from({ length: indent }, () => INDENT);
  const open = [
    ...pad,
    ...head,
    ...typeParamTokens(signature.typeParameters),
    punct('('),
  ];
  const params = paramTokens(signature, overload, linked);
  const returns = [
    punct(arrow ? ') => ' : '): '),
    ...typeTokens(signature.returns),
    ...(terminator ? [punct(terminator)] : []),
  ];
  const single: Line = [...open];
  params.forEach((param, index) => {
    if (index > 0) single.push(punct(', '));
    single.push(...param);
  });
  single.push(...returns);
  if (params.length === 0) {
    return [single];
  }
  if (width(single) <= NARROW_LINE) {
    return [single];
  }
  if (width(single) <= MAX_LINE) {
    // One line when it fits; one parameter per line on narrow screens.
    const indentText = '  '.repeat(indent + 1);
    const soft: Line = [...open];
    params.forEach((param, index) => {
      soft.push(softBreak(), softText('', indentText), ...param);
      soft.push(softText(index < params.length - 1 ? ', ' : '', ','));
    });
    soft.push(softBreak(), softText('', '  '.repeat(indent)), ...returns);
    return [soft];
  }
  return [
    open,
    ...params.map((param) => [...pad, INDENT, ...param, punct(',')]),
    [...pad, ...returns],
  ];
}

/** Split a type at its top-level `|` (outside brackets and arrows). */
function splitUnion(parts: TypePart[]): Token[][] {
  const members: Token[][] = [[]];
  let depth = 0;
  for (const part of parts) {
    if (part.kind !== 'punct') {
      members[members.length - 1]!.push(part);
      continue;
    }
    let buffer = '';
    const flush = () => {
      if (buffer) members[members.length - 1]!.push(punct(buffer));
      buffer = '';
    };
    for (let i = 0; i < part.text.length; i++) {
      const char = part.text[i]!;
      if (char === '=' && part.text[i + 1] === '>') {
        buffer += '=>';
        i++;
        continue;
      }
      if (depth === 0 && part.text.startsWith(' | ', i)) {
        flush();
        members.push([]);
        i += 2;
        continue;
      }
      if ('([{<'.includes(char)) depth++;
      else if (')]}>'.includes(char)) depth--;
      buffer += char;
    }
    flush();
  }
  return members.filter((member) => member.length > 0);
}

function memberLines(member: ApiMember): Line[] {
  const prefix: Token[] = [
    INDENT,
    ...(member.static ? [kw('static ')] : []),
    ...(member.readonly ? [kw('readonly ')] : []),
  ];
  const name: Token = {
    kind: 'name',
    text: member.indexParameter
      ? `[${member.indexParameter.name}: ${member.indexParameter.type.text}]`
      : member.name,
    anchor: memberAnchor(member.name),
  };
  if (member.kind === 'method' && member.signatures?.length) {
    return member.signatures.flatMap((signature) =>
      signatureLines(
        [...prefix.slice(1), name, ...(member.optional ? [punct('?')] : [])],
        signature,
        { linked: false, indent: 1, terminator: ';' },
      ),
    );
  }
  return [
    [
      ...prefix,
      name,
      punct(member.optional ? '?: ' : ': '),
      ...typeTokens(member.type),
      punct(';'),
    ],
  ];
}

function heritageTokens(symbol: ApiSymbol): Token[] {
  const out: Token[] = [];
  for (const relation of ['extends', 'implements'] as const) {
    const types = symbol.heritage.filter((item) => item.relation === relation);
    if (types.length === 0) continue;
    out.push(kw(` ${relation} `));
    types.forEach((item, index) => {
      if (index > 0) out.push(punct(', '));
      out.push(...typeTokens(item.type));
    });
  }
  return out;
}

const declName = (name: string): Token => ({
  kind: 'name',
  text: name,
  decl: true,
});

/** The declaration of `symbol` as lines of tokens. */
export function declarationLines(symbol: ApiSymbol): Line[][] {
  const name = declName(symbol.name);
  switch (symbol.kind) {
    case 'function':
    case 'component':
      return symbol.signatures.map((signature, overload) =>
        signatureLines([kw('function '), name], signature, {
          overload,
          linked: !(symbol.propsType && signature.params.length === 1),
          terminator: ';',
        }),
      );
    case 'class': {
      const lines: Line[] = [
        [
          kw('class '),
          name,
          ...typeParamTokens(symbol.typeParameters),
          ...heritageTokens(symbol),
          punct(' {'),
        ],
      ];
      symbol.signatures.forEach((signature, overload) => {
        lines.push(
          ...signatureLines([kw('constructor')], signature, {
            overload,
            indent: 1,
            terminator: ';',
          }).map((line) =>
            // Constructors return the instance; drop the `: Type`.
            trimConstructorReturn(line),
          ),
        );
      });
      for (const member of symbol.members) lines.push(...memberLines(member));
      lines.push([punct('}')]);
      return [lines];
    }
    case 'interface': {
      const head: Line = [
        kw('interface '),
        name,
        ...typeParamTokens(symbol.typeParameters),
        ...heritageTokens(symbol),
      ];
      if (symbol.members.length === 0) return [[[...head, punct(' {}')]]];
      return [
        [
          [...head, punct(' {')],
          ...symbol.members.flatMap(memberLines),
          [punct('}')],
        ],
      ];
    }
    case 'type': {
      const head: Line = [
        kw('type '),
        name,
        ...typeParamTokens(symbol.typeParameters),
        punct(' ='),
      ];
      if (!symbol.type) return [[[...head, punct(' unknown;')]]];
      const single: Line = [
        ...head,
        punct(' '),
        ...typeTokens(symbol.type),
        punct(';'),
      ];
      const members = splitUnion(symbol.type.parts);
      if (width(single) <= MAX_LINE || members.length < 2) return [[single]];
      return [
        [
          head,
          ...members.map((member, index) => [
            INDENT,
            punct('| '),
            ...member,
            ...(index === members.length - 1 ? [punct(';')] : []),
          ]),
        ],
      ];
    }
    default: {
      const keyword = symbol.kind === 'const' ? 'const ' : 'let ';
      const literal =
        symbol.type?.parts.length === 1 &&
        symbol.type.parts[0]!.kind === 'literal';
      const line: Line = [kw(keyword), name];
      if (symbol.type && !(literal && symbol.value)) {
        line.push(punct(': '), ...typeTokens(symbol.type));
      }
      if (symbol.value && (literal || symbol.value.length <= 40)) {
        line.push(punct(' = '), t(literal ? 'literal' : 'text', symbol.value));
      }
      line.push(punct(';'));
      return [[line]];
    }
  }
}

function trimConstructorReturn(line: Line): Line {
  const index = line.findIndex(
    (token) => token.kind === 'punct' && token.text.startsWith('): '),
  );
  if (index < 0) return line;
  return [...line.slice(0, index), punct(');')];
}

function TokenView({ token }: { token: Token }) {
  if (token.soft) {
    if (token.soft.break) {
      return <span className="decl__br" />;
    }
    return (
      <>
        {token.soft.wide ? (
          <span className="tok tok-punct decl__wide">{token.soft.wide}</span>
        ) : null}
        {token.soft.narrow ? (
          <span className="tok tok-punct decl__narrow">
            {token.soft.narrow}
          </span>
        ) : null}
      </>
    );
  }
  if (token.decl) {
    return <span className="tok tok-decl">{token.text}</span>;
  }
  if (token.anchor) {
    return (
      <a className="tok tok-name" href={`#${token.anchor}`}>
        {token.text}
      </a>
    );
  }
  return <TypePartView part={token} />;
}

/** `<pre>` of the declaration; overloads are separated by a blank line. */
export function Declaration({ symbol }: { symbol: ApiSymbol }) {
  const blocks = declarationLines(symbol);
  return (
    <pre className="decl" data-kind={symbol.kind} tabIndex={0}>
      <code>
        {blocks.map((lines, blockIndex) => (
          <span key={blockIndex} className="decl__block">
            {blockIndex > 0 ? '\n\n' : null}
            {lines.map((line, lineIndex) => (
              <span key={lineIndex} className="decl__line">
                {lineIndex > 0 ? '\n' : null}
                {line.map((token, tokenIndex) => (
                  <TokenView key={tokenIndex} token={token} />
                ))}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
}
