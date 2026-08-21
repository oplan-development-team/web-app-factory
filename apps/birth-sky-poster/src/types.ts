export interface StarRecord {
  id: string;
  name: string | null;
  bayer: string | null;
  con: string | null;
  /** Right ascension, J2000, degrees [0, 360). */
  ra: number;
  /** Declination, J2000, degrees [-90, 90]. */
  dec: number;
  mag: number;
}

export interface ConstellationRecord {
  con: string;
  /** Pairs of star ids forming line segments. */
  segments: [string, string][];
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
}

export interface PosterTextOverrides {
  title: string;
  dateLine: string;
  placeLine: string;
}
