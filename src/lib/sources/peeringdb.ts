import type { PeeringContext, SourceResult } from "@/types/site-brief";
import { distanceMiles } from "@/lib/geo";
import { endpointWithParams, ok, safeJson, source, type SourceContext, unavailable } from "./common";

const PEERINGDB_BASE = "https://www.peeringdb.com/api/fac";

type PeeringDbResponse = {
  data?: Array<{
    id: number;
    name: string;
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
    net_count: number;
    ix_count: number;
  }>;
};

export async function getPeeringDbFacilities(
  context: SourceContext,
): Promise<SourceResult<PeeringContext>> {
  const ref = source("PeeringDB Facilities API", PEERINGDB_BASE);

  try {
    const url = endpointWithParams(PEERINGDB_BASE, {
      country: "US",
      state: context.state,
    });
    const response = await safeJson<PeeringDbResponse>(url);
    const facilities = (response.data ?? [])
      .filter(
        (item) =>
          typeof item.latitude === "number" &&
          typeof item.longitude === "number",
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        state: item.state,
        networkCount: item.net_count,
        ixCount: item.ix_count,
        distanceMiles: distanceMiles(context.coordinates, {
          lat: item.latitude as number,
          lng: item.longitude as number,
        }),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    return ok(
      {
        nearestFacility: facilities[0] ?? null,
        facilitiesWithin25Miles: facilities.filter(
          (item) => item.distanceMiles <= 25,
        ).length,
      },
      ref,
    );
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}
