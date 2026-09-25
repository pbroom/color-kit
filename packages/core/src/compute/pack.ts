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
 * Throws when a result contains non-finite coordinates, lightness/chroma or
 * color values, so malformed solver output fails where it is produced.
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
