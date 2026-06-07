import bbox from "@turf/bbox";
import { lineString, point } from "@turf/helpers";
import nearestPoint from "@turf/nearest-point";
import pointToLineDistance from "@turf/point-to-line-distance";
import distance from "@turf/distance";
import type {
  BBox,
  Coordinates,
  Substation,
  TransmissionLine,
} from "@/types/site-brief";

const MILES_PER_DEGREE_LAT = 69;

export function isCoordinates(value: Coordinates): boolean {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng);
}

export function milesToKilometers(miles: number): number {
  return miles * 1.609344;
}

export function kilometersToMiles(kilometers: number): number {
  return kilometers / 1.609344;
}

export function createBBox(coordinates: Coordinates, radiusMiles: number): BBox {
  const latDelta = radiusMiles / MILES_PER_DEGREE_LAT;
  const lngDelta =
    radiusMiles /
    (MILES_PER_DEGREE_LAT * Math.cos((coordinates.lat * Math.PI) / 180));

  return {
    west: round(coordinates.lng - lngDelta, 6),
    south: round(coordinates.lat - latDelta, 6),
    east: round(coordinates.lng + lngDelta, 6),
    north: round(coordinates.lat + latDelta, 6),
  };
}

export function bboxToArcGisGeometry(boundingBox: BBox): string {
  return [
    boundingBox.west,
    boundingBox.south,
    boundingBox.east,
    boundingBox.north,
  ].join(",");
}

export function distanceMiles(a: Coordinates, b: Coordinates): number {
  return round(
    distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: "miles" }),
    2,
  );
}

export function nearestSubstation(
  site: Coordinates,
  substations: Substation[],
): Substation | null {
  const candidates = substations.filter(
    (item) => typeof item.distanceMiles === "number",
  );
  return candidates.sort(
    (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity),
  )[0] ?? null;
}

export function nearestTransmissionLine(
  site: Coordinates,
  lines: TransmissionLine[],
): TransmissionLine | null {
  const candidates = lines.filter(
    (item) => typeof item.distanceMiles === "number",
  );
  return candidates.sort(
    (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity),
  )[0] ?? null;
}

export function nearestHvTransmissionLine(
  lines: TransmissionLine[],
  minimumKv = 230,
): TransmissionLine | null {
  const candidates = lines.filter(
    (item) =>
      typeof item.voltageKv === "number" &&
      item.voltageKv >= minimumKv &&
      typeof item.distanceMiles === "number",
  );
  return candidates.sort(
    (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity),
  )[0] ?? null;
}

export function distanceToLineMiles(
  site: Coordinates,
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString,
): number {
  const sitePoint = point([site.lng, site.lat]);
  if (geometry.type === "MultiLineString") {
    const distances = geometry.coordinates.map((coordinates) =>
      pointToLineDistance(sitePoint, lineString(coordinates), { units: "miles" }),
    );
    return round(Math.min(...distances), 2);
  }

  return round(
    pointToLineDistance(sitePoint, lineString(geometry.coordinates), {
      units: "miles",
    }),
    2,
  );
}

export function nearestPointDistanceMiles(
  site: Coordinates,
  points: Array<Coordinates & { id: string }>,
): { id: string; distanceMiles: number } | null {
  if (points.length === 0) {
    return null;
  }

  const collection = {
    type: "FeatureCollection" as const,
    features: points.map((item) => ({
      type: "Feature" as const,
      properties: { id: item.id },
      geometry: {
        type: "Point" as const,
        coordinates: [item.lng, item.lat],
      },
    })),
  };
  const nearest = nearestPoint(point([site.lng, site.lat]), collection);
  const id = nearest.properties?.id;
  if (typeof id !== "string") {
    return null;
  }

  return {
    id,
    distanceMiles: distanceMiles(site, {
      lat: nearest.geometry.coordinates[1],
      lng: nearest.geometry.coordinates[0],
    }),
  };
}

export function geometryBBox(
  geometry: GeoJSON.Feature | GeoJSON.Geometry,
): BBox {
  const values = bbox(geometry);
  return {
    west: values[0],
    south: values[1],
    east: values[2],
    north: values[3],
  };
}

export function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
