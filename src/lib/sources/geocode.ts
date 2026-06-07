import type { Coordinates, SourceResult } from "@/types/site-brief";
import { endpointWithParams, ok, safeJson, source, unavailable } from "./common";

const GEOCODER_BASE =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

type CensusGeocoderResponse = {
  result?: {
    addressMatches?: Array<{
      matchedAddress: string;
      coordinates: {
        x: number;
        y: number;
      };
      addressComponents?: {
        state?: string;
      };
    }>;
  };
};

export type GeocodeData = {
  matchedAddress: string;
  coordinates: Coordinates;
  state: string | null;
};

export async function geocodeSite(
  query: string,
): Promise<SourceResult<GeocodeData>> {
  const ref = source("US Census Geocoder", GEOCODER_BASE);

  if (!query.trim()) {
    return unavailable(ref, "No address or place query was provided.");
  }

  try {
    const url = endpointWithParams(GEOCODER_BASE, {
      address: query,
      benchmark: "Public_AR_Current",
      format: "json",
    });
    const response = await safeJson<CensusGeocoderResponse>(url);
    const match = response.result?.addressMatches?.[0];

    if (!match) {
      return unavailable(ref, "Census returned no address match.");
    }

    return ok(
      {
        matchedAddress: match.matchedAddress,
        coordinates: {
          lat: match.coordinates.y,
          lng: match.coordinates.x,
        },
        state: match.addressComponents?.state ?? null,
      },
      ref,
    );
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}
