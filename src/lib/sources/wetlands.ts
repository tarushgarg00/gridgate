import type { SourceResult, WetlandsContext } from "@/types/site-brief";
import {
  endpointWithParams,
  normalizeNumber,
  ok,
  safeJson,
  source,
  type SourceContext,
  unavailable,
} from "./common";

const WETLANDS_BASE =
  "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query";

type WetlandsResponse = {
  features?: Array<{
    attributes?: {
      "Wetlands.ATTRIBUTE"?: string;
      "Wetlands.WETLAND_TYPE"?: string;
      "Wetlands.ACRES"?: number;
    };
  }>;
};

export async function getWetlandsConstraints(
  context: SourceContext,
): Promise<SourceResult<WetlandsContext>> {
  const ref = source("USFWS National Wetlands Inventory", WETLANDS_BASE);

  try {
    const url = endpointWithParams(WETLANDS_BASE, {
      f: "json",
      where: "1=1",
      geometry: `${context.coordinates.lng},${context.coordinates.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "Wetlands.ATTRIBUTE,Wetlands.WETLAND_TYPE,Wetlands.ACRES",
      returnGeometry: "false",
      resultRecordCount: "10",
    });
    const response = await safeJson<WetlandsResponse>(url);
    const features =
      response.features?.map((feature) => ({
        attribute: feature.attributes?.["Wetlands.ATTRIBUTE"] ?? "Unknown",
        type: feature.attributes?.["Wetlands.WETLAND_TYPE"] ?? "Wetland",
        acres: normalizeNumber(feature.attributes?.["Wetlands.ACRES"]),
      })) ?? [];
    const totalAcres = features.reduce(
      (total, item) => total + (item.acres ?? 0),
      0,
    );

    return ok(
      {
        intersectsWetland: features.length > 0,
        features,
        extensive: totalAcres >= 3,
      },
      ref,
    );
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}
