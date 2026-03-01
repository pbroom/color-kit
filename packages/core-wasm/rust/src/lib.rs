mod contrast_region;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wasm_backend_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen]
pub fn contrast_region_paths_v1(input: &[u8]) -> Vec<u8> {
    contrast_region::contrast_region_paths_v1(input)
}
