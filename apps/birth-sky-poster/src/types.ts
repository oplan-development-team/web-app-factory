export interface StarRecord {
  /** Hipparcos designation, e.g. "HIP32349". */
  id: string;
  /** Right ascension, J2000, degrees [0, 360). */
  ra: number;
  /** Declination, J2000, degrees [-90, 90]. */
  dec: number;
  /** Apparent visual magnitude. Lower is brighter. */
  mag: number;
  /** Proper name, when the star has one. */
  name?: string;
  /** Bayer designation within its constellation. */
  bayer?: string;
  /** Three-letter constellation abbreviation. */
  con?: string;
}

/**
 * One constellation's stick figure, stored as polylines of sky coordinates
 * rather than as references to catalogue stars. Keeping the geometry
 * self-contained lets the renderer clip a figure at the horizon (FR-105)
 * without needing every vertex to also exist in the star catalogue.
 */
export interface ConstellationRecord {
  /** Three-letter IAU abbreviation, e.g. "Ori". */
  con: string;
  /** Full IAU name, e.g. "Orion". */
  name: string;
  /** Polylines of `[ra, dec]` vertices in J2000 degrees. */
  lines: [number, number][][];
}

export interface PosterInputs {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  utcOffsetHours: number;
  latitude: number;
  longitude: number;
  placeLabel: string;
  showConstellations: boolean;
  showStarNames: boolean;
}

export interface PosterTextOverrides {
  title: string;
  dateLine: string;
  placeLine: string;
}
