import { useState } from 'react';
import { runHotLoopBench, type BenchRow } from './hot-loop-bench';
import { Readout } from './controls';

export default function HotLoopBenchDemo() {
  const [rows, setRows] = useState<BenchRow[] | null>(null);

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setRows(runHotLoopBench())}
        className="justify-self-start rounded-sm border border-border px-3 py-1 text-[13px] text-foreground"
      >
        {rows ? 'Run again' : 'Run benchmark'}
      </button>
      {rows ? (
        <Readout
          rows={rows.map((row) => [
            row.name,
            `${row.nsPerColor.toFixed(0)} ns / color`,
          ])}
        />
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          40,000 colors, best of five runs, on the main thread.
        </p>
      )}
    </div>
  );
}
