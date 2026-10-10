import { use } from 'react';
import { loadSymbol } from '@/api/data';
import { symbolHref } from '@/api/model';
import { ApiLink } from './api-link';
import { Params } from './params';
import { ApiSignature } from './signature';

/**
 * `<Signature name entry />` in MDX: the generated declaration (and, unless
 * `showParams` is false, the first signature's parameters) of one symbol,
 * with a link to its full reference page. Loaded lazily by
 * `components/ui/signature.tsx` so content pages that never use it do not
 * carry the API data loaders.
 */
export default function GeneratedSignature({
  name,
  entry,
  showParams,
}: {
  name: string;
  entry: string;
  showParams: boolean;
}) {
  const symbol = use(loadSymbol(entry, name));
  const signature = symbol.signatures[0];
  return (
    <>
      <ApiSignature symbol={symbol} />
      {showParams && signature && signature.params.length > 0 ? (
        <div className="breakout signature__params">
          <Params params={signature.params} />
          <p className="signature__more">
            <ApiLink to={symbolHref(entry, name)}>
              Full reference for <code>{name}</code>
            </ApiLink>
          </p>
        </div>
      ) : null}
    </>
  );
}
