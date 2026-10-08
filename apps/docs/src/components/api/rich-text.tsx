import type { RichBlock, RichInline, RichText } from '@/api/model';
import { CodeBlock } from '@/components/ui/code-block';
import { SmartLink } from './api-link';

/** Inline JSDoc content: text, `code`, emphasis and resolved links. */
export function RichInlines({ nodes }: { nodes: RichInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return node.text;
          case 'code':
            return <code key={index}>{node.text}</code>;
          case 'em':
            return <em key={index}>{node.text}</em>;
          case 'strong':
            return <strong key={index}>{node.text}</strong>;
          case 'link':
            return (
              <SmartLink key={index} href={node.href}>
                {node.code ? <code>{node.text}</code> : node.text}
              </SmartLink>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function Block({ block }: { block: RichBlock }) {
  if (block.type === 'p') {
    return (
      <p>
        <RichInlines nodes={block.children} />
      </p>
    );
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return (
      <List>
        {block.items.map((item, index) => (
          <li key={index}>
            <RichInlines nodes={item} />
          </li>
        ))}
      </List>
    );
  }
  return <CodeBlock html={block.html} code={block.code} lang={block.lang} />;
}

/**
 * Block-level JSDoc content. Rendered as direct children of the caller (no
 * wrapper), so inside `.prose` each block lands in the prose column.
 */
export function RichBlocks({ blocks }: { blocks: RichText }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </>
  );
}

/** Rich text squeezed into one inline run (params rows, list summaries). */
export function RichCompact({ blocks }: { blocks: RichText }) {
  const blocksWithText = blocks.filter((block) => block.type !== 'code');
  if (blocksWithText.length <= 1 && blocks.length <= 1) {
    const only = blocks[0];
    if (!only) return null;
    if (only.type === 'p') return <RichInlines nodes={only.children} />;
  }
  return (
    <div className="rich-compact">
      <RichBlocks blocks={blocks} />
    </div>
  );
}
