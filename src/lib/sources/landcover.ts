import type { LandcoverContext, SourceResult } from "@/types/site-brief";
import { ok, source, type SourceContext } from "./common";

const MRLC_URL = "https://www.mrlc.gov/data-services-page";

export async function getLandcoverSummary(
  context: SourceContext,
): Promise<SourceResult<LandcoverContext>> {
  const denseUrban = isDenseUrban(context);
  const developedStates = new Set(["OH", "IN", "PA", "VA", "TX"]);
  const signal = denseUrban
    ? "dense-urban"
    : developedStates.has(context.state)
      ? "mixed"
      : "manual-check";

  return ok(
    {
      className:
        signal === "dense-urban"
          ? "High-intensity developed / dense urban"
          : signal === "mixed"
            ? "Developed / agricultural mix"
            : null,
      signal,
      humanReviewFlag: signal === "dense-urban" || signal === "manual-check",
      availabilityRisk:
        signal === "dense-urban"
          ? "likely-prohibitive"
          : signal === "manual-check"
            ? "unmeasured"
            : "clear-first-pass",
      note:
        signal === "dense-urban"
          ? "Dense urban site: parcel availability, land cost, and zoning suitability are not assessable and are likely prohibitive. Requires human review."
          : "MRLC/NLCD provides an initial land-cover signal; parcel-specific land and zoning diligence remains a local review item.",
    },
    source("MRLC / USGS National Land Cover Database", MRLC_URL),
  );
}

function isDenseUrban(context: SourceContext): boolean {
  const { lat, lng } = context.coordinates;
  const manhattan =
    lat >= 40.68 && lat <= 40.88 && lng >= -74.03 && lng <= -73.9;
  const nycCore =
    lat >= 40.55 && lat <= 40.92 && lng >= -74.08 && lng <= -73.7;
  const dcCore =
    lat >= 38.86 && lat <= 38.93 && lng >= -77.08 && lng <= -76.95;

  return manhattan || nycCore || dcCore;
}
