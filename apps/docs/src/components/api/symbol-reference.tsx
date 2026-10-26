import { Fragment } from 'react';
import {
  panelAnchor,
  type ApiSignature as ApiSignatureModel,
  type ApiSymbol,
} from '@/api/model';
import type { MdxPage } from '@/api/data';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { PanelMdxContent } from './mdx-content';
import { ApiLink } from './api-link';
import { Members, Params } from './params';
import { RichBlocks, RichCompact } from './rich-text';
import { ApiSignature } from './signature';
import { TypeView } from './type-link';

/**
 * A section heading inside a symbol's panel. Ids carry the symbol's name
 * (`toRgb-parameters`), so the many panels of a category page never collide.
 */
function Heading({
  owner,
  id,
  children,
}: {
  owner: string;
  id: string;
  children: string;
}) {
  const anchor = panelAnchor(owner, id);
  return (
    <h3 id={anchor} className="api-panel__heading">
      <a className="heading-anchor" href={`#${encodeURIComponent(anchor)}`}>
        {children}
      </a>
    </h3>
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
          <Heading owner={symbol.name} id={`parameters${suffix}`}>
            Parameters
          </Heading>
          <Params
            owner={symbol.name}
            params={signature.params}
            overload={overload}
          />
        </>
      ) : null}
      {showReturns ? (
        <>
          <Heading owner={symbol.name} id={`returns${suffix}`}>
            Returns
          </Heading>
          <Returns
            signature={merged}
            showType={!QUIET_RETURNS.has(merged.returns.text)}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * The full reference of one export, shown in its row's panel on the
 * category page: summary and description, the declaration (import line,
 * source link), deprecation, remarks, parameters and returns per overload,
 * members or props, throws, examples, optional MDX notes
 * (`content/api/<entry>/<Symbol>.mdx`), see also, and the other entry
 * points that export the same declaration. Every id is prefixed with the
 * symbol's name.
 */
export function SymbolReference({
  symbol,
  Notes,
}: {
  symbol: ApiSymbol;
  Notes?: MdxPage | null;
}) {
  const { comment } = symbol;
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
  const owner = symbol.name;

  return (
    <>
      <RichBlocks blocks={comment.summary} />
      <ApiSignature symbol={symbol} />
      {symbol.deprecated !== undefined ? (
        <Callout tone="warning" title="Deprecated">
          <p>{symbol.deprecated || 'This export is deprecated.'}</p>
        </Callout>
      ) : null}
      <RichBlocks blocks={comment.remarks} />
      {signatures.map((signature, index) => (
        <Fragment key={index}>
          {signatures.length > 1 ? (
            <Heading owner={owner} id={`overload-${index + 1}`}>
              {`Overload ${index + 1} of ${signatures.length}`}
            </Heading>
          ) : null}
          <SignatureDetails
            symbol={symbol}
            signature={signature}
            overload={index}
            returnsComment={comment.returns}
          />
        </Fragment>
      ))}
      {symbol.members.length > 0 ? (
        <>
          <Heading owner={owner} id="members">
            {membersTitle}
          </Heading>
          {symbol.propsType ? (
            <p className="api-note">
              From <code>{symbol.propsType}</code>; other attributes pass
              through to the element.
            </p>
          ) : null}
          <Members owner={owner} members={symbol.members} />
        </>
      ) : null}
      {throws.length > 0 ? (
        <>
          <Heading owner={owner} id="throws">
            Throws
          </Heading>
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
          <Heading owner={owner} id="examples">
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
      {Notes ? <PanelMdxContent Content={Notes} owner={owner} /> : null}
      {comment.see.length > 0 ? (
        <>
          <Heading owner={owner} id="see-also">
            See also
          </Heading>
          <div className="api-see">
            <RichBlocks blocks={comment.see} />
          </div>
        </>
      ) : null}
      {symbol.alsoFrom.length > 0 ? (
        <>
          <Heading owner={owner} id="also-exported-from">
            Also exported from
          </Heading>
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
    </>
  );
}
