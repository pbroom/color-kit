import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    <div className="not-prose my-6 rounded-xl border bg-card/70 p-2 shadow-xs">
      <Table className="docs-api-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[14ch]">Prop</TableHead>
            <TableHead className="w-[24ch]">Type</TableHead>
            <TableHead className="w-[12ch]">Default</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="align-top">
                <code>{row.name}</code>
              </TableCell>
              <TableCell className="align-top">
                <code>{row.type}</code>
              </TableCell>
              <TableCell className="align-top">
                {row.defaultValue ? <code>{row.defaultValue}</code> : '-'}
              </TableCell>
              <TableCell>{row.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
