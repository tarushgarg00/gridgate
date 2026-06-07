import type { FloodContext, SourceResult } from "@/types/site-brief";
import {
  endpointWithParams,
  normalizeNumber,
  ok,
  safeJson,
  source,
  type SourceContext,
  unavailable,
} from "./common";

const FEMA_BASE =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

type FemaResponse = {
  features?: Array<{
    attributes?: {
      FLD_ZONE?: string;
      ZONE_SUBTY?: string;
      SFHA_TF?: string;
      STATIC_BFE?: number;
      DEPTH?: number;
    };
  }>;
};

export async function getFemaRisks(
  context: SourceContext,
): Promise<SourceResult<FloodContext>> {
  const ref = source("FEMA National Flood Hazard Layer", FEMA_BASE);

  try {
    const url = endpointWithParams(FEMA_BASE, {
      f: "json",
      where: "1=1",
      geometry: `${context.coordinates.lng},${context.coordinates.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH",
      returnGeometry: "false",
      resultRecordCount: "3",
    });
    const response = await safeJson<FemaResponse>(url);
    const attributes = response.features?.[0]?.attributes;

    if (!attributes) {
      return ok(
        {
          zone: null,
          subtype: null,
          sfha: false,
          baseFloodElevation: null,
          depth: null,
        },
        ref,
      );
    }

    const zone = attributes.FLD_ZONE ?? null;
    const subtype = attributes.ZONE_SUBTY ?? null;
    const sfha =
      attributes.SFHA_TF === "T" ||
      Boolean(zone?.startsWith("A") || zone?.startsWith("V")) ||
      Boolean(subtype?.toLowerCase().includes("floodway"));

    return ok(
      {
        zone,
        subtype,
        sfha,
        baseFloodElevation: normalizeNumber(attributes.STATIC_BFE),
        depth: normalizeNumber(attributes.DEPTH),
      },
      ref,
    );
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}
