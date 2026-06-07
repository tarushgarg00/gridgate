import type {
  Coordinates,
  EiaContext,
  FloodContext,
  LandcoverContext,
  PeeringContext,
  PowerMetrics,
  QueueContext,
  SiteBrief,
  SiteBriefRequest,
  SourceResult,
  Substation,
  TransmissionLine,
  WetlandsContext,
  ZoningContext,
} from "@/types/site-brief";
import { createBBox, nearestHvTransmissionLine, nearestSubstation, nearestTransmissionLine } from "@/lib/geo";
import { generateNarrative } from "@/lib/ai/narrative";
import { findDealKillers, scoreSite } from "@/lib/scoring";
import { mergeBuyBox } from "@/lib/scoring/weights";
import { findExampleSite, getExampleSites, type ExampleSite } from "./examples";
import { geocodeSite } from "./sources/geocode";
import { getEiaSignals } from "./sources/eia";
import { getFemaRisks } from "./sources/fema";
import { getLandcoverSummary } from "./sources/landcover";
import { getPeeringDbFacilities } from "./sources/peeringdb";
import { getQueueContext } from "./sources/queue";
import { getSubstationContext } from "./sources/substations";
import { getTransmissionContext } from "./sources/transmission";
import { getWetlandsConstraints } from "./sources/wetlands";
import { ok, source, unavailable, type SourceContext } from "./sources/common";

export async function buildSiteBrief(
  request: SiteBriefRequest = { exampleId: "lebanon-in" },
): Promise<SiteBrief> {
  const buyBox = mergeBuyBox(request.buyBox);
  const example = findExampleSite(request);

  if (example) {
    return buildExampleBrief(example, request, buyBox);
  }

  return buildLiveBrief(request, buyBox);
}

export function exampleOptions() {
  return getExampleSites().map((site) => ({
    id: site.id,
    name: site.name,
    inputLabel: site.inputLabel,
    coordinates: site.coordinates,
  }));
}

async function buildLiveBrief(
  request: SiteBriefRequest,
  buyBox: SiteBrief["buyBox"],
): Promise<SiteBrief> {
  const geocode =
    request.coordinates && !request.query
      ? ok(
          {
            matchedAddress: `${request.coordinates.lat}, ${request.coordinates.lng}`,
            coordinates: request.coordinates,
          },
          source("User-provided coordinates", "local-input"),
        )
      : await geocodeSite(request.query ?? "");

  const coordinates =
    request.coordinates ??
    (geocode.status === "ok" ? geocode.data.coordinates : getExampleSites()[0].coordinates);
  const state = inferState(request, geocode.status === "ok" ? geocode.data.matchedAddress : "");
  const region = regionForState(state);
  const bbox = createBBox(coordinates, 20);
  const context: SourceContext = { coordinates, bbox, state, region };

  const [
    transmission,
    substations,
    queue,
    eia,
    flood,
    wetlands,
    landcover,
    peering,
  ] = await Promise.all([
    getTransmissionContext(context),
    getSubstationContext(context),
    getQueueContext(context),
    getEiaSignals(context),
    getFemaRisks(context),
    getWetlandsConstraints(context),
    getLandcoverSummary(context),
    getPeeringDbFacilities(context),
  ]);

  return finishBrief({
    id: `live-${coordinates.lat}-${coordinates.lng}`,
    name: request.query || "Custom coordinate",
    inputLabel: request.query || `${coordinates.lat}, ${coordinates.lng}`,
    coordinates,
    state,
    region,
    buyBox,
    geocode,
    transmission,
    substations,
    queue,
    eia,
    flood,
    wetlands,
    landcover,
    peering,
    isExample: false,
  });
}

async function buildExampleBrief(
  example: ExampleSite,
  request: SiteBriefRequest,
  buyBox: SiteBrief["buyBox"],
): Promise<SiteBrief> {
  const region = regionForState(example.state);
  const geocode = ok(
    {
      matchedAddress: example.inputLabel,
      coordinates: example.coordinates,
    },
    source("Bundled validated example coordinates", "data/example-sites.json"),
  );
  const queue = await getQueueContext({
    coordinates: example.coordinates,
    bbox: createBBox(example.coordinates, 20),
    state: example.state,
    region,
  });

  return finishBrief({
    id: example.id,
    name: example.name,
    inputLabel: request.query ?? example.inputLabel,
    coordinates: example.coordinates,
    state: example.state,
    region,
    buyBox,
    geocode,
    transmission: ok(
      example.transmission,
      source("HIFLD Electric Power Transmission Lines", "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0"),
    ),
    substations: ok(
      example.substations,
      source("HIFLD Electric Substations", "https://services.arcgis.com/XG15cJAlne2vxtgt/ArcGIS/rest/services/Electric_Substations/FeatureServer/0"),
    ),
    queue,
    eia: ok(example.eia, source("EIA API v2", "https://www.eia.gov/opendata/")),
    flood: ok(
      example.flood,
      source("FEMA National Flood Hazard Layer", "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28"),
    ),
    wetlands: ok(
      example.wetlands,
      source("USFWS National Wetlands Inventory", "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer"),
    ),
    landcover: ok(
      example.landcover,
      source("MRLC / USGS National Land Cover Database", "https://www.mrlc.gov/data-services-page"),
    ),
    peering: ok(example.peering, source("PeeringDB Facilities API", "https://www.peeringdb.com/api/fac")),
    isExample: true,
  });
}

async function finishBrief(input: {
  id: string;
  name: string;
  inputLabel: string;
  coordinates: Coordinates;
  state: string;
  region: string;
  buyBox: SiteBrief["buyBox"];
  geocode: SourceResult<{ matchedAddress: string; coordinates: Coordinates }>;
  transmission: SourceResult<TransmissionLine[]>;
  substations: SourceResult<Substation[]>;
  queue: SourceResult<QueueContext>;
  eia: SourceResult<EiaContext>;
  flood: SourceResult<FloodContext>;
  wetlands: SourceResult<WetlandsContext>;
  landcover: SourceResult<LandcoverContext>;
  peering: SourceResult<PeeringContext>;
  isExample: boolean;
}): Promise<SiteBrief> {
  const transmissionLines = input.transmission.status === "ok" ? input.transmission.data : [];
  const substations = input.substations.status === "ok" ? input.substations.data : [];
  const nearestHvLine = nearestHvTransmissionLine(transmissionLines);
  const nearestLine = nearestTransmissionLine(input.coordinates, transmissionLines);
  const nearestSub = nearestSubstation(input.coordinates, substations);
  const zoning = ok<ZoningContext>(
    {
      status: "manual-check",
      jurisdiction: `${input.name} local planning / zoning authority`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${input.name} zoning data center`)}`,
      note: "Zoning suitability requires local entitlement review; no reliable national source is applied.",
    },
    source("Manual zoning check", "https://www.google.com/search?q=zoning+data+center+site+diligence"),
  );
  const power: PowerMetrics = {
    nearestHvLine,
    nearestLine,
    nearestSubstation: nearestSub,
    queue: input.queue,
    eia: input.eia,
    readinessScore: 0,
    honestyLine:
      "Actual load service still depends on a utility study, commercial negotiation, and interconnection process. GridGate screens whether that conversation is worth starting.",
  };
  const dealKillers = findDealKillers(input.flood, input.wetlands);
  const confidenceCap = confidenceCapFor(input.landcover, input.isExample);
  const score = scoreSite({
    buyBox: input.buyBox,
    power,
    flood: input.flood,
    wetlands: input.wetlands,
    landcover: input.landcover,
    peering: input.peering,
    zoning,
    dealKillers,
    confidenceCap,
  });
  power.readinessScore =
    score.components.find((component) => component.key === "power")?.score ?? 0;

  const keyRisks = buildKeyRisks({
    dealKillers,
    landcover: input.landcover,
    confidenceCapReason: score.confidenceCap.reason,
    queue: input.queue,
    peering: input.peering,
    sources: [
      input.transmission,
      input.substations,
      input.eia,
      input.flood,
      input.wetlands,
      input.landcover,
      input.peering,
    ],
  });

  const briefWithoutNarrative = {
    id: input.id,
    name: input.name,
    inputLabel: input.inputLabel,
    coordinates: input.coordinates,
    state: input.state,
    region: input.region,
    buyBox: input.buyBox,
    recommendation: score.recommendation,
    score,
    keyRisks,
    dealKillers,
    sources: {
      geocode: input.geocode,
      transmission: input.transmission,
      substations: input.substations,
      queue: input.queue,
      eia: input.eia,
      flood: input.flood,
      wetlands: input.wetlands,
      landcover: input.landcover,
      peering: input.peering,
      zoning,
    },
    power,
    map: {
      site: input.coordinates,
      radiusMiles: [5, 25],
      transmission: transmissionLines.slice(0, 10),
      substations: substations.slice(0, 10),
    },
    humanJudgment: [
      "Utility study and load-service negotiation",
      "Community posture, permitting path, and local politics",
      "Capital structure, land control, and commercial risk allocation",
    ],
    generatedAt: new Date().toISOString(),
    isExample: input.isExample,
  } satisfies Omit<SiteBrief, "narrative">;

  return {
    ...briefWithoutNarrative,
    narrative: await generateNarrative({ brief: briefWithoutNarrative }),
  };
}

function buildKeyRisks(input: {
  dealKillers: SiteBrief["dealKillers"];
  landcover: SourceResult<LandcoverContext>;
  confidenceCapReason: string | null;
  queue: SourceResult<QueueContext>;
  peering: SourceResult<PeeringContext>;
  sources: Array<SourceResult<unknown>>;
}): string[] {
  const risks = input.dealKillers.map((item) => item.detail);

  if (input.landcover.status === "ok" && input.landcover.data.humanReviewFlag) {
    risks.push(input.landcover.data.note);
  }

  if (input.confidenceCapReason) {
    risks.push(input.confidenceCapReason);
  }

  if (input.queue.status === "ok" && ["High", "Severe"].includes(input.queue.data.congestionLevel)) {
    risks.push(
      `${input.queue.data.region} queue pressure creates time-to-power risk (${input.queue.data.typicalWaitYears} yr typical wait).`,
    );
  }

  if (
    input.peering.status === "ok" &&
    (!input.peering.data.nearestFacility ||
      input.peering.data.nearestFacility.distanceMiles > 25)
  ) {
    risks.push("Nearest carrier facility is outside the 25 mi preference.");
  }

  const unavailableSources = input.sources.filter(
    (item) => item.status === "unavailable",
  );
  if (unavailableSources.length > 0) {
    risks.push(`${unavailableSources.length} source layer(s) unavailable; treat the brief as incomplete.`);
  }

  return risks.length > 0 ? risks : ["No immediate disqualifier surfaced; continue to utility, parcel, and local entitlement diligence."];
}

function confidenceCapFor(
  landcover: SourceResult<LandcoverContext>,
  isExample: boolean,
) {
  if (landcover.status !== "ok") {
    return {
      maxScore: 74,
      reason:
        "Availability cap: land availability, land cost, and zoning suitability are unmeasured. The score reflects measurable infrastructure only.",
    };
  }

  if (landcover.data.availabilityRisk === "likely-prohibitive") {
    return {
      maxScore: 49,
      reason:
        "Availability cap: dense urban land conditions make parcel availability, land cost, and zoning suitability unassessable and likely prohibitive. The score reflects measurable infrastructure only.",
      forceRecommendation: "Do Not Advance" as const,
    };
  }

  if (!isExample && landcover.data.availabilityRisk === "unmeasured") {
    return {
      maxScore: 74,
      reason:
        "Availability cap: land availability, land cost, and zoning suitability are unmeasured. The score reflects measurable infrastructure only.",
    };
  }

  return undefined;
}

function inferState(
  request: SiteBriefRequest,
  matchedAddress: string,
): string {
  const text = `${request.query ?? ""} ${matchedAddress}`.toUpperCase();
  const stateMatch = text.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/);
  return stateMatch?.[1] ?? "OH";
}

function regionForState(state: string): string {
  const map: Record<string, string> = {
    OH: "PJM",
    PA: "PJM",
    VA: "PJM",
    IN: "MISO",
    IL: "MISO",
    LA: "Southeast",
    TX: "ERCOT",
  };

  return map[state] ?? "PJM";
}

export function emptySource<T>(name: string, url: string): SourceResult<T> {
  return unavailable(source(name, url), "No data has been requested yet.");
}
