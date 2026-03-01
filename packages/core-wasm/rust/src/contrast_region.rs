use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct ContrastRegionRequest {
    points: Vec<[f32; 2]>,
}

#[derive(Debug, Serialize)]
struct ContrastRegionResponse {
    backend: &'static str,
    paths: Vec<Vec<[f32; 2]>>,
}

pub fn contrast_region_paths_v1(input: &[u8]) -> Vec<u8> {
    let response = match serde_json::from_slice::<ContrastRegionRequest>(input) {
        Ok(request) => ContrastRegionResponse {
            backend: "wasm-scaffold-v1",
            paths: vec![request.points],
        },
        Err(_) => ContrastRegionResponse {
            backend: "wasm-scaffold-v1",
            paths: Vec::new(),
        },
    };

    serde_json::to_vec(&response).unwrap_or_default()
}
