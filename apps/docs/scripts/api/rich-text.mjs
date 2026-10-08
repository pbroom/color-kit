// TypeDoc comment parts → the model's RichText blocks (see src/api/model.ts).
//
// TypeDoc hands over a run of `text`, `code` and `inline-tag` parts whose
// text is Markdown. JSDoc in this repo uses a small subset: paragraphs,
// `-` / `1.` lists, fenced code, `code`, **strong**, *em*, [links](url) and
// {@link Symbol}. Code and link parts become placeholders so block parsing
// never splits them, then expand back during inline parsing.

const OPEN = '';
const CLOSE = '';
const PLACEHOLDER = /(\d+)/g;

const FENCE = /^```([\w-]*)[^\n]*\n([\s\S]*?)\n?```$/;

/**
 * @param {Array<{kind: string, text: string, tag?: string, target?: unknown}>} parts
 * @param {object} ctx
 * @param {(target: unknown, text: string) => string | undefined} ctx.resolveLink
 * @param {(code: string, lang: string) => string} ctx.highlight
 * @returns {import('../../src/api/model').RichText}
 */
export function toRichText(parts, ctx) {
  if (!parts || parts.length === 0) return [];
  const tokens = [];
  let source = '';
  for (const part of parts) {
    if (part.kind === 'text') {
      source += part.text;
    } else if (part.kind === 'code') {
      tokens.push({ kind: 'code', text: part.text });
      source += `${OPEN}${tokens.length - 1}${CLOSE}`;
    } else if (part.kind === 'inline-tag') {
      tokens.push({ kind: 'link', part });
      source += `${OPEN}${tokens.length - 1}${CLOSE}`;
    }
  }
  return parseBlocks(source.trim(), tokens, ctx);
}

/** Plain text of a RichText, for meta descriptions and search. */
export function plainText(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'p') return inlineText(block.children);
      if (block.type === 'list') return block.items.map(inlineText).join(' ');
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inlineText(inlines) {
  return inlines.map((node) => node.text).join('');
}

/** First sentence of the first paragraph, plain text. */
export function firstSentence(blocks) {
  const first = blocks.find((block) => block.type === 'p');
  if (!first) return undefined;
  const text = inlineText(first.children).replace(/\s+/g, ' ').trim();
  // A period followed by a space and a capital, outside of `e.g.`/`i.e.`.
  const match = /^(.+?[.!?])(?=\s+[A-Z(`])/.exec(
    text.replace(/\b(e\.g|i\.e|vs)\./g, '$1․'),
  );
  const sentence = (match ? match[1] : text).replace(/․/g, '.');
  return sentence || undefined;
}

function parseBlocks(source, tokens, ctx) {
  const blocks = [];
  const lines = source.split('\n');
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (!text) return;
    // A paragraph that is just a fenced code token is a code block.
    const solo = new RegExp(`^${OPEN}(\\d+)${CLOSE}$`).exec(text);
    const token = solo ? tokens[Number(solo[1])] : undefined;
    if (token?.kind === 'code' && token.text.startsWith('```')) {
      blocks.push(codeBlock(token.text, ctx));
      return;
    }
    // Fenced code tokens inside a paragraph split it.
    let rest = text;
    for (;;) {
      const fence = findFence(rest, tokens);
      if (!fence) break;
      const before = rest.slice(0, fence.index).trim();
      if (before)
        blocks.push({ type: 'p', children: parseInline(before, tokens, ctx) });
      blocks.push(codeBlock(fence.token.text, ctx));
      rest = rest.slice(fence.index + fence.length).trim();
    }
    if (rest)
      blocks.push({ type: 'p', children: parseInline(rest, tokens, ctx) });
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: 'list',
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item.trim(), tokens, ctx)),
    });
    list = null;
  };

  for (const line of lines) {
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      const ordered = Boolean(item[2]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item[3]);
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (list) {
      // Continuation of the last item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

function findFence(text, tokens) {
  for (const match of text.matchAll(PLACEHOLDER)) {
    const token = tokens[Number(match[1])];
    if (token?.kind === 'code' && token.text.startsWith('```')) {
      return { index: match.index, length: match[0].length, token };
    }
  }
  return null;
}

function codeBlock(fenced, ctx) {
  const match = FENCE.exec(fenced.trim());
  const lang = normalizeLang(match?.[1] || 'ts');
  const code = (
    match ? match[2] : fenced.replace(/^```\w*\n?|```$/g, '')
  ).replace(/\s+$/, '');
  return { type: 'code', lang, code, html: ctx.highlight(code, lang) };
}

/** Parse a fenced block (or bare code) into `{ lang, code }`. */
export function parseFence(text) {
  const match = FENCE.exec(text.trim());
  if (match) {
    return {
      lang: normalizeLang(match[1] || 'ts'),
      code: match[2].replace(/\s+$/, ''),
    };
  }
  return { lang: 'ts', code: text.trim() };
}

const LANGS = {
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  javascript: 'js',
  js: 'js',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'html',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
};

export function normalizeLang(lang) {
  return LANGS[lang.toLowerCase()] ?? 'ts';
}

const INLINE =
  /(\d+)|\*\*([^*]+)\*\*|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])|(?<![\w])_([^_\s][^_]*?)_(?![\w])|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)<>]+[^\s)<>.,;:])/g;

function parseInline(text, tokens, ctx) {
  const out = [];
  const pushText = (value) => {
    if (!value) return;
    const normalized = value.replace(/\s*\n\s*/g, ' ');
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += normalized;
    else out.push({ type: 'text', text: normalized });
  };
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    pushText(text.slice(index, match.index));
    index = match.index + match[0].length;
    const [, token, strong, em, em2, linkText, linkHref, url] = match;
    if (token !== undefined) {
      out.push(...expandToken(tokens[Number(token)], ctx));
    } else if (strong) {
      out.push({ type: 'strong', text: strong });
    } else if (em || em2) {
      out.push({ type: 'em', text: em || em2 });
    } else if (linkText) {
      const resolved = linkHref.startsWith('http')
        ? linkHref
        : (ctx.resolveLink(linkHref, linkText) ?? linkHref);
      const inner = linkText.replace(PLACEHOLDER, (_, i) =>
        stripTicks(tokens[Number(i)]?.text ?? ''),
      );
      out.push({ type: 'link', text: inner, href: resolved });
    } else if (url) {
      out.push({
        type: 'link',
        text: url.replace(/^https?:\/\//, ''),
        href: url,
      });
    }
  }
  pushText(text.slice(index));
  // Trim the ends.
  const first = out[0];
  if (first?.type === 'text') first.text = first.text.trimStart();
  const last = out[out.length - 1];
  if (last?.type === 'text') last.text = last.text.trimEnd();
  return out.filter((node) => node.type !== 'text' || node.text !== '');
}

function stripTicks(text) {
  return text.replace(/^`+|`+$/g, '');
}

function expandToken(token, ctx) {
  if (!token) return [];
  if (token.kind === 'code') {
    return [{ type: 'code', text: stripTicks(token.text) }];
  }
  const { part } = token;
  const text = part.text.trim();
  const href = ctx.resolveLink(part.target, text);
  const code = part.tag !== '@linkplain' && /^[\w$.]+(\(\))?$/.test(text);
  if (!href) {
    return [code ? { type: 'code', text } : { type: 'text', text }];
  }
  return [{ type: 'link', text, href, ...(code ? { code: true } : {}) }];
}
