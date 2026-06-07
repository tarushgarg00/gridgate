import { describe, expect, it } from "vitest";
import { findDealKillers, recommendationForScore, scoreSite } from "@/lib/scoring";
import { defaultBuyBox, type SourceResult } from "@/types/site-brief";
import type {
  FloodContext,
  LandcoverContext,
  PeeringContext,
  PowerMetrics,
  WetlandsContext,
  ZoningContext,
} from "@/types/site-brief";

const source = { name: "test", url: "https://example.com" };

describe("scoring", () => {
  it("maps score thresholds to recommendations", () => {
    expect(recommendationForScore(80)).toBe("Advance");
    expect(recommendationForScore(60)).toBe("Conditional");
    expect(recommendationForScore(40)).toBe("Do Not Advance");
  });

  it("caps recommendation when flood is a deal-killer", () => {
    const flood = ok<FloodContext>({
      zone: "AE",
      subtype: null,
      sfha: true,
      baseFloodElevation: null,
      depth: null,
    });
    const wetlands = ok<WetlandsContext>({
      intersectsWetland: false,
      features: [],
      extensive: false,
    });
    const dealKillers = findDealKillers(flood, wetlands);
    const score = scoreSite({
      buyBox: defaultBuyBox,
      power: power(),
      flood,
      wetlands,
      landcover: ok<LandcoverContext>({
        className: "Developed",
      signal: "favorable",
        humanReviewFlag: false,
        availabilityRisk: "clear-first-pass",
        note: "ok",
      }),
      peering: ok<PeeringContext>({
        nearestFacility: {
          id: 1,
          name: "Facility",
          distanceMiles: 5,
          city: "Columbus",
          state: "OH",
          networkCount: 10,
          ixCount: 1,
        },
        facilitiesWithin25Miles: 3,
      }),
      zoning: ok<ZoningContext>({
        status: "manual-check",
        jurisdiction: "local",
        url: "https://example.com",
        note: "manual",
      }),
      dealKillers,
    });

    expect(dealKillers).toHaveLength(1);
    expect(score.recommendation).toBe("Do Not Advance");
    expect(score.total).toBeLessThanOrEqual(25);
  });

  it("prevents Advance when confidence cap applies", () => {
    const score = scoreSite({
      buyBox: defaultBuyBox,
      power: power(),
      flood: ok<FloodContext>({
        zone: "X",
        subtype: null,
        sfha: false,
        baseFloodElevation: null,
        depth: null,
      }),
      wetlands: ok<WetlandsContext>({
        intersectsWetland: false,
        features: [],
        extensive: false,
      }),
      landcover: ok<LandcoverContext>({
        className: "High-intensity developed / dense urban",
        signal: "dense-urban",
        humanReviewFlag: true,
        availabilityRisk: "likely-prohibitive",
        note: "Dense urban site, parcel availability/land cost/zoning not assessable and likely prohibitive, requires human review.",
      }),
      peering: ok<PeeringContext>({
        nearestFacility: {
          id: 1,
          name: "Facility",
          distanceMiles: 5,
          city: "New York",
          state: "NY",
          networkCount: 10,
          ixCount: 1,
        },
        facilitiesWithin25Miles: 10,
      }),
      zoning: ok<ZoningContext>({
        status: "manual-check",
        jurisdiction: "local",
        url: "https://example.com",
        note: "manual",
      }),
      dealKillers: [],
      confidenceCap: {
        maxScore: 49,
        reason: "Dense urban cap",
        forceRecommendation: "Do Not Advance",
      },
    });

    expect(score.recommendation).toBe("Do Not Advance");
    expect(score.total).toBeLessThanOrEqual(49);
    expect(score.confidenceCap.applied).toBe(true);
  });
});

function ok<T>(data: T): SourceResult<T> {
  return { status: "ok", data, source };
}

function power(): PowerMetrics {
  return {
    nearestHvLine: {
      id: "line",
      voltageKv: 345,
      voltageClass: "345+",
      owner: null,
      status: "IN SERVICE",
      type: null,
      distanceMiles: 2,
      sourceSubstation: null,
      targetSubstation: null,
    },
    nearestLine: null,
    nearestSubstation: {
      id: "sub",
      name: "Sub",
      city: "Columbus",
      state: "OH",
      maxVoltageKv: 345,
      minVoltageKv: 138,
      lineCount: 3,
      distanceMiles: 2,
    },
    queue: ok({
      region: "PJM",
      activeProjects: 10,
      activeMw: 100,
      typicalWaitYears: 2,
      congestionLevel: "Low",
      note: "regional",
    }),
    eia: ok({
      state: "OH",
      respondent: "PJM",
      industrialPriceCentsKwh: 7,
      pricePeriod: "2025",
      gridMix: [],
    }),
    readinessScore: 0,
    honestyLine: "human work",
  };
}
