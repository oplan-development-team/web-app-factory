// d3-contour ships no bundled types and its @types package is pinned to an
// older major version, so we declare the minimal slice of the API this app
// actually uses instead of dragging in a mismatched type dependency.
declare module 'd3-contour' {
  export interface ContourMultiPolygon {
    type: 'MultiPolygon';
    value: number;
    coordinates: number[][][][];
  }

  export interface ContourGenerator {
    (values: ArrayLike<number>): ContourMultiPolygon[];
    size(size: [number, number]): ContourGenerator;
    thresholds(thresholds: number[] | number): ContourGenerator;
    smooth(smooth: boolean): ContourGenerator;
  }

  export function contours(): ContourGenerator;
}
