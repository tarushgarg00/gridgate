import type { SourceResult, TransmissionLine } from "@/types/site-brief";
import { bboxToArcGisGeometry, distanceToLineMiles } from "@/lib/geo";
import {
  endpointWithParams,
  normalizeNumber,
  ok,
  safeJson,
  source,
  type SourceContext,
  unavailable,
} from "./common";

const TRANSMISSION_BASE =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0/query";

type TransmissionFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  {
    ID?: string;
    TYPE?: string;
    STATUS?: string;
    OWNER?: string;
    VOLTAGE?: number;
    VOLT_CLASS?: string;
    SUB_1?: string;
    SUB_2?: string;
  }
>;

export async function getTransmissionContext(
  context: SourceContext,
): Promise<SourceResult<TransmissionLine[]>> {
  const ref = source("HIFLD Electric Power Transmission Lines", TRANSMISSION_BASE);

  try {
    const url = endpointWithParams(TRANSMISSION_BASE, {
      f: "geojson",
      where: "1=1",
      geometry: bboxToArcGisGeometry(context.bbox),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields:
        "ID,TYPE,STATUS,OWNER,VOLTAGE,VOLT_CLASS,SUB_1,SUB_2",
      returnGeometry: "true",
      resultRecordCount: "200",
    });
    const response = await safeJson<TransmissionFeatureCollection>(url);
    const lines = response.features.map((feature, index) => {
      const voltage = normalizeNumber(feature.properties?.VOLTAGE);
      return {
        id: feature.properties?.ID ?? `line-${index + 1}`,
        voltageKv: voltage,
        voltageClass: feature.properties?.VOLT_CLASS ?? null,
        owner: normalizeText(feature.properties?.OWNER),
        status: normalizeText(feature.properties?.STATUS),
        type: normalizeText(feature.properties?.TYPE),
        distanceMiles: distanceToLineMiles(context.coordinates, feature.geometry),
        sourceSubstation: normalizeText(feature.properties?.SUB_1),
        targetSubstation: normalizeText(feature.properties?.SUB_2),
        geometry: feature.geometry,
      } satisfies TransmissionLine;
    });

    return ok(lines, ref);
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
