import type { EiaContext, SourceResult } from "@/types/site-brief";
import { endpointWithParams, normalizeNumber, ok, safeJson, source, type SourceContext, unavailable } from "./common";

const EIA_RETAIL_BASE = "https://api.eia.gov/v2/electricity/retail-sales/data/";
const EIA_MIX_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

type RetailResponse = {
  response?: {
    data?: Array<{
      period?: string;
      stateid?: string;
      sectorid?: string;
      price?: string;
    }>;
  };
};

type MixResponse = {
  response?: {
    data?: Array<{
      fueltype?: string;
      value?: string;
    }>;
  };
};

const STATE_TO_RESPONDENT: Record<string, string> = {
  OH: "PJM",
  IN: "MISO",
  LA: "Southeast",
  PA: "PJM",
  VA: "PJM",
  IL: "MISO",
  TX: "ERCOT",
};

export async function getEiaSignals(
  context: SourceContext,
): Promise<SourceResult<EiaContext>> {
  const ref = source("EIA API v2", "https://www.eia.gov/opendata/");
  const apiKey = process.env.EIA_API_KEY;

  if (!apiKey) {
    return unavailable(ref, "EIA_API_KEY is not set.");
  }

  try {
    const respondent = STATE_TO_RESPONDENT[context.state] ?? context.region;
    const retailUrl = endpointWithParams(EIA_RETAIL_BASE, {
      api_key: apiKey,
      frequency: "annual",
      "data[0]": "price",
      "facets[stateid][]": context.state,
      "facets[sectorid][]": "IND",
      "sort[0][column]": "period",
      "sort[0][direction]": "desc",
      offset: "0",
      length: "1",
    });
    const mixUrl = endpointWithParams(EIA_MIX_BASE, {
      api_key: apiKey,
      frequency: "hourly",
      "data[0]": "value",
      "facets[respondent][]": respondent,
      "sort[0][column]": "period",
      "sort[0][direction]": "desc",
      offset: "0",
      length: "12",
    });

    const [retail, mix] = await Promise.all([
      safeJson<RetailResponse>(retailUrl),
      respondent === "Southeast"
        ? Promise.resolve<MixResponse>({ response: { data: [] } })
        : safeJson<MixResponse>(mixUrl),
    ]);

    const retailRow = retail.response?.data?.[0];
    const mixRows = mix.response?.data ?? [];
    const total = mixRows.reduce(
      (sum, row) => sum + (normalizeNumber(row.value) ?? 0),
      0,
    );
    const gridMix = mixRows.map((row) => {
      const value = normalizeNumber(row.value) ?? 0;
      return {
        fuel: row.fueltype ?? "Other",
        valueMwh: value,
        share: total > 0 ? value / total : 0,
      };
    });

    return ok(
      {
        state: context.state,
        respondent,
        industrialPriceCentsKwh: normalizeNumber(retailRow?.price),
        pricePeriod: retailRow?.period ?? null,
        gridMix,
      },
      ref,
    );
  } catch (error) {
    return unavailable(ref, error instanceof Error ? error.message : "Unknown error");
  }
}
