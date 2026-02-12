import { useEffect, useMemo, useState } from 'react';
import {
  fromHsl,
  fromHsv,
  fromRgb,
  parse,
  toHex,
  toHct,
  toHsl,
  toHsv,
  toRgb,
  type Color,
} from '@color-kit/core';
import { useLocation } from 'react-router';
import {
  useDocsInspector,
  type ColorAreaFormatRow,
  type ColorAreaLineWidth,
  type ColorAreaStrokeControl,
  type EditableColorAreaFormatRow,
} from './docs-inspector-context.js';

export interface DocsHeading {
  id: string;
  title: string;
  level: 2 | 3;
}

function OutlinePanel({ headings }: { headings: DocsHeading[] }) {
  if (headings.length === 0) {
    return (
      <p className="docs-right-empty">
        This page does not expose section headings yet.
      </p>
    );
  }

  return (
    <nav className="docs-outline-nav" aria-label="On this page">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={
            heading.level === 3
              ? 'docs-outline-link nested'
              : 'docs-outline-link'
          }
        >
          {heading.title}
        </a>
      ))}
    </nav>
  );
}

function SegmentedOptions<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div className="docs-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={`${label}: ${option.label}`}
          aria-pressed={value === option.value}
          className={value === option.value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const FORMAT_ROWS: Array<{
  id: ColorAreaFormatRow;
  label: string;
  editable: boolean;
}> = [
  { id: 'oklch', label: 'OKLCH', editable: true },
  { id: 'hct', label: 'HCT', editable: false },
  { id: 'hsl', label: 'HSL', editable: true },
  { id: 'hsb', label: 'HSB', editable: true },
  { id: 'rgb', label: 'RGB', editable: true },
  { id: 'hex', label: 'Hex', editable: true },
];

const STYLE_OPTIONS: Array<{
  value: ColorAreaStrokeControl['style'];
  label: string;
}> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dots', label: 'Dots' },
];

const WIDTH_OPTIONS: Array<{ value: ColorAreaLineWidth; label: string }> = [
  { value: 0.5, label: '0.5pt' },
  { value: 1, label: '1pt' },
];

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function asNumber(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValues(row: ColorAreaFormatRow, color: Color): string[] {
  if (row === 'oklch') {
    return [
      String(Math.round(color.l * 100)),
      color.c.toFixed(2),
      String(Math.round(color.h)),
      String(Math.round(color.alpha * 100)),
    ];
  }

  if (row === 'hct') {
    const hct = toHct(color);
    return [
      String(Math.round(hct.h)),
      String(Math.round(hct.c)),
      String(Math.round(hct.t)),
      String(Math.round(hct.alpha * 100)),
    ];
  }

  if (row === 'hsl') {
    const hsl = toHsl(color);
    return [
      String(Math.round(hsl.h)),
      String(Math.round(hsl.s)),
      String(Math.round(hsl.l)),
      String(Math.round(hsl.alpha * 100)),
    ];
  }

  if (row === 'hsb') {
    const hsv = toHsv(color);
    return [
      String(Math.round(hsv.h)),
      String(Math.round(hsv.s)),
      String(Math.round(hsv.v)),
      String(Math.round(hsv.alpha * 100)),
    ];
  }

  if (row === 'rgb') {
    const rgb = toRgb(color);
    return [
      String(Math.round(rgb.r)),
      String(Math.round(rgb.g)),
      String(Math.round(rgb.b)),
      String(Math.round(rgb.alpha * 100)),
    ];
  }

  return [toHex(color).toUpperCase(), String(Math.round(color.alpha * 100))];
}

function parseEditableRow(
  row: EditableColorAreaFormatRow,
  values: string[],
  current: Color,
): Color | null {
  if (row === 'oklch') {
    if (values.length !== 4) return null;
    const l = asNumber(values[0]);
    const c = asNumber(values[1]);
    const h = asNumber(values[2]);
    const alpha = asNumber(values[3]);
    if (l === null || c === null || h === null || alpha === null) return null;

    return {
      l: clamp(l / 100, 0, 1),
      c: Math.max(0, c),
      h: ((h % 360) + 360) % 360,
      alpha: clamp(alpha / 100, 0, 1),
    };
  }

  if (row === 'hsl') {
    if (values.length !== 4) return null;
    const h = asNumber(values[0]);
    const s = asNumber(values[1]);
    const l = asNumber(values[2]);
    const alpha = asNumber(values[3]);
    if (h === null || s === null || l === null || alpha === null) return null;

    return fromHsl({
      h,
      s: clamp(s, 0, 100),
      l: clamp(l, 0, 100),
      alpha: clamp(alpha / 100, 0, 1),
    });
  }

  if (row === 'hsb') {
    if (values.length !== 4) return null;
    const h = asNumber(values[0]);
    const s = asNumber(values[1]);
    const v = asNumber(values[2]);
    const alpha = asNumber(values[3]);
    if (h === null || s === null || v === null || alpha === null) return null;

    return fromHsv({
      h,
      s: clamp(s, 0, 100),
      v: clamp(v, 0, 100),
      alpha: clamp(alpha / 100, 0, 1),
    });
  }

  if (row === 'rgb') {
    if (values.length !== 4) return null;
    const r = asNumber(values[0]);
    const g = asNumber(values[1]);
    const b = asNumber(values[2]);
    const alpha = asNumber(values[3]);
    if (r === null || g === null || b === null || alpha === null) return null;

    return fromRgb({
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      alpha: clamp(alpha / 100, 0, 1),
    });
  }

  if (row === 'hex') {
    if (values.length !== 2) return null;
    const alpha = asNumber(values[1]);
    if (alpha === null) return null;

    try {
      const parsed = parse(values[0].trim());
      return {
        ...parsed,
        alpha: clamp(alpha / 100, 0, 1),
      };
    } catch {
      return null;
    }
  }

  return current;
}

function StrokeStylePills({
  value,
  onChange,
}: {
  value: ColorAreaStrokeControl;
  onChange: (next: ColorAreaStrokeControl) => void;
}) {
  return (
    <div className="docs-style-pills" role="group" aria-label="Style controls">
      <div className="docs-style-pill-group" role="group" aria-label="Style">
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value.style === option.value ? 'is-active' : undefined}
            onClick={() => onChange({ ...value, style: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="docs-style-pill-group" role="group" aria-label="Width">
        {WIDTH_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value.width === option.value ? 'is-active' : undefined}
            onClick={() => onChange({ ...value, width: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DotOpacityPills({
  opacityPercent,
  onChange,
}: {
  opacityPercent: number;
  onChange: (opacityPercent: number) => void;
}) {
  return (
    <div className="docs-style-pills" role="group" aria-label="Dot controls">
      <div
        className="docs-style-pill-group"
        role="group"
        aria-label="Pattern style"
      >
        <button type="button" className="is-active">
          Dots
        </button>
      </div>
      <label className="docs-percent-pill" aria-label="Pattern opacity percent">
        <input
          type="number"
          min={0}
          max={100}
          value={opacityPercent}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value) || 0, 0, 100))
          }
        />
        <span>%</span>
      </label>
    </div>
  );
}

function ColorAreaPropertiesPanel() {
  const {
    colorAreaState,
    colorAreaDemos,
    setColorAreaState,
    setColorAreaRequested,
    cycleColorAreaDemo,
  } = useDocsInspector();

  const selectedDemoIndex = useMemo(
    () =>
      colorAreaDemos.findIndex(
        (entry) => entry.id === colorAreaState.selectedDemo,
      ),
    [colorAreaDemos, colorAreaState.selectedDemo],
  );

  const requestedColor = colorAreaState.colorState.requested;
  const activeRow = colorAreaState.activeFormatRow;
  const activeFormattedValues = useMemo(
    () => formatValues(activeRow, requestedColor),
    [activeRow, requestedColor],
  );
  const [activeDraftValues, setActiveDraftValues] = useState(
    activeFormattedValues,
  );

  useEffect(() => {
    setActiveDraftValues(activeFormattedValues);
  }, [activeFormattedValues]);

  const commitActiveFormatDraft = () => {
    const parsed = parseEditableRow(
      activeRow,
      activeDraftValues,
      requestedColor,
    );
    if (!parsed) {
      setActiveDraftValues(activeFormattedValues);
      return;
    }

    setColorAreaRequested(parsed);
  };

  const setStroke = (
    updater: (current: ColorAreaStrokeControl) => ColorAreaStrokeControl,
    path:
      | 'visualize.p3Boundary'
      | 'visualize.srgbBoundary'
      | 'chromaBand.p3'
      | 'chromaBand.srgb'
      | 'contrast.lines.aa3'
      | 'contrast.lines.aa45'
      | 'contrast.lines.aa7',
  ) => {
    if (path === 'visualize.p3Boundary') {
      setColorAreaState({
        visualize: {
          ...colorAreaState.visualize,
          p3Boundary: updater(colorAreaState.visualize.p3Boundary),
        },
      });
      return;
    }

    if (path === 'visualize.srgbBoundary') {
      setColorAreaState({
        visualize: {
          ...colorAreaState.visualize,
          srgbBoundary: updater(colorAreaState.visualize.srgbBoundary),
        },
      });
      return;
    }

    if (path === 'chromaBand.p3') {
      setColorAreaState({
        chromaBand: {
          ...colorAreaState.chromaBand,
          p3: updater(colorAreaState.chromaBand.p3),
        },
      });
      return;
    }

    if (path === 'chromaBand.srgb') {
      setColorAreaState({
        chromaBand: {
          ...colorAreaState.chromaBand,
          srgb: updater(colorAreaState.chromaBand.srgb),
        },
      });
      return;
    }

    if (path === 'contrast.lines.aa3') {
      setColorAreaState({
        contrast: {
          ...colorAreaState.contrast,
          lines: {
            ...colorAreaState.contrast.lines,
            aa3: updater(colorAreaState.contrast.lines.aa3),
          },
        },
      });
      return;
    }

    if (path === 'contrast.lines.aa45') {
      setColorAreaState({
        contrast: {
          ...colorAreaState.contrast,
          lines: {
            ...colorAreaState.contrast.lines,
            aa45: updater(colorAreaState.contrast.lines.aa45),
          },
        },
      });
      return;
    }

    setColorAreaState({
      contrast: {
        ...colorAreaState.contrast,
        lines: {
          ...colorAreaState.contrast.lines,
          aa7: updater(colorAreaState.contrast.lines.aa7),
        },
      },
    });
  };

  return (
    <div className="docs-properties-panel docs-properties-panel-color-area">
      <div className="docs-properties-demo-row">
        <select
          value={colorAreaState.selectedDemo}
          onChange={(event) =>
            setColorAreaState({
              selectedDemo: event.target
                .value as (typeof colorAreaDemos)[number]['id'],
            })
          }
          aria-label="Select color area demo scenario"
        >
          {colorAreaDemos.map((demo) => (
            <option key={demo.id} value={demo.id}>
              {demo.label}
            </option>
          ))}
        </select>
        <div className="docs-demo-pagination">
          <button
            type="button"
            onClick={() => cycleColorAreaDemo(-1)}
            aria-label="Previous color area scenario"
          >
            &lt;
          </button>
          <span>
            {selectedDemoIndex + 1}/{colorAreaDemos.length}
          </span>
          <button
            type="button"
            onClick={() => cycleColorAreaDemo(1)}
            aria-label="Next color area scenario"
          >
            &gt;
          </button>
        </div>
      </div>

      <section className="docs-properties-group">
        <h4>Gamut</h4>

        <div
          className="docs-format-matrix"
          role="group"
          aria-label="Color format matrix"
        >
          {FORMAT_ROWS.map((row) => {
            const rowValues =
              row.id === activeRow
                ? activeDraftValues
                : formatValues(row.id, requestedColor);
            const isActiveEditable = row.id === activeRow && row.editable;

            return (
              <div className="docs-format-row" key={row.id}>
                <button
                  type="button"
                  className={
                    row.editable && row.id === activeRow
                      ? 'docs-format-label is-active'
                      : 'docs-format-label'
                  }
                  onClick={() => {
                    if (!row.editable) return;
                    setColorAreaState({
                      activeFormatRow: row.id as EditableColorAreaFormatRow,
                    });
                  }}
                  aria-label={`Set editable format row to ${row.label}`}
                >
                  {row.label}
                </button>
                <div
                  className="docs-format-swatch"
                  style={{ backgroundColor: toHex(requestedColor) }}
                  aria-hidden="true"
                />
                <div
                  className={
                    rowValues.length === 2
                      ? 'docs-format-input-grid two-col'
                      : 'docs-format-input-grid'
                  }
                >
                  {rowValues.map((value, valueIndex) => {
                    const isLast = valueIndex === rowValues.length - 1;
                    const showPercent =
                      (row.id !== 'hex' && isLast) ||
                      (row.id === 'hex' && valueIndex === 1);

                    return isActiveEditable ? (
                      <label
                        key={`${row.id}-${valueIndex}`}
                        className="docs-format-cell docs-format-cell-editable"
                      >
                        <input
                          type="text"
                          value={value}
                          onChange={(event) => {
                            setActiveDraftValues((current) => {
                              const next = [...current];
                              next[valueIndex] = event.target.value;
                              return next;
                            });
                          }}
                          onBlur={commitActiveFormatDraft}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitActiveFormatDraft();
                            }
                            if (event.key === 'Escape') {
                              setActiveDraftValues(activeFormattedValues);
                            }
                          }}
                        />
                        {showPercent ? <span>%</span> : null}
                      </label>
                    ) : (
                      <div
                        key={`${row.id}-${valueIndex}`}
                        className="docs-format-cell"
                      >
                        <span>{value}</span>
                        {showPercent ? <span>%</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.repeatEdgePixels}
            onChange={(event) =>
              setColorAreaState({ repeatEdgePixels: event.target.checked })
            }
          />
          Repeat gamut edge pixels
        </label>

        <label className="docs-properties-label">x axis</label>
        <SegmentedOptions
          value={colorAreaState.xAxis}
          onChange={(xAxis) => setColorAreaState({ xAxis })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
          ]}
          label="Color area x axis"
        />

        <label className="docs-properties-label">y axis</label>
        <SegmentedOptions
          value={colorAreaState.yAxis}
          onChange={(yAxis) => setColorAreaState({ yAxis })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
          ]}
          label="Color area y axis"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Background</h4>

        <div className="docs-inline-control-row">
          <span>Out of OKLCH</span>
          <div className="docs-inline-control-value">
            <input
              type="text"
              value={colorAreaState.background.outOfP3.color}
              onChange={(event) =>
                setColorAreaState({
                  background: {
                    ...colorAreaState.background,
                    outOfP3: {
                      ...colorAreaState.background.outOfP3,
                      color: event.target.value,
                    },
                  },
                })
              }
              aria-label="Out of OKLCH background color"
            />
            <label>
              <input
                type="number"
                min={0}
                max={100}
                value={colorAreaState.background.outOfP3.opacityPercent}
                onChange={(event) =>
                  setColorAreaState({
                    background: {
                      ...colorAreaState.background,
                      outOfP3: {
                        ...colorAreaState.background.outOfP3,
                        opacityPercent: clamp(
                          Number(event.target.value) || 0,
                          0,
                          100,
                        ),
                      },
                    },
                  })
                }
                aria-label="Out of OKLCH opacity"
              />
              <span>%</span>
            </label>
          </div>
        </div>

        <div className="docs-inline-control-row">
          <span>Out of sRGB</span>
          <div className="docs-inline-control-value">
            <input
              type="text"
              value={colorAreaState.background.outOfSrgb.color}
              onChange={(event) =>
                setColorAreaState({
                  background: {
                    ...colorAreaState.background,
                    outOfSrgb: {
                      ...colorAreaState.background.outOfSrgb,
                      color: event.target.value,
                    },
                  },
                })
              }
              aria-label="Out of sRGB background color"
            />
            <label>
              <input
                type="number"
                min={0}
                max={100}
                value={colorAreaState.background.outOfSrgb.opacityPercent}
                onChange={(event) =>
                  setColorAreaState({
                    background: {
                      ...colorAreaState.background,
                      outOfSrgb: {
                        ...colorAreaState.background.outOfSrgb,
                        opacityPercent: clamp(
                          Number(event.target.value) || 0,
                          0,
                          100,
                        ),
                      },
                    },
                  })
                }
                aria-label="Out of sRGB opacity"
              />
              <span>%</span>
            </label>
          </div>
        </div>

        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.background.checkerboard}
            onChange={(event) =>
              setColorAreaState({
                background: {
                  ...colorAreaState.background,
                  checkerboard: event.target.checked,
                },
              })
            }
          />
          Checkerboard
        </label>
      </section>

      <section className="docs-properties-group">
        <h4>Visualize</h4>

        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.visualize.p3Fallback}
            onChange={(event) =>
              setColorAreaState({
                visualize: {
                  ...colorAreaState.visualize,
                  p3Fallback: event.target.checked,
                },
              })
            }
          />
          P3 fallback
        </label>

        <label className="docs-toggle-row">
          <input
            type="checkbox"
            checked={colorAreaState.visualize.srgbFallback}
            onChange={(event) =>
              setColorAreaState({
                visualize: {
                  ...colorAreaState.visualize,
                  srgbFallback: event.target.checked,
                },
              })
            }
          />
          sRGB fallback
        </label>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.visualize.p3Boundary.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'visualize.p3Boundary',
                )
              }
            />
            P3 boundary
          </label>
          <StrokeStylePills
            value={colorAreaState.visualize.p3Boundary}
            onChange={(next) => setStroke(() => next, 'visualize.p3Boundary')}
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.visualize.srgbBoundary.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'visualize.srgbBoundary',
                )
              }
            />
            sRGB boundary
          </label>
          <StrokeStylePills
            value={colorAreaState.visualize.srgbBoundary}
            onChange={(next) => setStroke(() => next, 'visualize.srgbBoundary')}
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.visualize.patternOverlay.enabled}
              onChange={(event) =>
                setColorAreaState({
                  visualize: {
                    ...colorAreaState.visualize,
                    patternOverlay: {
                      ...colorAreaState.visualize.patternOverlay,
                      enabled: event.target.checked,
                    },
                  },
                })
              }
            />
            Pattern overlay
          </label>
          <DotOpacityPills
            opacityPercent={
              colorAreaState.visualize.patternOverlay.opacityPercent
            }
            onChange={(opacityPercent) =>
              setColorAreaState({
                visualize: {
                  ...colorAreaState.visualize,
                  patternOverlay: {
                    ...colorAreaState.visualize.patternOverlay,
                    opacityPercent,
                  },
                },
              })
            }
          />
        </div>
      </section>

      <section className="docs-properties-group">
        <h4>Chroma band</h4>

        <label className="docs-properties-label">Chroma band</label>
        <SegmentedOptions
          value={colorAreaState.chromaBand.mode}
          onChange={(mode) =>
            setColorAreaState({
              chromaBand: {
                ...colorAreaState.chromaBand,
                mode,
              },
            })
          }
          options={[
            { value: 'closest', label: 'Closest' },
            { value: 'percentage', label: 'Percentage' },
          ]}
          label="Chroma band mode"
        />

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.chromaBand.p3.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'chromaBand.p3',
                )
              }
            />
            P3 chroma band
          </label>
          <StrokeStylePills
            value={colorAreaState.chromaBand.p3}
            onChange={(next) => setStroke(() => next, 'chromaBand.p3')}
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.chromaBand.srgb.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'chromaBand.srgb',
                )
              }
            />
            sRGB chroma band
          </label>
          <StrokeStylePills
            value={colorAreaState.chromaBand.srgb}
            onChange={(next) => setStroke(() => next, 'chromaBand.srgb')}
          />
        </div>
      </section>

      <section className="docs-properties-group">
        <h4>Contrast</h4>

        <p className="docs-subgroup-label">Lines</p>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.lines.aa3.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'contrast.lines.aa3',
                )
              }
            />
            3:1 (AA)
          </label>
          <StrokeStylePills
            value={colorAreaState.contrast.lines.aa3}
            onChange={(next) => setStroke(() => next, 'contrast.lines.aa3')}
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.lines.aa45.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'contrast.lines.aa45',
                )
              }
            />
            4.5:1 (AA)
          </label>
          <StrokeStylePills
            value={colorAreaState.contrast.lines.aa45}
            onChange={(next) => setStroke(() => next, 'contrast.lines.aa45')}
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.lines.aa7.enabled}
              onChange={(event) =>
                setStroke(
                  (current) => ({ ...current, enabled: event.target.checked }),
                  'contrast.lines.aa7',
                )
              }
            />
            7:1 (AA)
          </label>
          <StrokeStylePills
            value={colorAreaState.contrast.lines.aa7}
            onChange={(next) => setStroke(() => next, 'contrast.lines.aa7')}
          />
        </div>

        <p className="docs-subgroup-label">Regions</p>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.regions.aa3.enabled}
              onChange={(event) =>
                setColorAreaState({
                  contrast: {
                    ...colorAreaState.contrast,
                    regions: {
                      ...colorAreaState.contrast.regions,
                      aa3: {
                        ...colorAreaState.contrast.regions.aa3,
                        enabled: event.target.checked,
                      },
                    },
                  },
                })
              }
            />
            3:1 (AA)
          </label>
          <DotOpacityPills
            opacityPercent={colorAreaState.contrast.regions.aa3.opacityPercent}
            onChange={(opacityPercent) =>
              setColorAreaState({
                contrast: {
                  ...colorAreaState.contrast,
                  regions: {
                    ...colorAreaState.contrast.regions,
                    aa3: {
                      ...colorAreaState.contrast.regions.aa3,
                      opacityPercent,
                    },
                  },
                },
              })
            }
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.regions.aa45.enabled}
              onChange={(event) =>
                setColorAreaState({
                  contrast: {
                    ...colorAreaState.contrast,
                    regions: {
                      ...colorAreaState.contrast.regions,
                      aa45: {
                        ...colorAreaState.contrast.regions.aa45,
                        enabled: event.target.checked,
                      },
                    },
                  },
                })
              }
            />
            4.5:1 (AA)
          </label>
          <DotOpacityPills
            opacityPercent={colorAreaState.contrast.regions.aa45.opacityPercent}
            onChange={(opacityPercent) =>
              setColorAreaState({
                contrast: {
                  ...colorAreaState.contrast,
                  regions: {
                    ...colorAreaState.contrast.regions,
                    aa45: {
                      ...colorAreaState.contrast.regions.aa45,
                      opacityPercent,
                    },
                  },
                },
              })
            }
          />
        </div>

        <div className="docs-control-row">
          <label className="docs-toggle-row">
            <input
              type="checkbox"
              checked={colorAreaState.contrast.regions.aa7.enabled}
              onChange={(event) =>
                setColorAreaState({
                  contrast: {
                    ...colorAreaState.contrast,
                    regions: {
                      ...colorAreaState.contrast.regions,
                      aa7: {
                        ...colorAreaState.contrast.regions.aa7,
                        enabled: event.target.checked,
                      },
                    },
                  },
                })
              }
            />
            7:1 (AA)
          </label>
          <DotOpacityPills
            opacityPercent={colorAreaState.contrast.regions.aa7.opacityPercent}
            onChange={(opacityPercent) =>
              setColorAreaState({
                contrast: {
                  ...colorAreaState.contrast,
                  regions: {
                    ...colorAreaState.contrast.regions,
                    aa7: {
                      ...colorAreaState.contrast.regions.aa7,
                      opacityPercent,
                    },
                  },
                },
              })
            }
          />
        </div>
      </section>
    </div>
  );
}

function ColorSliderPropertiesPanel() {
  const { colorSliderState, setColorSliderState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Channel</h4>
        <SegmentedOptions
          value={colorSliderState.channel}
          onChange={(channel) => setColorSliderState({ channel })}
          options={[
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
            { value: 'alpha', label: 'A' },
          ]}
          label="Color slider channel"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Output gamut</h4>
        <SegmentedOptions
          value={colorSliderState.gamut}
          onChange={(gamut) => setColorSliderState({ gamut })}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
          label="Color slider gamut"
        />
      </section>
    </div>
  );
}

function ColorInputPropertiesPanel() {
  const { colorInputState, setColorInputState } = useDocsInspector();
  const channelOptions =
    colorInputState.model === 'rgb'
      ? [
          { value: 'r', label: 'R' },
          { value: 'g', label: 'G' },
          { value: 'b', label: 'B' },
          { value: 'alpha', label: 'A' },
        ]
      : colorInputState.model === 'hsl'
        ? [
            { value: 'h', label: 'H' },
            { value: 's', label: 'S' },
            { value: 'l', label: 'L' },
            { value: 'alpha', label: 'A' },
          ]
        : [
            { value: 'l', label: 'L' },
            { value: 'c', label: 'C' },
            { value: 'h', label: 'H' },
            { value: 'alpha', label: 'A' },
          ];

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Input model</h4>
        <SegmentedOptions
          value={colorInputState.model}
          onChange={(model) => setColorInputState({ model })}
          options={[
            { value: 'oklch', label: 'oklch' },
            { value: 'rgb', label: 'rgb' },
            { value: 'hsl', label: 'hsl' },
          ]}
          label="Color input model"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Input channel</h4>
        <SegmentedOptions
          value={colorInputState.channel}
          onChange={(channel) => setColorInputState({ channel })}
          options={channelOptions}
          label="Color input channel"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Output gamut</h4>
        <SegmentedOptions
          value={colorInputState.gamut}
          onChange={(gamut) => setColorInputState({ gamut })}
          options={[
            { value: 'display-p3', label: 'P3' },
            { value: 'srgb', label: 'sRGB' },
          ]}
          label="Color input gamut"
        />
      </section>
    </div>
  );
}

function SwatchGroupPropertiesPanel() {
  const { swatchGroupState, setSwatchGroupState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Palette</h4>
        <SegmentedOptions
          value={swatchGroupState.palette}
          onChange={(palette) => setSwatchGroupState({ palette })}
          options={[
            { value: 'spectrum', label: 'Spectrum' },
            { value: 'nature', label: 'Nature' },
            { value: 'neon', label: 'Neon' },
          ]}
          label="Swatch group palette"
        />
      </section>

      <section className="docs-properties-group">
        <h4>Columns</h4>
        <SegmentedOptions
          value={String(swatchGroupState.columns)}
          onChange={(columns) =>
            setSwatchGroupState({ columns: Number(columns) as 3 | 4 | 5 })
          }
          options={[
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' },
          ]}
          label="Swatch group columns"
        />
      </section>
    </div>
  );
}

function ContrastBadgePropertiesPanel() {
  const { contrastBadgeState, setContrastBadgeState } = useDocsInspector();

  return (
    <div className="docs-properties-panel">
      <section className="docs-properties-group">
        <h4>Preset</h4>
        <SegmentedOptions
          value={contrastBadgeState.preset}
          onChange={(preset) => setContrastBadgeState({ preset })}
          options={[
            { value: 'interface', label: 'Interface' },
            { value: 'editorial', label: 'Editorial' },
            { value: 'alert', label: 'Alert' },
          ]}
          label="Contrast badge color preset"
        />
      </section>

      <section className="docs-properties-group">
        <h4>WCAG level</h4>
        <SegmentedOptions
          value={contrastBadgeState.level}
          onChange={(level) => setContrastBadgeState({ level })}
          options={[
            { value: 'AA', label: 'AA' },
            { value: 'AAA', label: 'AAA' },
          ]}
          label="Contrast badge level"
        />
      </section>
    </div>
  );
}

const PROPERTIES_PANELS = {
  '/docs/components/color-area': ColorAreaPropertiesPanel,
  '/docs/components/color-slider': ColorSliderPropertiesPanel,
  '/docs/components/color-input': ColorInputPropertiesPanel,
  '/docs/components/swatch-group': SwatchGroupPropertiesPanel,
  '/docs/components/contrast-badge': ContrastBadgePropertiesPanel,
} as const;

export function DocsRightRail({ headings }: { headings: DocsHeading[] }) {
  const { pathname } = useLocation();
  const { activeTab, setActiveTab } = useDocsInspector();
  const PropertiesPanel =
    PROPERTIES_PANELS[pathname as keyof typeof PROPERTIES_PANELS];

  return (
    <aside className="docs-right-rail">
      <div
        className="docs-right-tabs"
        role="tablist"
        aria-label="Docs side panels"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'outline'}
          className={activeTab === 'outline' ? 'is-active' : undefined}
          onClick={() => setActiveTab('outline')}
        >
          On this page
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'properties'}
          className={activeTab === 'properties' ? 'is-active' : undefined}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
      </div>

      {activeTab === 'outline' ? (
        <OutlinePanel headings={headings} />
      ) : PropertiesPanel ? (
        <PropertiesPanel />
      ) : (
        <p className="docs-right-empty">
          No live demo controls are available for this page yet.
        </p>
      )}
    </aside>
  );
}
