/**
 * Normalized 2D point in plane space.
 *
 * Lives in a neutral leaf module so solvers (contrast, gamut regions) and the
 * plane layer can share geometry without importing each other.
 */
export interface PlanePoint {
  x: number;
  y: number;
}
