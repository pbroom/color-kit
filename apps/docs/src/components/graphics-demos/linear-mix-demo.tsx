import { useState } from 'react';
import { parse } from 'color-kit';
import { DEMO_ROWS, midpointStats, mixStrip } from './linear-mix.js';
import { DemoFrame } from './demo-frame.js';

const PRESETS = [
  { label: 'Red ↔ lime', from: '#ff0000', to: '#00ff00' },
  { label: 'Black ↔ white', from: '#000000', to: '#ffffff' },
  { label: 'Blue ↔ yellow', from: '#0000ff', to: '#ffff00' },
] as const;

function formatNumber(value: number): string {
  return value.toFixed(4);
}

export default function LinearMixDemo() {
  const [fromHex, setFromHex] = useState<string>(PRESETS[0].from);
  const [toHex, setToHex] = useState<string>(PRESETS[0].to);
  const from = parse(fromHex);
  const to = parse(toHex);

  return (
    <DemoFrame label="Live demo: mix(a, b, t, options?)">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">From</span>
          <input
            type="color"
            aria-label="Start color"
            value={fromHex}
            onChange={(event) => setFromHex(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <code className="text-xs">{fromHex}</code>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">To</span>
          <input
            type="color"
            aria-label="End color"
            value={toHex}
            onChange={(event) => setToHex(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <code className="text-xs">{toHex}</code>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              onClick={() => {
                setFromHex(preset.from);
                setToHex(preset.to);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="w-[19ch] font-medium">options</th>
              <th className="font-medium">13-step ramp (generateScale)</th>
              <th className="w-[8rem] font-medium">t = 0.5</th>
              <th className="w-[8ch] font-medium">OKLab L</th>
              <th className="w-[8ch] font-medium">Y</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ROWS.map((row) => {
              const strip = mixStrip(from, to, row.options);
              const stats = midpointStats(from, to, row.options);
              return (
                <tr key={row.id} data-space={row.id}>
                  <td>
                    <code className="whitespace-nowrap">{row.label}</code>
                    {row.options === undefined ? (
                      <span className="block text-[10px] text-muted-foreground">
                        legacy OKLCH default
                      </span>
                    ) : row.id === 'oklch' ? (
                      <span className="block text-[10px] text-muted-foreground">
                        CSS color-mix() path
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex h-8 overflow-hidden rounded-md border border-border/60">
                      {strip.map((hex, index) => (
                        <div
                          key={index}
                          className="flex-1"
                          style={{ background: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-6 shrink-0 rounded border border-border/60"
                        style={{ background: stats.hex }}
                      />
                      <span>
                        <code data-testid="midpoint-hex">{stats.hex}</code>
                        {stats.inSrgb ? null : (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                            out of sRGB
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="tabular-nums">{formatNumber(stats.oklabL)}</td>
                  <td className="tabular-nums">
                    {formatNumber(stats.luminanceY)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Y is relative luminance from unclamped linear sRGB. Hex values of
        out-of-gamut midpoints are clipped for display.
      </p>
    </DemoFrame>
  );
}
