import {
  PackedWriter,
  type PackedPlaneQueryDescriptor,
  type PackedPlaneQueryResult,
} from '../plane/packed-abi.js';
import { getPlaneQuerySpec } from '../plane/query-specs/index.js';
import type { PlaneQueryResult } from '../plane/types.js';

/**
 * Packs plane query results into transfer-friendly typed arrays.
 *
 * All paths go into shared buffers (`pathRanges` as `[start, count]` pairs,
 * point data as `Float32Array`s) with one descriptor per result carrying its
 * kind-specific metadata. Coordinates and colors are stored as 32-bit floats,
 * so a round trip through {@link unpackPlaneQueryResults} keeps only about 7
 * significant digits.
 *
 * @param results - Query results, e.g. from `runPlaneQueries`.
 * @returns A packed payload with fresh, unshared buffers.
 * @throws {Error} When a result contains non-finite coordinates,
 * lightness/chroma or color values, so malformed solver output fails where it
 * is produced.
 * @see {@link getPackedPlaneQueryTransferables}
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { packPlaneQueryResults } from 'color-kit/compute';
 * import { runPlaneQueries } from 'color-kit/plane';
 *
 * const results = runPlaneQueries({ model: 'oklch' }, [
 *   { kind: 'gradient', from: parse('#000'), to: parse('#fff'), steps: 3 },
 * ]);
 * const packed = packPlaneQueryResults(results);
 *
 * packed.pathRanges; // → Uint32Array [0, 3]
 * packed.pointXY; // → Float32Array [0, 1, 0.5, 1, 1, 1]
 * ```
 */
export function packPlaneQueryResults(
  results: PlaneQueryResult[],
): PackedPlaneQueryResult {
  const writer = new PackedWriter();
  const queryDescriptors: PackedPlaneQueryDescriptor[] = [];

  results.forEach((result, index) => {
    const spec = getPlaneQuerySpec(result.kind);
    const descriptor = spec.pack(
      result,
      writer,
      `query ${index} (${result.kind})`,
    );
    if (
      spec.fixedPathCount != null &&
      descriptor.pathCount !== spec.fixedPathCount
    ) {
      throw new Error(
        `Cannot pack plane query result: query ${index} (${result.kind}) must pack exactly ${spec.fixedPathCount} path.`,
      );
    }
    queryDescriptors.push(descriptor);
  });

  return writer.finish(queryDescriptors);
}

/**
 * Returns the four `ArrayBuffer`s backing a packed result, for zero-copy
 * `postMessage` transfer.
 *
 * Transferring detaches the buffers in the sending context, so do not read
 * `packed` there afterwards.
 *
 * @param packed - Packed result from {@link packPlaneQueryResults} or a compute
 * run.
 * @returns The `pathRanges`, `pointXY`, `pointLC` and `pointColorLcha` buffers.
 * @example
 * ```ts
 * import { getPackedPlaneQueryTransferables, runPackedPlaneQueries } from 'color-kit/compute';
 *
 * const packed = runPackedPlaneQueries({
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * });
 * const transfer = getPackedPlaneQueryTransferables(packed);
 *
 * transfer.length; // → 4
 * // In a worker: self.postMessage(packed, transfer);
 * ```
 */
export function getPackedPlaneQueryTransferables(
  packed: PackedPlaneQueryResult,
): ArrayBuffer[] {
  return [
    packed.pathRanges.buffer as ArrayBuffer,
    packed.pointXY.buffer as ArrayBuffer,
    packed.pointLC.buffer as ArrayBuffer,
    packed.pointColorLcha.buffer as ArrayBuffer,
  ];
}
