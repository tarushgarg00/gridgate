import type {
  BuyBox,
  DealKiller,
  FloodContext,
  LandcoverContext,
  PeeringContext,
  PowerMetrics,
  Recommendation,
  ScoreComponent,
  SiteScore,
  SourceRef,
  SourceResult,
  WetlandsContext,
  ZoningContext,
} from "@/types/site-brief";

export type ScoreInputs = {
  buyBox: BuyBox;
  power: PowerMetrics;
  flood: SourceResult<FloodContext>;
  wetlands: SourceResult<WetlandsContext>;
  landcover: SourceResult<LandcoverContext>;
  peering: SourceResult<PeeringContext>;
  zoning: SourceResult<ZoningContext>;
  dealKillers: DealKiller[];
  confidenceCap?: ConfidenceCapInput;
};

export type ConfidenceCapInput = {
  maxScore: number;
  reason: string;
  forceRecommendation?: Recommendation;
};

export function scoreSite(inputs: ScoreInputs): SiteScore {
  const components: ScoreComponent[] = [
    powerComponent(inputs.power, inputs.buyBox.weights.power),
    fiberComponent(inputs.peering, inputs.buyBox.weights.fiber),
    floodComponent(inputs.flood, inputs.buyBox.weights.flood),
    wetlandsComponent(inputs.wetlands, inputs.buyBox.weights.wetlands),
    landcoverComponent(inputs.landcover, inputs.buyBox.weights.landcover),
    zoningComponent(inputs.zoning, inputs.buyBox.weights.zoning),
  ];
  const uncappedTotal = round(
    components.reduce((sum, component) => sum + component.score, 0),
  );
  const hasDealKiller = inputs.dealKillers.length > 0;
  const dealKillerCappedTotal = hasDealKiller
    ? Math.min(uncappedTotal, 25)
    : uncappedTotal;
  const total = inputs.confidenceCap
    ? Math.min(dealKillerCappedTotal, inputs.confidenceCap.maxScore)
    : dealKillerCappedTotal;
  const recommendation =
    hasDealKiller
      ? "Do Not Advance"
      : inputs.confidenceCap?.forceRecommendation ??
        recommendationForScore(total);

  return {
    total,
    uncappedTotal,
    recommendation,
    confidenceCap: {
      applied: Boolean(inputs.confidenceCap),
      maxScore: inputs.confidenceCap?.maxScore ?? null,
      reason: inputs.confidenceCap?.reason ?? null,
    },
    components,
  };
}

export function recommendationForScore(score: number): Recommendation {
  if (score >= 75) {
    return "Advance";
  }

  if (score >= 50) {
    return "Conditional";
  }

  return "Do Not Advance";
}

export function findDealKillers(
  flood: SourceResult<FloodContext>,
  wetlands: SourceResult<WetlandsContext>,
): DealKiller[] {
  const dealKillers: DealKiller[] = [];

  if (flood.status === "ok" && flood.data.sfha) {
    dealKillers.push({
      id: "flood-sfha",
      label: "High-risk flood zone",
      detail: highRiskFloodText(flood.data),
      source: flood.source,
    });
  }

  if (wetlands.status === "ok" && wetlands.data.extensive) {
    dealKillers.push({
      id: "wetlands-extensive",
      label: "Extensive wetlands",
      detail: "NWI indicates extensive on-site wetlands at the point.",
      source: wetlands.source,
    });
  }

  return dealKillers;
}

function highRiskFloodText(flood: FloodContext): string {
  const zone = flood.zone ? `FEMA Zone ${flood.zone}` : "FEMA SFHA";
  const subtype = flood.subtype ? `, ${flood.subtype.toLowerCase()}` : "";
  return `High-risk flood zone (${zone}${subtype}).`;
}

function powerComponent(power: PowerMetrics, weight: number): ScoreComponent {
  const hvDistance = power.nearestHvLine?.distanceMiles;
  const substationDistance = power.nearestSubstation?.distanceMiles;
  const queueLevel =
    power.queue.status === "ok" ? power.queue.data.congestionLevel : "High";
  const price = power.eia.status === "ok" ? power.eia.data.industrialPriceCentsKwh : null;

  const hv = scoreDistance(hvDistance, 5, 15);
  const substation = scoreDistance(substationDistance, 5, 15);
  const queue = scoreQueue(queueLevel);
  const economics = price === null ? 0.55 : price <= 8 ? 1 : price <= 10 ? 0.75 : 0.45;
  const normalized = hv * 0.35 + substation * 0.25 + queue * 0.25 + economics * 0.15;

  return {
    key: "power",
    label: "Power readiness",
    score: round(normalized * weight),
    weight,
    inputs: [
      hvDistance === undefined ? "Nearest HV line unavailable" : `HV line ${hvDistance} mi`,
      substationDistance === undefined
        ? "Nearest substation unavailable"
        : `Substation ${substationDistance} mi`,
      `Queue ${queueLevel}`,
      price === null ? "Industrial price unavailable" : `${price} cents/kWh`,
    ],
    source: mergeSources(power.queue.source, power.eia.source),
  };
}

function fiberComponent(
  peering: SourceResult<PeeringContext>,
  weight: number,
): ScoreComponent {
  const distance =
    peering.status === "ok"
      ? peering.data.nearestFacility?.distanceMiles ?? null
      : null;
  const within25 =
    peering.status === "ok" ? peering.data.facilitiesWithin25Miles : 0;
  const normalized = distance === null ? 0.35 : distance <= 25 ? 1 : distance <= 40 ? 0.6 : 0.25;

  return {
    key: "fiber",
    label: "Carrier proximity",
    score: round(normalized * weight),
    weight,
    inputs: [
      distance === null ? "Nearest carrier facility unavailable" : `Nearest facility ${distance} mi`,
      `${within25} facilities within 25 mi`,
    ],
    source: peering.source,
  };
}

function floodComponent(
  flood: SourceResult<FloodContext>,
  weight: number,
): ScoreComponent {
  const normalized = flood.status === "ok" ? (flood.data.sfha ? 0 : 1) : 0.45;
  return {
    key: "flood",
    label: "Flood exposure",
    score: round(normalized * weight),
    weight,
    inputs: [
      flood.status === "ok"
        ? `FEMA ${flood.data.zone ?? "no mapped zone"}`
        : "FEMA unavailable",
    ],
    source: flood.source,
  };
}

function wetlandsComponent(
  wetlands: SourceResult<WetlandsContext>,
  weight: number,
): ScoreComponent {
  const normalized =
    wetlands.status === "ok"
      ? wetlands.data.extensive
        ? 0
        : wetlands.data.intersectsWetland
          ? 0.45
          : 1
      : 0.45;
  return {
    key: "wetlands",
    label: "Wetlands review",
    score: round(normalized * weight),
    weight,
    inputs: [
      wetlands.status === "ok"
        ? wetlands.data.intersectsWetland
          ? `${wetlands.data.features.length} NWI feature(s)`
          : "No point intersection"
        : "NWI unavailable",
    ],
    source: wetlands.source,
  };
}

function landcoverComponent(
  landcover: SourceResult<LandcoverContext>,
  weight: number,
): ScoreComponent {
  const signal = landcover.status === "ok" ? landcover.data.signal : "manual-check";
  const normalized =
    signal === "favorable"
      ? 1
      : signal === "mixed"
        ? 0.65
        : signal === "dense-urban"
          ? 0.1
          : 0.35;
  return {
    key: "landcover",
    label: "Land cover",
    score: round(normalized * weight),
    weight,
    inputs: [landcover.status === "ok" ? landcover.data.className ?? landcover.data.signal : "Unavailable"],
    source: landcover.source,
  };
}

function zoningComponent(
  zoning: SourceResult<ZoningContext>,
  weight: number,
): ScoreComponent {
  return {
    key: "zoning",
    label: "Local entitlements",
    score: round(weight * 0.5),
    weight,
    inputs: [
      zoning.status === "ok"
        ? `Local review: ${zoning.data.jurisdiction}`
        : "Local review required",
    ],
    source: zoning.source,
  };
}

function scoreDistance(distance: number | null | undefined, good: number, poor: number) {
  if (distance === null || distance === undefined) {
    return 0.4;
  }

  if (distance <= good) {
    return 1;
  }

  if (distance >= poor) {
    return 0.2;
  }

  return 1 - ((distance - good) / (poor - good)) * 0.8;
}

function scoreQueue(level: string) {
  switch (level) {
    case "Low":
      return 1;
    case "Moderate":
      return 0.75;
    case "High":
      return 0.4;
    case "Severe":
      return 0.05;
    default:
      return 0.45;
  }
}

function mergeSources(a: SourceRef, b: SourceRef): SourceRef {
  return {
    name: `${a.name}; ${b.name}`,
    url: a.url,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export { defaultScoreWeights, mergeBuyBox } from "./weights";
export type { ScoreWeights } from "@/types/site-brief";
