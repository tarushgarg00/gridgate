import type { SourceResult, Substation } from "@/types/site-brief";
import { bboxToArcGisGeometry, distanceMiles } from "@/lib/geo";
import {
  endpointWithParams,
  normalizeNumber,
  ok,
  safeJson,
  source,
  type SourceContext,
  unavailable,
} from "./common";

const SUBSTATIONS_BASE =
  "https://services.arcgis.com/XG15cJAlne2vxtgt/ArcGIS/rest/services/Electric_Substations/FeatureServer/0/query";

type SubstationCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    FID?: number;
    NAME?: string;
    CITY?: string;
    STATE?: string;
    LINES?: number;
    MAX_VOLTAG?: number;
    MIN_VOLTAG?: number;
    SOURCE?: string;
  }
>;

export async function getSubstationContext(
  context: SourceContext,
): Promise<SourceResult<Substation[]>> {
  const ref = source("HIFLD Electric Substations", SUBSTATIONS_BASE);

  try {
    const url = endpointWithParams(SUBSTATIONS_BASE, {
      f: "geojson",
      where: "1=1",
      geometry: bboxToArcGisGeometry(context.bbox),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FID,NAME,CITY,STATE,LINES,MAX_VOLTAG,MIN_VOLTAG,SOURCE",
      returnGeometry: "true",
      resultRecordCount: "200",
    });
    const response = await safeJson<SubstationCollection>(url);
    const substations = response.features.map((feature, index) => ({
      id: String(feature.properties?.FID ?? `substation-${index + 1}`),
      name: feature.properties?.NAME ?? "Unknown substation",
      city: normalizeText(feature.properties?.CITY),
      state: normalizeText(feature.properties?.STATE),
      maxVoltageKv: normalizeNumber(feature.properties?.MAX_VOLTAG),
      minVoltageKv: normalizeNumber(feature.properties?.MIN_VOLTAG),
      lineCount: normalizeNumber(feature.properties?.LINES),
      distanceMiles: distanceMiles(context.coordinates, {
        lng: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1],
      }),
    }));

    return ok(substations, ref);
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string" || value === "NOT AVAILABLE") {
    return null;
  }

  return value;
}
