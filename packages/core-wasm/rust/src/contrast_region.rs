use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

const ABI_VERSION: u32 = 1;
const OPERATION: &str = "normalize-contrast-paths";
const BACKEND: &str = "wasm-contrast-v1";
const POINT_EPSILON: f32 = 1e-7;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContrastKernelRequest {
    abi_version: u32,
    operation: String,
    queries: Vec<ContrastKernelQueryPayload>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ContrastKernelQueryPayload {
    kind: ContrastKernelQueryKind,
    hue: f32,
    paths: Vec<Vec<[f32; 2]>>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
enum ContrastKernelQueryKind {
    ContrastBoundary,
    ContrastRegion,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContrastKernelResponse {
    abi_version: u32,
    operation: String,
    backend: String,
    results: Vec<ContrastKernelQueryPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn normalize_hue(hue: f32) -> f32 {
    if !hue.is_finite() {
        return 0.0;
    }
    let wrapped = hue % 360.0;
    if wrapped < 0.0 {
        wrapped + 360.0
    } else {
        wrapped
    }
}

fn normalize_lightness(lightness: f32) -> f32 {
    if !lightness.is_finite() {
        return 0.0;
    }
    lightness.clamp(0.0, 1.0)
}

fn normalize_chroma(chroma: f32) -> f32 {
    if !chroma.is_finite() {
        return 0.0;
    }
    chroma.max(0.0)
}

fn normalize_path(path: Vec<[f32; 2]>) -> Vec<[f32; 2]> {
    let mut normalized: Vec<[f32; 2]> = Vec::with_capacity(path.len());
    for point in path {
        if !point[0].is_finite() || !point[1].is_finite() {
            continue;
        }
        let next = [normalize_lightness(point[0]), normalize_chroma(point[1])];
        if let Some(last) = normalized.last() {
            if (last[0] - next[0]).abs() <= POINT_EPSILON
                && (last[1] - next[1]).abs() <= POINT_EPSILON
            {
                continue;
            }
        }
        normalized.push(next);
    }
    normalized
}

fn compare_f32(a: f32, b: f32) -> Ordering {
    a.partial_cmp(&b).unwrap_or(Ordering::Equal)
}

fn normalize_paths(paths: Vec<Vec<[f32; 2]>>) -> Vec<Vec<[f32; 2]>> {
    let mut normalized = paths
        .into_iter()
        .map(normalize_path)
        .filter(|path| path.len() > 1)
        .collect::<Vec<_>>();
    normalized.sort_by(|left, right| {
        let len_cmp = right.len().cmp(&left.len());
        if len_cmp != Ordering::Equal {
            return len_cmp;
        }
        let left_first = left.first().copied().unwrap_or([0.0, 0.0]);
        let right_first = right.first().copied().unwrap_or([0.0, 0.0]);
        compare_f32(left_first[0], right_first[0])
            .then_with(|| compare_f32(left_first[1], right_first[1]))
            .then_with(|| compare_f32(left.last().unwrap_or(&[0.0, 0.0])[0], right.last().unwrap_or(&[0.0, 0.0])[0]))
            .then_with(|| compare_f32(left.last().unwrap_or(&[0.0, 0.0])[1], right.last().unwrap_or(&[0.0, 0.0])[1]))
    });
    normalized
}

fn create_response(
    results: Vec<ContrastKernelQueryPayload>,
    error: Option<String>,
) -> ContrastKernelResponse {
    ContrastKernelResponse {
        abi_version: ABI_VERSION,
        operation: OPERATION.to_string(),
        backend: BACKEND.to_string(),
        results,
        error,
    }
}

pub fn contrast_region_paths_v1(input: &[u8]) -> Vec<u8> {
    let parsed_request = serde_json::from_slice::<ContrastKernelRequest>(input);
    let response = match parsed_request {
        Ok(request) => {
            if request.abi_version != ABI_VERSION {
                create_response(
                    Vec::new(),
                    Some(format!(
                        "unsupported ABI version {}, expected {}",
                        request.abi_version, ABI_VERSION
                    )),
                )
            } else if request.operation != OPERATION {
                create_response(
                    Vec::new(),
                    Some(format!(
                        "unsupported operation {}, expected {}",
                        request.operation, OPERATION
                    )),
                )
            } else {
                let results = request
                    .queries
                    .into_iter()
                    .map(|query| ContrastKernelQueryPayload {
                        kind: query.kind,
                        hue: normalize_hue(query.hue),
                        paths: normalize_paths(query.paths),
                    })
                    .collect::<Vec<_>>();
                create_response(results, None)
            }
        }
        Err(error) => create_response(
            Vec::new(),
            Some(format!("failed to decode request: {}", error)),
        ),
    };
    serde_json::to_vec(&response).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_paths_and_hue() {
        let request = ContrastKernelRequest {
            abi_version: ABI_VERSION,
            operation: OPERATION.to_string(),
            queries: vec![ContrastKernelQueryPayload {
                kind: ContrastKernelQueryKind::ContrastRegion,
                hue: -30.0,
                paths: vec![vec![[0.2, 0.1], [0.2, 0.1], [0.3, 0.2], [-0.4, -0.2]]],
            }],
        };
        let encoded = serde_json::to_vec(&request).unwrap();
        let output = contrast_region_paths_v1(&encoded);
        let response: ContrastKernelResponse = serde_json::from_slice(&output).unwrap();
        assert_eq!(response.error, None);
        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].hue, 330.0);
        assert_eq!(response.results[0].paths.len(), 1);
        assert_eq!(response.results[0].paths[0].len(), 3);
        assert_eq!(response.results[0].paths[0][2], [0.0, 0.0]);
    }

    #[test]
    fn rejects_invalid_abi_version() {
        let request = ContrastKernelRequest {
            abi_version: 99,
            operation: OPERATION.to_string(),
            queries: Vec::new(),
        };
        let encoded = serde_json::to_vec(&request).unwrap();
        let output = contrast_region_paths_v1(&encoded);
        let response: ContrastKernelResponse = serde_json::from_slice(&output).unwrap();
        assert!(response
            .error
            .unwrap_or_default()
            .contains("unsupported ABI version"));
    }
}
