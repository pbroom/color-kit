export interface ApiTableRow {
  name: string;
  type: string;
  defaultValue?: string;
  description: string;
}

interface ApiTableProps {
  rows: ApiTableRow[];
}

export function ApiTable({ rows }: ApiTableProps) {
  return (
    <div className="not-prose my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
              Prop
            </th>
            <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
              Type
            </th>
            <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
              Default
            </th>
            <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="border border-border px-3 py-2 align-top">
                <code>{row.name}</code>
              </td>
              <td className="border border-border px-3 py-2 align-top">
                <code>{row.type}</code>
              </td>
              <td className="border border-border px-3 py-2 align-top">
                {row.defaultValue ? <code>{row.defaultValue}</code> : '-'}
              </td>
              <td className="border border-border px-3 py-2 align-top text-sm leading-relaxed">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
