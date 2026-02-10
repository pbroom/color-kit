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
      <table className="docs-api-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                {row.defaultValue ? <code>{row.defaultValue}</code> : '-'}
              </td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
