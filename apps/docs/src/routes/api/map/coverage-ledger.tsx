import type { ApiEntry } from '@/api/model';
import { ApiLink } from '@/components/api/api-link';
import { LegendMark } from './map-marks';
import { KIND_GROUPS, ledgerRows, ledgerTotals } from './map-model';

function percent(part: number, whole: number): string {
  return whole === 0 ? '·' : `${Math.round((part / whole) * 100)}%`;
}

function Count({ value }: { value: number }) {
  return value === 0 ? (
    <td data-zero="">
      <span aria-hidden="true">·</span>
      <span className="visually-hidden">0</span>
    </td>
  ) : (
    <td>{value}</td>
  );
}

/**
 * The export ledger: what each entry point ships, by kind, and how much of
 * it carries a JSDoc summary. "Show" opens that entry on the map.
 */
export function CoverageLedger({
  entries,
  onShow,
}: {
  entries: readonly ApiEntry[];
  onShow: (entry: string) => void;
}) {
  const rows = ledgerRows(entries);
  const total = ledgerTotals(rows);
  return (
    <section className="map-ledger" aria-labelledby="export-ledger">
      <h2 id="export-ledger" className="map-ledger__title">
        <a className="heading-anchor" href="#export-ledger">
          Export ledger
        </a>
      </h2>
      <p className="map-ledger__lede">
        Each export is counted once, in its canonical entry point (the most
        specific one that ships it). Re-exports count where they are also
        importable.
      </p>
      <div
        className="table-scroll map-ledger__scroll"
        tabIndex={0}
        role="region"
        aria-label="Export ledger"
      >
        <table className="map-ledger__table">
          <thead>
            <tr>
              <th scope="col">Entry point</th>
              <th scope="col">Domains</th>
              {KIND_GROUPS.map((kind) => (
                <th key={kind.id} scope="col" title={kind.label}>
                  <span className="map-ledger__kind">
                    <LegendMark group={kind.id} />
                    {kind.short}
                  </span>
                </th>
              ))}
              <th scope="col">Exports</th>
              <th scope="col">Documented</th>
              <th scope="col" title="Exports whose page lives in another entry">
                Re-exports
              </th>
              <th scope="col">
                <span className="visually-hidden">Map</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entry}>
                <th scope="row">
                  <ApiLink to={`/api/${row.entry}`} title={row.summary}>
                    {row.importPath}
                  </ApiLink>
                </th>
                <td>{row.domains}</td>
                {KIND_GROUPS.map((kind) => (
                  <Count key={kind.id} value={row.kinds[kind.id]} />
                ))}
                <td className="map-ledger__strong">{row.exports}</td>
                <td>
                  <span className="map-ledger__meter">
                    <span className="map-ledger__track" aria-hidden="true">
                      <span
                        className="map-ledger__bar"
                        style={{
                          transform: `scaleX(${row.exports ? row.documented / row.exports : 0})`,
                        }}
                      />
                    </span>
                    {percent(row.documented, row.exports)}
                  </span>
                </td>
                <Count value={row.reexports} />
                <td>
                  <button
                    type="button"
                    className="map-ledger__show"
                    onClick={() => onShow(row.entry)}
                  >
                    Show
                    <span className="visually-hidden">
                      {' '}
                      {row.importPath} on the map
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{total.importPath}</th>
              <td>{total.domains}</td>
              {KIND_GROUPS.map((kind) => (
                <td key={kind.id}>{total.kinds[kind.id]}</td>
              ))}
              <td className="map-ledger__strong">{total.exports}</td>
              <td>{percent(total.documented, total.exports)}</td>
              <td>{total.reexports}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
