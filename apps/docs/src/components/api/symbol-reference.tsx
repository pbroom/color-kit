import { Fragment } from 'react';
import type { ApiSignature as ApiSignatureModel, ApiSymbol } from '@/api/model';
import type { MdxPage } from '@/api/data';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { MdxContent } from './mdx-content';
import { ApiLink } from './api-link';
import { Members, Params } from './params';
import { RichBlocks, RichCompact, RichInlines } from './rich-text';
import { ApiSignature } from './signature';
import { TypeView } from './type-link';

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id}>
      <a className="heading-anchor" href={`#${id}`}>
        {children}
      </a>
    </h2>
  );
}

const QUIET_RETURNS = new Set(['void', 'JSX.Element', 'Element', 'ReactNode']);

function Returns({
  signature,
  showType,
}: {
  signature: ApiSignatureModel;
  showType: boolean;
}) {
  return (
    <p className="api-returns">
      {showType ? (
        <code className="api-returns__type">
          <TypeView type={signature.returns} />
        </code>
      ) : null}
      {signature.comment.returns.length > 0 ? (
        <span className="api-returns__text">
          <RichCompact blocks={signature.comment.returns} />
        </span>
      ) : null}
    </p>
  );
}

function SignatureDetails({
  symbol,
  signature,
  overload,
  returnsComment,
}: {
  symbol: ApiSymbol;
  signature: ApiSignatureModel;
  overload: number;
  returnsComment: ApiSignatureModel['comment']['returns'];
}) {
  const merged: ApiSignatureModel = {
    ...signature,
    comment: {
      ...signature.comment,
      returns:
        signature.comment.returns.length > 0
          ? signature.comment.returns
          : returnsComment,
    },
  };
  const showReturns =
    symbol.kind !== 'class' &&
    (merged.comment.returns.length > 0 ||
      !QUIET_RETURNS.has(merged.returns.text));
  const suffix = overload === 0 ? '' : `-${overload + 1}`;
  // A component's lone props parameter is listed member by member as Props.
  const showParams =
    signature.params.length > 0 &&
    !(symbol.propsType && signature.params.length === 1);
  return (
    <>
      {signature.comment.summary.length > 0 ? (
        <RichBlocks blocks={signature.comment.summary} />
      ) : null}
      {showParams ? (
        <>
          <Heading id={`parameters${suffix}`}>Parameters</Heading>
          <Params params={signature.params} overload={overload} />
        </>
      ) : null}
      {showReturns ? (
        <>
          <Heading id={`returns${suffix}`}>Returns</Heading>
          <Returns
            signature={merged}
            showType={!QUIET_RETURNS.has(merged.returns.text)}
          />
        </>
      ) : null}
    </>
  );
}

/** Group heading for overloads: `Overload 2 of 3`. */
function OverloadHeading({ index, total }: { index: number; total: number }) {
  const id = `overload-${index + 1}`;
  return (
    <h2 id={id} className="api-overload">
      <a className="heading-anchor" href={`#${id}`}>
        Overload {index + 1} of {total}
      </a>
    </h2>
  );
}

/**
 * The body of `/api/<entry>/<Symbol>`: lede, declaration, description,
 * parameters, returns, members, throws, examples, optional MDX notes, see
 * also, and the other entry points that export the same declaration.
 */
export function SymbolReference({
  symbol,
  Notes,
}: {
  symbol: ApiSymbol;
  Notes?: MdxPage | null;
}) {
  const { comment } = symbol;
  const [lede, ...description] = comment.summary;
  const signatures = symbol.signatures;
  const throws = [
    ...comment.throws,
    ...signatures.flatMap((signature) => signature.comment.throws),
  ];
  const examples = [
    ...comment.examples,
    ...signatures.flatMap((signature) => signature.comment.examples),
  ];
  const membersTitle =
    symbol.kind === 'component'
      ? 'Props'
      : symbol.kind === 'class'
        ? 'Members'
        : 'Properties';

  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow api-eyebrow">
          <ApiLink to={`/api/${symbol.entry}`} className="api-eyebrow__link">
            {symbol.importPath}
          </ApiLink>
          <span aria-hidden="true">/</span>
          <ApiLink
            to={`/api/${symbol.entry}#domain-${symbol.domain}`}
            className="api-eyebrow__link"
          >
            {symbol.domainTitle}
          </ApiLink>
        </p>
        <h1 className="doc-title" data-mono="">
          {symbol.name}
        </h1>
        {lede?.type === 'p' ? (
          <p className="doc-lede">
            <RichInlines nodes={lede.children} />
          </p>
        ) : null}
      </header>
      <div className="prose api-prose">
        <ApiSignature symbol={symbol} />
        {symbol.deprecated !== undefined ? (
          <Callout tone="warning" title="Deprecated">
            <p>{symbol.deprecated || 'This export is deprecated.'}</p>
          </Callout>
        ) : null}
        <RichBlocks
          blocks={lede && lede.type !== 'p' ? comment.summary : description}
        />
        <RichBlocks blocks={comment.remarks} />
        {signatures.length > 1
          ? signatures.map((signature, index) => (
              <Fragment key={index}>
                <OverloadHeading index={index} total={signatures.length} />
                <SignatureDetails
                  symbol={symbol}
                  signature={signature}
                  overload={index}
                  returnsComment={comment.returns}
                />
              </Fragment>
            ))
          : signatures.map((signature, index) => (
              <SignatureDetails
                key={index}
                symbol={symbol}
                signature={signature}
                overload={0}
                returnsComment={comment.returns}
              />
            ))}
        {symbol.members.length > 0 ? (
          <>
            <Heading id="members">{membersTitle}</Heading>
            {symbol.propsType ? (
              <p className="api-note">
                From <code>{symbol.propsType}</code>; other attributes pass
                through to the element.
              </p>
            ) : null}
            <Members members={symbol.members} />
          </>
        ) : null}
        {throws.length > 0 ? (
          <>
            <Heading id="throws">Throws</Heading>
            <ul className="api-throws">
              {throws.map((item, index) => (
                <li key={index}>
                  <RichCompact blocks={item} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {examples.length > 0 ? (
          <>
            <Heading id="examples">
              {examples.length > 1 ? 'Examples' : 'Example'}
            </Heading>
            {examples.map((example, index) => (
              <Fragment key={index}>
                {example.caption ? (
                  <p className="api-caption">{example.caption}</p>
                ) : null}
                <CodeBlock
                  html={example.html}
                  code={example.code}
                  lang={example.lang}
                />
              </Fragment>
            ))}
          </>
        ) : null}
        {Notes ? <MdxContent Content={Notes} /> : null}
        {comment.see.length > 0 ? (
          <>
            <Heading id="see-also">See also</Heading>
            <div className="api-see">
              <RichBlocks blocks={comment.see} />
            </div>
          </>
        ) : null}
        {symbol.alsoFrom.length > 0 ? (
          <>
            <Heading id="also-exported-from">Also exported from</Heading>
            <ul className="api-also">
              {symbol.alsoFrom.map((item) => (
                <li key={item.entry}>
                  <ApiLink to={`/api/${item.entry}`} className="api-also__link">
                    <code>{item.importPath}</code>
                  </ApiLink>
                  <span>the same declaration, re-exported</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </>
  );
}
