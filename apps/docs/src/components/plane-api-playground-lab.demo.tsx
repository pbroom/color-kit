import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  definePlane,
  inspectPlaneQuery,
  parse,
  toSvgCompoundPath,
  type PlaneQueryTraceStage,
} from 'color-kit';

type QueryMode = 'gamut' | 'contrast';
type TraceLevel = 'summary' | 'stages' | 'full';

const plane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0.4, 0] },
  fixed: { h: 250, alpha: 1 },
});

const contrastReference = parse('#111827');
const contrastMaxChroma = 0.4;

const gamutQuery = {
  kind: 'gamutRegion',
  gamut: 'srgb',
  scope: 'viewport',
  simplifyTolerance: 0.0015,
} as const;

const contrastQuery = {
  kind: 'contrastRegion',
  reference: contrastReference,
  metric: 'wcag',
  threshold: 4.5,
  samplingMode: 'hybrid',
  lightnessSteps: 72,
  chromaSteps: 96,
  maxChroma: contrastMaxChroma,
  hybridMaxDepth: 6,
  hybridErrorTolerance: 0.0015,
  simplifyTolerance: 0.0015,
} as const;

function stageLabel(stage: PlaneQueryTraceStage): string {
  if ('label' in stage && stage.label) {
    return `${stage.kind}: ${stage.label}`;
  }
  if (stage.kind === 'solver') {
    return `${stage.kind}: ${stage.solver}`;
  }
  return stage.kind;
}

function normalizeContrastTracePoint(
  point: { x: number; y: number },
  maxChroma: number,
): { x: number; y: number } {
  return {
    x: point.x,
    y: 1 - point.y / maxChroma,
  };
}

function normalizeTracePaths(
  stage: PlaneQueryTraceStage,
  queryMode: QueryMode,
  maxChroma: number,
) {
  if (!('paths' in stage) || !stage.paths) {
    return [];
  }
  if (queryMode === 'gamut') {
    return stage.paths;
  }
  return stage.paths.map((path) =>
    path.map((point) => normalizeContrastTracePoint(point, maxChroma)),
  );
}

function describeStage(stage: PlaneQueryTraceStage): string {
  switch (stage.kind) {
    case 'scalarGrid':
      return `${stage.sampleCount} samples, ${stage.resolution} steps, range ${stage.minValue.toFixed(3)} to ${stage.maxValue.toFixed(3)}`;
    case 'marchingSquares':
      return `${stage.cellCount} cells, ${stage.segmentCount} segments`;
    case 'paths':
      return `${stage.pathCount} paths, ${stage.pointCount} points`;
    case 'cusp':
      return `h ${stage.hue.toFixed(1)}, l ${stage.lightness.toFixed(3)}, c ${stage.chroma.toFixed(3)}`;
    case 'hybridSamples':
      return `${stage.samples.length} traced lightness samples`;
    case 'rootBisection':
      return `root ${stage.root.toFixed(4)} at l ${stage.lightness.toFixed(4)}`;
    case 'refinement':
      return `${stage.decisions.length} refinement decisions`;
    case 'branching':
      return `${stage.finishedCount} finished paths, ${stage.activeCount} active branches`;
    case 'viewportClassification':
      return `${stage.relation} (${stage.minValue.toFixed(3)} to ${stage.maxValue.toFixed(3)})`;
    case 'metrics':
      return `${stage.summary.sampleCount} samples, ${stage.summary.segmentCount} segments`;
    case 'solver':
      return `${stage.solver} / ${stage.samplingMode ?? 'n/a'}`;
    default:
      return 'trace-stage';
  }
}

function renderStageOverlay(
  stage: PlaneQueryTraceStage | undefined,
  queryMode: QueryMode,
  maxChroma: number,
): ReactNode {
  if (!stage) return null;

  if (stage.kind === 'scalarGrid' && stage.values) {
    const points = [];
    for (let y = 0; y < stage.values.length; y += 1) {
      for (let x = 0; x < stage.values[y].length; x += 1) {
        const point = {
          x:
            stage.bounds.minX +
            ((stage.bounds.maxX - stage.bounds.minX) * x) / stage.resolution,
          y:
            stage.bounds.minY +
            ((stage.bounds.maxY - stage.bounds.minY) * y) / stage.resolution,
        };
        const normalized =
          queryMode === 'gamut'
            ? point
            : normalizeContrastTracePoint(point, maxChroma);
        if (
          normalized.x < 0 ||
          normalized.x > 1 ||
          normalized.y < 0 ||
          normalized.y > 1
        ) {
          continue;
        }
        points.push(
          <circle
            key={`${x}-${y}`}
            cx={normalized.x * 100}
            cy={normalized.y * 100}
            r={0.7}
            fill={stage.values[y][x] >= 0 ? '#10b981' : '#ef4444'}
            opacity={0.55}
          />,
        );
      }
    }
    return points;
  }

  if (stage.kind === 'marchingSquares' && stage.cells) {
    return stage.cells.map((cell, index) => {
      if (!cell.points.length) return null;
      const segments = [];
      for (
        let pointIndex = 0;
        pointIndex < cell.points.length;
        pointIndex += 2
      ) {
        const from = cell.points[pointIndex];
        const to = cell.points[pointIndex + 1];
        if (!from || !to) continue;
        const normalizedFrom =
          queryMode === 'gamut'
            ? from
            : normalizeContrastTracePoint(from, maxChroma);
        const normalizedTo =
          queryMode === 'gamut'
            ? to
            : normalizeContrastTracePoint(to, maxChroma);
        segments.push(
          <line
            key={`${index}-${pointIndex}`}
            x1={normalizedFrom.x * 100}
            y1={normalizedFrom.y * 100}
            x2={normalizedTo.x * 100}
            y2={normalizedTo.y * 100}
            stroke="#f97316"
            strokeWidth="0.9"
            opacity="0.8"
          />,
        );
      }
      return segments;
    });
  }

  if (stage.kind === 'paths' || stage.kind === 'branching') {
    const paths = normalizeTracePaths(stage, queryMode, maxChroma);
    if (!paths.length) return null;
    return (
      <path
        d={toSvgCompoundPath(paths)}
        fill="none"
        stroke={stage.kind === 'branching' ? '#8b5cf6' : '#f97316'}
        strokeWidth="1.2"
        opacity="0.9"
      />
    );
  }

  if (stage.kind === 'cusp') {
    const point =
      queryMode === 'gamut'
        ? { x: stage.lightness, y: 1 - stage.chroma / maxChroma }
        : normalizeContrastTracePoint(
            { x: stage.lightness, y: stage.chroma },
            maxChroma,
          );
    return (
      <circle
        cx={point.x * 100}
        cy={point.y * 100}
        r="2"
        fill="#a855f7"
        stroke="#ffffff"
        strokeWidth="0.6"
      />
    );
  }

  if (stage.kind === 'hybridSamples') {
    return stage.samples.flatMap((sample, sampleIndex) =>
      sample.roots.map((root, rootIndex) => {
        const point = normalizeContrastTracePoint(
          { x: sample.lightness, y: root },
          maxChroma,
        );
        return (
          <circle
            key={`${sampleIndex}-${rootIndex}`}
            cx={point.x * 100}
            cy={point.y * 100}
            r="1.2"
            fill="#06b6d4"
            opacity="0.85"
          />
        );
      }),
    );
  }

  if (stage.kind === 'rootBisection') {
    const point = normalizeContrastTracePoint(
      { x: stage.lightness, y: stage.root },
      maxChroma,
    );
    return (
      <circle
        cx={point.x * 100}
        cy={point.y * 100}
        r="1.4"
        fill="#14b8a6"
        stroke="#ffffff"
        strokeWidth="0.5"
      />
    );
  }

  if (stage.kind === 'refinement') {
    return stage.decisions.map((decision, index) => (
      <line
        key={index}
        x1={decision.midpoint * 100}
        y1="0"
        x2={decision.midpoint * 100}
        y2="100"
        stroke={decision.split ? '#f59e0b' : '#94a3b8'}
        strokeDasharray="2 2"
        strokeWidth="0.7"
        opacity="0.55"
      />
    ));
  }

  return null;
}

export default function PlaneLabDemo() {
  const [queryMode, setQueryMode] = useState<QueryMode>('gamut');
  const [traceLevel, setTraceLevel] = useState<TraceLevel>('full');
  const [showResult, setShowResult] = useState(true);
  const [showStageOverlay, setShowStageOverlay] = useState(true);
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  const inspection = useMemo(
    () =>
      inspectPlaneQuery(
        plane,
        queryMode === 'gamut' ? gamutQuery : contrastQuery,
        {
          level: traceLevel,
          includeScalarGrid: traceLevel === 'full',
          maxStageEntries: 96,
        },
      ),
    [queryMode, traceLevel],
  );

  const maxChroma = contrastQuery.maxChroma;
  const stages = inspection.trace.stages;
  const safeStageIndex =
    activeStageIndex >= 0 && activeStageIndex < stages.length
      ? activeStageIndex
      : 0;
  const activeStage = stages[safeStageIndex];

  const resultRegionPath = useMemo(() => {
    if (inspection.result.kind === 'gamutRegion') {
      return toSvgCompoundPath(inspection.result.visibleRegion.paths);
    }
    if (inspection.result.kind === 'contrastRegion') {
      return toSvgCompoundPath(inspection.result.paths);
    }
    return '';
  }, [inspection]);

  const resultBoundaryPath = useMemo(() => {
    if (inspection.result.kind === 'gamutRegion') {
      return toSvgCompoundPath(inspection.result.boundaryPaths);
    }
    if (inspection.result.kind === 'contrastRegion') {
      return toSvgCompoundPath(inspection.result.paths);
    }
    return '';
  }, [inspection]);

  return (
    <div
      style={{
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'grid',
        gap: 12,
        boxSizing: 'border-box',
        minHeight: '100vh',
        padding: 16,
        background: '#0a0a0a',
        color: '#e6edf3',
        lineHeight: 1.45,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => setQueryMode('gamut')}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #30363d',
              background:
                queryMode === 'gamut' ? 'rgba(56,139,253,0.18)' : '#161b22',
              color: queryMode === 'gamut' ? '#79c0ff' : '#e6edf3',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Gamut Region
          </button>
          <button
            onClick={() => setQueryMode('contrast')}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #30363d',
              background:
                queryMode === 'contrast'
                  ? 'rgba(163,113,247,0.22)'
                  : '#161b22',
              color: queryMode === 'contrast' ? '#d2a8ff' : '#e6edf3',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Contrast Region
          </button>
          <select
            value={traceLevel}
            onChange={(event) => {
              setTraceLevel(event.target.value as TraceLevel);
              setActiveStageIndex(0);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#161b22',
              color: '#e6edf3',
              fontSize: 13,
            }}
          >
            <option value="summary">summary</option>
            <option value="stages">stages</option>
            <option value="full">full</option>
          </select>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            color: '#8b949e',
            fontSize: 13,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showResult}
              onChange={(event) => setShowResult(event.target.checked)}
            />
            Result geometry
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showStageOverlay}
              onChange={(event) => setShowStageOverlay(event.target.checked)}
            />
            Active stage overlay
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Plane query trace visualization"
          style={{
            width: '100%',
            maxWidth: 420,
            aspectRatio: '1 / 1',
            display: 'block',
            margin: '0 auto',
          }}
        >
          <rect x="0" y="0" width="100" height="100" fill="#010409" />
          <g opacity="0.35" stroke="#21262d" strokeWidth="0.4">
            {[20, 40, 60, 80].map((value) => (
              <g key={value}>
                <line x1={value} y1="0" x2={value} y2="100" />
                <line x1="0" y1={value} x2="100" y2={value} />
              </g>
            ))}
          </g>

          {showResult && resultRegionPath ? (
            <path
              d={resultRegionPath}
              fill={
                queryMode === 'gamut'
                  ? 'rgba(88,166,255,0.22)'
                  : 'rgba(63,185,80,0.22)'
              }
              stroke="none"
            />
          ) : null}
          {showResult && resultBoundaryPath ? (
            <path
              d={resultBoundaryPath}
              fill="none"
              stroke={queryMode === 'gamut' ? '#58a6ff' : '#3fb950'}
              strokeWidth="1.4"
            />
          ) : null}
          {showStageOverlay
            ? renderStageOverlay(activeStage, queryMode, maxChroma)
            : null}
        </svg>

        <div
          style={{
            display: 'grid',
            gap: 10,
            color: '#e6edf3',
          }}
        >
          <strong style={{ fontSize: 14, fontWeight: 600 }}>Metrics</strong>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              fontSize: 13,
              color: '#8b949e',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div>solver: {inspection.trace.summary.solver ?? 'n/a'}</div>
            <div>
              relation: {inspection.trace.summary.viewportRelation ?? 'n/a'}
            </div>
            <div>
              time: {inspection.trace.summary.totalTimeMs.toFixed(2)} ms
            </div>
            <div>samples: {inspection.trace.summary.sampleCount}</div>
            <div>cells: {inspection.trace.summary.cellCount}</div>
            <div>segments: {inspection.trace.summary.segmentCount}</div>
            <div>result paths: {inspection.trace.summary.resultPathCount}</div>
            <div>
              result points: {inspection.trace.summary.resultPointCount}
            </div>
            {inspection.trace.summary.timings?.compute != null ? (
              <div>
                compute: {inspection.trace.summary.timings.compute.toFixed(2)}{' '}
                ms
              </div>
            ) : null}
            {inspection.trace.summary.timings?.marshal != null ? (
              <div>
                marshal: {inspection.trace.summary.timings.marshal.toFixed(2)}{' '}
                ms
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 8,
            color: '#e6edf3',
          }}
        >
          <strong style={{ fontSize: 14, fontWeight: 600 }}>Stages</strong>
          <div
            style={{
              display: 'grid',
              gap: 4,
              maxHeight: 'min(40vh, 280px)',
              overflowY: 'auto',
              paddingRight: 4,
              scrollbarWidth: 'thin',
            }}
          >
            {stages.map((stage, index) => (
              <button
                key={`${stage.kind}-${index}`}
                type="button"
                onClick={() => setActiveStageIndex(index)}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  background:
                    safeStageIndex === index ? '#21262d' : '#161b22',
                  color: safeStageIndex === index ? '#e6edf3' : '#8b949e',
                  fontSize: 12,
                  lineHeight: 1.35,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {stageLabel(stage)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#8b949e', minHeight: 36 }}>
            {activeStage
              ? describeStage(activeStage)
              : 'No stage trace for this level.'}
          </div>
          <pre
            style={{
              margin: 0,
              padding: 0,
              background: 'transparent',
              color: '#c9d1d9',
              fontSize: 10.5,
              lineHeight: 1.5,
              overflow: 'auto',
              maxHeight: 180,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {JSON.stringify(activeStage ?? inspection.trace.summary, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
